"""Recolore une scène validée vers les autres palettes du brief, sans régénération.

Usage, depuis tests-images/production/ :
  python recolorer.py scene-mamie-seed1.png mamie mamie papy maman papa couple famille
      -> scene-<destinataire>-seed1-recolor.png dans production/ (mamie aussi : ramenée sur ses codes)
  python recolorer.py --recoller scene-mamie-hiver-seed1.png scene-mamie-seed1.png 0.32 0.66
      -> scene-mamie-hiver-recolle.png : la zone éditée (gauche, haut, fractions de largeur et de
         hauteur) recollée sur la scène d'origine, bord adouci ; puis recolorer ce fichier comme ci-dessus.

Méthode (décision du 02/11/2026 : même graine, compositions différentes) :
1. Chaque rôle de la palette source (fond, accent 1 nappe, accent 2 vaisselle, accent 3 sol) est
   retrouvé dans l'image : pixels proches de la couleur réellement peinte (médiane mesurée près du
   code), en Lab, puis seulement les zones d'un seul tenant assez grandes (évite le gâteau ou le bois).
2. Chaque zone d'un seul tenant d'un rôle est décalée en Lab pour que sa médiane tombe sur le code
   cible : les nuances et les traces de pinceau sont gardées, et le mur et le panneau de texte,
   peints en deux tons proches, finissent sur la même couleur. Bord adouci par un poids sur la distance.
   La palette source passe aussi par là, ce qui ramène la scène d'origine sur ses propres codes.
Dépendances : numpy, pillow, scipy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brief  # noqa: E402

ICI = Path(__file__).resolve().parent
SEUIL = 18.0       # distance Lab max au rôle (Delta E 76)
DOUX = 6.0         # largeur de la transition, en Delta E
TAILLE_MIN = 0.002 # part minimale de l'image pour garder une zone d'un seul tenant
SEUIL_PETIT = 10.0 # distance Lab médiane max pour garder une petite zone


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def rgb_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    m = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = xyz @ m.T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)


def roles(palette):
    p = brief.PALETTES[palette]
    return [p["fond"]] + p["accents"]


def masque_role(lab, code, autres):
    """Poids 0..1 des pixels du rôle peint près de `code`, et l'étiquette de zone de chaque pixel."""
    cible = rgb_lab(hex_rgb(code))
    d = np.linalg.norm(lab - cible, axis=-1)
    proches = d < 30
    if proches.sum() == 0:
        return None, None
    reel = np.median(lab[proches], axis=0)          # couleur réellement peinte
    d = np.linalg.norm(lab - reel, axis=-1)
    # un pixel plus proche d'un autre rôle n'appartient pas à celui-ci
    for a in autres:
        d = np.where(np.linalg.norm(lab - a, axis=-1) < d, np.inf, d)
    coeur = d < SEUIL
    etiq, n = ndimage.label(coeur)
    tailles = ndimage.sum(coeur, etiq, range(1, n + 1))
    # petites zones (nappe vue dans l'anse d'une tasse, mur dans l'anse de la théière) : gardées
    # seulement si leur couleur est presque exactement celle du rôle, pour ne pas prendre le gâteau
    meds = ndimage.median(d, etiq, range(1, n + 1))
    ok = (tailles >= TAILLE_MIN * coeur.size) | ((tailles >= 30) & (np.asarray(meds) < SEUIL_PETIT))
    garder = np.isin(etiq, 1 + np.where(ok)[0])
    etiq = np.where(garder, etiq, 0)
    # chaque pixel de bord prend l'étiquette de la zone la plus proche
    _, (iy, ix) = ndimage.distance_transform_edt(etiq == 0, return_indices=True)
    etiq = etiq[iy, ix]
    garder = ndimage.binary_dilation(garder, iterations=3) & (d < SEUIL + DOUX)
    poids = np.clip((SEUIL + DOUX - d) / DOUX, 0, 1) * garder
    return poids, etiq


def sous_zones(lab, zone, coeur):
    """Coupe une zone en deux tons si elle en a nettement deux (mur et panneau de texte peints
    côte à côte en deux crèmes proches). Sinon renvoie la zone entière."""
    px = lab[coeur]
    if len(px) < 1000:
        return [zone]
    c = np.percentile(px, [10, 90], axis=0)
    for _ in range(10):  # k-moyennes à deux centres
        k = np.argmin(np.linalg.norm(px[:, None] - c[None], axis=-1), axis=1)
        if k.min() == k.max():
            return [zone]
        c = np.array([px[k == i].mean(0) for i in (0, 1)])
    ecart = np.linalg.norm(c[0] - c[1])
    disp = np.mean([px[k == i].std(0).mean() for i in (0, 1)])
    parts = np.bincount(k, minlength=2) / len(k)
    if ecart < 3 * disp or parts.min() < 0.1:
        return [zone]
    k_tout = np.argmin(np.linalg.norm(lab[..., None, :] - c, axis=-1), axis=-1)
    return [zone & (k_tout == i) for i in (0, 1)]


def recolorer(source, de, vers):
    im = np.asarray(Image.open(source).convert("RGB"), dtype=float)
    lab = rgb_lab(im)
    codes_src = roles(de)
    codes_dst = roles(vers)
    labs_src = [rgb_lab(hex_rgb(c)) for c in codes_src]
    sortie = lab.copy()
    deja = np.zeros(lab.shape[:2])
    for i, (cs, cd) in enumerate(zip(codes_src, codes_dst)):
        autres = [l for j, l in enumerate(labs_src) if j != i]
        poids, etiq = masque_role(lab, cs, autres)
        if poids is None:
            print(f"  rôle {cs} introuvable, ignoré")
            continue
        poids = np.minimum(poids, 1 - deja)
        # chaque zone d'un seul tenant (mur, panneau, nappe...) est ramenée exactement sur la
        # couleur cible : sa médiane devient le code, ses nuances autour sont gardées
        cible = rgb_lab(hex_rgb(cd))
        decal = np.zeros_like(lab)
        coeur = poids > 0.99
        for z in np.unique(etiq[poids > 0]):
            zone = (etiq == z)
            for sous in sous_zones(lab, zone, coeur & zone):
                ref = coeur & sous
                med = np.median(lab[ref], axis=0) if ref.any() else rgb_lab(hex_rgb(cs))
                decal[sous] = cible - med
        sortie += poids[..., None] * decal
        deja += poids
        print(f"  {cs} -> {cd} : {100 * (poids > 0.5).mean():.1f} % de l'image")
    return Image.fromarray(lab_rgb(sortie).astype(np.uint8))


def recoller(edite, origine, largeur, hauteur, flou=12):
    """Recolle la zone éditée (coin haut gauche) sur l'image d'origine : hors zone, rien ne bouge."""
    a = np.asarray(Image.open(ICI / origine).convert("RGB"), dtype=float)
    b = np.asarray(Image.open(ICI / edite).convert("RGB"), dtype=float)
    h, w, _ = a.shape
    m = np.zeros((h, w))
    m[:int(hauteur * h), :int(largeur * w)] = 1
    m = ndimage.gaussian_filter(m, flou)[..., None]
    chemin = ICI / (Path(edite).stem.split("-seed")[0] + "-recolle.png")
    Image.fromarray((a * (1 - m) + b * m).astype(np.uint8)).save(chemin, dpi=(300, 300))
    print("  ->", chemin.name)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--recoller":
        recoller(sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]))
        raise SystemExit
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    fichier, de, cibles = sys.argv[1], sys.argv[2], sys.argv[3:]
    nom = Path(fichier).stem.replace(f"-{de}", "-{}")
    for vers in cibles:
        print(vers)
        out = ICI / (nom.format(vers) + "-recolor.png")
        recolorer(ICI / fichier, de, vers).save(out, dpi=(300, 300))
        print("  ->", out.name)
