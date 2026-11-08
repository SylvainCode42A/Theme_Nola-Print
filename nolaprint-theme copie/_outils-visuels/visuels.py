"""Visuels PROVISOIRES de la boutique Noël 2026, en attendant les rendus d'Antoine (production/valides et serveur).
Convention de noms (thème _noel-v2) :
  np2-plat-<objet>-<gab>-<dest>-<decl>.jpg  zone d'impression SANS texte (repli de la fiche quand le serveur ne répond pas)
  np2-ex-<objet>-<gab>-<dest>-<decl>.jpg     maquette de face avec un exemple de texte (1000 px) ; -s.jpg : 480 px (cartes)
  np2-bois-<forme>-masque.png / -contour.png masques de la décoration en bois
objet : mug | verre | bois (bois = forme cœur) ; gab : a | b ; dest : maman papa mamie papy couple famille ; decl : base | noel
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gabarit_a, gabarit_a_antoine

OUT = "/home/claude/gen"
SRC = "/mnt/user-data/uploads/nolaprint-theme/assets/"
F = "/home/claude/fonts/"
PAL = {  # brief de génération, section 2 : fond, accents, couleurs de texte
    "mamie":   ("#F3E6D3", ["#E07A5F", "#8AA587", "#D4A537"], ["#6B4430", "#C8453C", "#5E8A6E", "#2B3A67"]),
    "papy":    ("#D6DEE6", ["#D4A537", "#2E5E4E", "#B5533C"], ["#2B3A67", "#B5533C", "#2E5E4E", "#6B4430"]),
    "maman":   ("#F2D9DC", ["#7B3F61", "#D8A62A", "#5E8A6E"], ["#7B3F61", "#6B4430", "#5E8A6E", "#2B3A67"]),
    "papa":    ("#E3DED6", ["#2F4FA8", "#8A5A3B", "#D8A62A"], ["#2B3A67", "#8A5A3B", "#2F4FA8", "#1A1A1A"]),
    "couple":  ("#F5EFE0", ["#7A1E2E", "#B8923E", "#5E8A6E"], ["#7A1E2E", "#6B4430", "#5E8A6E", "#2B3A67"]),
    "famille": ("#F5EFE0", ["#5E8A6E", "#C8623C", "#D4A537"], ["#2E5E4E", "#6B4430", "#C8623C", "#2B3A67"]),
}
TITRE = {"mamie": "Mamie", "papy": "Papy", "maman": "Maman", "papa": "Papa", "couple": "Papy et Mamie", "famille": "Notre tribu"}
NOMS = ["Léa", "Hugo", "Jade"]
ZONES = {"mug": (1238, 578), "verre": (900, 900), "bois": (820, 1084)}  # bois : cœur 87 × 115 mm

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def font(name, px): return ImageFont.truetype(F + name, int(px))

def petals(d, cx, cy, r, col, n=6, centre="#F2C14E"):
    for k in range(n):
        a = 2 * math.pi * k / n
        px, py = cx + r * 0.62 * math.cos(a), cy + r * 0.62 * math.sin(a)
        d.ellipse([px - r * 0.48, py - r * 0.48, px + r * 0.48, py + r * 0.48], fill=col, outline="#3A2A22", width=max(2, int(r * 0.06)))
    d.ellipse([cx - r * 0.34, cy - r * 0.34, cx + r * 0.34, cy + r * 0.34], fill=centre, outline="#3A2A22", width=max(2, int(r * 0.06)))
    d.line([cx, cy + r * 0.9, cx, cy + r * 1.7], fill="#4E7A55", width=max(3, int(r * 0.12)))

def ornement(d, cx, cy, r, kind, col):
    w = max(2, int(r * 0.06))
    if kind == 0:   # boule
        d.ellipse([cx - r * 0.8, cy - r * 0.6, cx + r * 0.8, cy + r], fill=col, outline="#3A2A22", width=w)
        d.rectangle([cx - r * 0.22, cy - r * 0.85, cx + r * 0.22, cy - r * 0.55], fill="#D4A537", outline="#3A2A22", width=w)
    elif kind == 1:  # étoile
        pts = []
        for k in range(10):
            a = -math.pi / 2 + math.pi * k / 5; rr = r if k % 2 == 0 else r * 0.45
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        d.polygon(pts, fill="#E3B23C", outline="#3A2A22", width=w)
    else:            # sapin
        for k, s in enumerate([0.55, 0.8, 1.05]):
            y = cy - r + k * r * 0.55
            d.polygon([(cx, y - r * 0.2), (cx - r * s, y + r * 0.55), (cx + r * s, y + r * 0.55)], fill="#3F7A4E", outline="#3A2A22", width=w)
        d.rectangle([cx - r * 0.13, cy + r * 0.85, cx + r * 0.13, cy + r * 1.15], fill="#8A5A3B")

def text_c(d, xy, s, f, col):
    l, t, r, b = d.textbbox((0, 0), s, font=f, anchor="ls")
    d.text((xy[0] - (r - l) / 2, xy[1]), s, font=f, fill=col, anchor="ls")

K = 2   # dessin en 2x puis réduction : bords lissés

def mix(c1, c2, t):
    a, b = hexrgb(c1), hexrgb(c2); return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))

def disque(im):
    W, H = im.size; m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).ellipse([0, 0, W, H], fill=255)
    bg = Image.new("RGB", (W, H), "#FFFFFF"); bg.paste(im, (0, 0), m); return bg

def plat_A(objet, dest, decl, texte=True):
    W, H = ZONES[objet]; W, H = W * K, H * K; fond, acc, txt = PAL[dest]
    im = Image.new("RGB", (W, H), fond); d = ImageDraw.Draw(im)
    if objet == "mug":   # composition resserrée au milieu du panneau (face visible du mug)
        cx, top, span, r = W / 2, H * 0.29, W * 0.155, H * 0.125
    else:
        cx, top, span, r = W / 2, H * 0.33, W * 0.27, W * 0.085
    if texte: text_c(d, (cx, top), TITRE[dest], font("CaveatBrush.ttf", H * (0.16 if objet == "mug" else 0.1)), txt[0])
    for i, n in enumerate(NOMS):
        x = cx + (i - 1) * span; y = top + r * 2.0
        if decl == "base": petals(d, x, y, r, acc[i % 3])
        else: ornement(d, x, y, r, i, ["#C8453C", "#E3B23C", "#3F7A4E"][i])
        if texte: text_c(d, (x, y + r * 2.55), n, font("CaveatBrush.ttf", r * 0.95), txt[0])
    im = im.resize(ZONES[objet], Image.LANCZOS)
    return disque(im) if objet == "verre" else im

def gouter(d, bx, by, bw, bh, acc, noel, sol):
    """La table du goûter dans la boîte (bx, by, bw, bh) ; sol = y du sol."""
    L = "#3A2A22"; w = max(2, int(bh * 0.009))
    if noel:   # fenêtre enneigée et guirlande
        wx, wy, ww, wh = bx + bw * 0.04, by + bh * 0.05, bw * 0.30, bh * 0.30
        d.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=bw * 0.02, fill="#C9DCEA", outline="#6B4430", width=w * 2)
        d.line([wx + ww / 2, wy, wx + ww / 2, wy + wh], fill="#6B4430", width=w * 2); d.line([wx, wy + wh / 2, wx + ww, wy + wh / 2], fill="#6B4430", width=w * 2)
        for k in range(22):
            fx, fy = wx + (k * 37 % 97) / 97 * ww, wy + (k * 53 % 89) / 89 * wh; rr = bh * 0.006
            d.ellipse([fx - rr, fy - rr, fx + rr, fy + rr], fill="#FFFFFF")
        d.rectangle([wx, wy + wh * 0.86, wx + ww, wy + wh], fill="#FFFFFF")
        for k in range(9):
            t = k / 8; gx = bx + bw * (0.40 + 0.56 * t); gy = by + bh * (0.06 + 0.07 * math.sin(math.pi * t))
            if k: d.line([px_, py_, gx, gy], fill="#3F7A4E", width=w)
            rr = bh * 0.014; d.ellipse([gx - rr, gy, gx + rr, gy + rr * 2.4], fill=["#C8453C", "#E3B23C", "#2F4FA8"][k % 3], outline=L, width=1)
            px_, py_ = gx, gy
        ornement(d, bx + bw * 0.93, sol - bh * 0.15, bh * 0.13, 2, None)
    else:      # cadre au mur
        fx, fy, fw, fh = bx + bw * 0.08, by + bh * 0.08, bw * 0.18, bh * 0.22
        d.rectangle([fx, fy, fx + fw, fy + fh], fill="#F4EDE1", outline="#8A5A3B", width=w * 2)
        petals(d, fx + fw / 2, fy + fh * 0.42, fh * 0.2, acc[1])
    ty = by + bh * 0.56                       # dessus de table
    tx0, tx1 = bx + bw * 0.12, bx + bw * 0.88
    for lx in (0.2, 0.8):                     # pieds
        d.rectangle([bx + bw * (lx - 0.015), ty, bx + bw * (lx + 0.015), sol], fill="#8A5A3B", outline=L, width=w)
    nappe = ty + bh * 0.14
    d.rectangle([tx0, ty, tx1, nappe], fill=acc[0], outline=L, width=w)
    n = 9; rr = (tx1 - tx0) / n / 2
    for k in range(n):                        # festons de la nappe
        cx = tx0 + rr + k * 2 * rr; d.pieslice([cx - rr, nappe - rr, cx + rr, nappe + rr], 0, 180, fill=acc[0], outline=L, width=w)
    d.line([tx0 + w, nappe, tx1 - w, nappe], fill=acc[0], width=w * 2)
    # théière
    cx, r1 = bx + bw * 0.30, bw * 0.11
    d.polygon([(cx - r1 * 0.8, ty - r1 * 0.75), (cx - r1 * 1.75, ty - r1 * 1.25), (cx - r1 * 1.6, ty - r1 * 1.4), (cx - r1 * 0.85, ty - r1 * 1.0)], fill=acc[1], outline=L)
    d.ellipse([cx + r1 * 0.55, ty - r1 * 1.35, cx + r1 * 1.35, ty - r1 * 0.45], outline=L, width=w * 3)
    d.ellipse([cx - r1, ty - r1 * 1.6, cx + r1, ty + r1 * 0.05], fill=acc[1], outline=L, width=w)
    d.ellipse([cx - r1 * 0.45, ty - r1 * 1.78, cx + r1 * 0.45, ty - r1 * 1.42], fill=acc[1], outline=L, width=w)
    d.ellipse([cx - r1 * 0.12, ty - r1 * 1.98, cx + r1 * 0.12, ty - r1 * 1.72], fill="#F2C14E", outline=L, width=w)
    # tasse et soucoupe
    cx, r2 = bx + bw * 0.52, bw * 0.055
    d.ellipse([cx - r2 * 1.6, ty - r2 * 0.35, cx + r2 * 1.6, ty + r2 * 0.25], fill="#F4EDE1", outline=L, width=w)
    d.ellipse([cx + r2 * 0.7, ty - r2 * 1.5, cx + r2 * 1.5, ty - r2 * 0.7], outline=L, width=w * 2)
    d.polygon([(cx - r2, ty - r2 * 1.8), (cx + r2, ty - r2 * 1.8), (cx + r2 * 0.75, ty - r2 * 0.1), (cx - r2 * 0.75, ty - r2 * 0.1)], fill="#F4EDE1", outline=L)
    d.rectangle([cx - r2 * 0.93, ty - r2 * 1.45, cx + r2 * 0.93, ty - r2 * 1.15], fill=acc[2])
    for k in (-1, 1):
        x = cx + k * r2 * 0.35; d.arc([x - r2 * 0.3, ty - r2 * 3.4, x + r2 * 0.3, ty - r2 * 2.0], 100, 260, fill="#B9A89A", width=w)
    # gâteau sur son présentoir
    cx, r3 = bx + bw * 0.72, bw * 0.12
    d.rectangle([cx - r3 * 0.1, ty - r3 * 0.35, cx + r3 * 0.1, ty], fill="#F4EDE1", outline=L, width=w)
    d.ellipse([cx - r3 * 1.05, ty - r3 * 0.48, cx + r3 * 1.05, ty - r3 * 0.25], fill="#F4EDE1", outline=L, width=w)
    d.rectangle([cx - r3 * 0.8, ty - r3 * 1.15, cx + r3 * 0.8, ty - r3 * 0.38], fill="#E9C9A0", outline=L, width=w)
    d.rectangle([cx - r3 * 0.8, ty - r3 * 0.82, cx + r3 * 0.8, ty - r3 * 0.7], fill=acc[0])
    d.rectangle([cx - r3 * 0.8, ty - r3 * 1.28, cx + r3 * 0.8, ty - r3 * 1.12], fill="#FBF6EE", outline=L, width=w)
    for k in range(5):
        x = cx - r3 * 0.64 + k * r3 * 0.32; d.ellipse([x - r3 * 0.09, ty - r3 * 1.2, x + r3 * 0.09, ty - r3 * 0.96], fill="#FBF6EE")
    d.ellipse([cx - r3 * 0.14, ty - r3 * 1.56, cx + r3 * 0.14, ty - r3 * 1.28], fill="#C8453C", outline=L, width=w)

def plat_B(objet, dest, decl, texte=True):
    W, H = ZONES[objet]; W, H = W * K, H * K; fond, acc, txt = PAL[dest]
    im = Image.new("RGB", (W, H), fond); d = ImageDraw.Draw(im)
    if objet == "mug":    # scène à gauche du milieu du panneau, texte à droite
        bx, by, bw, bh = W * 0.31, H * 0.37, W * 0.38, H * 0.57
    elif objet == "bois":
        bx, by, bw, bh = W * 0.14, H * 0.43, W * 0.72, H * 0.44
    else:
        bx, by, bw, bh = W * 0.10, H * 0.36, W * 0.80, H * 0.50
    sol = by + bh * 0.86
    d.rectangle([0, sol, W, H], fill=mix(acc[2], fond, 0.45))
    d.line([0, sol, W, sol], fill=mix(acc[2], "#3A2A22", 0.25), width=max(2, int(H * 0.006)))
    gouter(d, bx, by, bw, bh, acc, decl == "noel", sol)
    f1 = font("Nunito-ExtraBold.ttf", H * (0.10 if objet == "mug" else 0.07)); f2 = font("Nunito-Bold.ttf", H * (0.058 if objet == "mug" else 0.048))
    if objet == "mug": zx, zy, dy = W / 2, H * 0.24, H * 0.095
    elif objet == "bois": zx, zy, dy = W / 2, H * 0.31, H * 0.075
    else: zx, zy, dy = W / 2, H * 0.20, H * 0.085
    if texte:
        text_c(d, (zx, zy), TITRE[dest], f1, txt[0])
        text_c(d, (zx, zy + dy), " · ".join(NOMS), f2, txt[0])
    im = im.resize(ZONES[objet], Image.LANCZOS)
    return disque(im) if objet == "verre" else im

def smooth(a, b, x): t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def mock_mug(plat, centre=105.0, anse_a_gauche=False):
    """anse_a_gauche : photo retournée (le texte reste à l'endroit), pour montrer la colonne de texte du gabarit B."""
    if anse_a_gauche:
        from PIL import ImageOps
        return ImageOps.mirror(mock_mug(ImageOps.mirror(plat), 210.0 - centre))
    """Maquette de face : lancer de rayons sur le cylindre calé sur la photo (maquette_mug.py)."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import maquette_mug
    return Image.fromarray(maquette_mug.maquette(plat, centre))

def mock_verre(plat):
    """Disque imprimé sur le verre biseauté : fond transparent possible (gabarit A), léger dégradé, reflet diagonal
    doux, liseré au bord du disque."""
    ph = Image.open(SRC + "np-verre-vierge.jpg").convert("RGB")
    cx, cy, r = 497.4, 493.8, 317.6
    S = 3; D = int(2 * r * S)
    big = ph.resize((1000 * S, 1000 * S), Image.BICUBIC)
    x0, y0 = int((cx - r) * S), int((cy - r) * S)
    zone = big.crop((x0, y0, x0 + D, y0 + D)).convert("RGBA")
    zone.alpha_composite(plat.convert("RGBA").resize((D, D), Image.LANCZOS))
    yy, xx = np.mgrid[0:D, 0:D].astype(np.float32); rr = np.hypot(xx - D / 2, yy - D / 2) / (D / 2)
    a = np.asarray(zone.convert("RGB")).astype(np.float32)
    a *= (1 - 0.07 * np.clip((rr - 0.55) / 0.45, 0, 1) ** 2)[..., None]
    k = ((xx - yy) / D + 0.18)
    gl = np.exp(-(k / 0.10) ** 2) * np.clip(1.1 - rr, 0, 1) * 0.16
    gl += np.exp(-(((xx - yy) / D + 0.42) / 0.035) ** 2) * np.clip(1 - rr, 0, 1) * 0.10
    a = a + (255 - a) * gl[..., None]
    a *= (1 - 0.35 * np.clip((rr - 0.985) / 0.015, 0, 1))[..., None]
    p = Image.fromarray(a.clip(0, 255).astype("uint8"))
    m = Image.new("L", (D, D), 0); ImageDraw.Draw(m).ellipse([1, 1, D - 1, D - 1], fill=255)
    big.paste(p, (x0, y0), m)
    return big.resize((1000, 1000), Image.LANCZOS)

def mock_bois(plat, forme="coeur", photo="np-bois-vierge.jpg", boite=(211, 136, 577, 760)):
    ph = Image.open(SRC + photo).convert("RGB")
    x, y, w, h = boite
    sc = max(w / plat.size[0], h / plat.size[1]); dw, dh = int(plat.size[0] * sc), int(plat.size[1] * sc)
    lay = Image.new("RGB", (1000, 1000), "#FFFFFF"); lay.paste(plat.resize((dw, dh), Image.LANCZOS), (int(x + (w - dw) / 2), int(y + (h - dh) / 2)))
    m = Image.open(OUT + f"/np2-bois-{forme}-masque.png").split()[-1]
    a = np.asarray(ph).astype(np.float32); b = np.asarray(lay).astype(np.float32); mm = np.asarray(m).astype(np.float32)[..., None] / 255
    out = a * (1 - mm) + (a * b / 255) * mm
    return Image.fromarray(out.clip(0, 255).astype("uint8"))

def masques():
    files = {"coeur": "np-bois-vierge.jpg", "sapin": "np-bois-sapin-vierge.jpg", "etoile": "np-bois-etoile-vierge.jpg",
             "cloche": "np-bois-cloche-vierge.jpg", "chaussette": "np-bois-chaussette-vierge.jpg", "ovale": "np-bois-ovale-vierge.jpg"}
    boites = {}
    for k, f in files.items():
        im = np.asarray(Image.open(SRC + f).convert("RGB")).astype(int)
        R, G, B = im[..., 0], im[..., 1], im[..., 2]
        wood = (R - B > 28) & (R > 150) & (G > 120) & ~(R - G > 60)
        m = Image.fromarray((wood * 255).astype("uint8")).filter(ImageFilter.MedianFilter(7))
        a = np.asarray(m) > 127; ys, xs = np.where(a)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        boites[k] = (int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1))
        soft = m.filter(ImageFilter.GaussianBlur(1.2))
        rgba = Image.new("RGBA", (1000, 1000), (255, 255, 255, 0)); rgba.putalpha(soft)
        rgba.save(f"{OUT}/np2-bois-{k}-masque.png", optimize=True)
        c = rgba.crop((x0, y0, x1 + 1, y1 + 1)).resize((400, int(400 * (y1 - y0 + 1) / (x1 - x0 + 1))), Image.LANCZOS)
        c.save(f"{OUT}/np2-bois-{k}-contour.png", optimize=True)
    return boites

def rendu_js(objet, dest, decl, k):
    im = Image.open(f"/home/claude/gen-b/{objet}-{dest}-{decl}-{k}.png").convert("RGBA")
    if objet == "verre": return im.resize((900, 900), Image.LANCZOS)
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    return bg.convert("RGB").resize((1238, 578) if objet == "mug" else (820, 1084), Image.LANCZOS)

def save_jpg(im, name, q=86):
    im.convert("RGB").save(f"{OUT}/{name}", quality=q, optimize=True, progressive=True)

if __name__ == "__main__" and "offres" not in sys.argv:
    os.makedirs(OUT, exist_ok=True)
    print("boites", masques())
    combos = [("mug", "a", "base"), ("mug", "a", "noel"), ("mug", "b", "base"),
              ("verre", "a", "noel"), ("verre", "b", "noel"), ("bois", "a", "noel"), ("bois", "b", "noel")]
    for objet, gab, decl in combos:
        for dest in PAL:
            if gab == "a":   # gabarit A : module de rendu d'Antoine
                plat = gabarit_a_antoine.plat_A(objet, dest, decl, texte=True)
                nu = gabarit_a_antoine.plat_A(objet, dest, decl, texte=False)
            else:            # gabarit B : assets/np-rendu.js (harness/rendre_b.js), le code de l'aperçu de la fiche
                plat, nu = (rendu_js(objet, dest, decl, k) for k in ("t", "nu"))
            base = f"np2-{{}}-{objet}-{gab}-{dest}-{decl}"
            if objet == "verre": nu.save(f"{OUT}/" + base.format("plat") + ".png", optimize=True)   # boule : PNG transparent
            else: save_jpg(nu, base.format("plat") + ".jpg", 88)
            ex = (mock_mug(plat) if gab == "a" else mock_mug(plat, 142.0, True)) if objet == "mug" else mock_verre(plat) if objet == "verre" else mock_bois(plat)
            save_jpg(ex, base.format("ex") + ".jpg")
            save_jpg(ex.resize((480, 480), Image.LANCZOS), base.format("ex") + "-s.jpg", 84)
    print("ok", len(os.listdir(OUT)))


def centre_objet(path):
    """Abscisse du milieu de l'objet dans la photo 1000 px (hors ombre au sol)."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)[:700]
    bg = np.median(np.concatenate([a[:, :40], a[:, -40:]], axis=1), axis=1)[:, None, :]
    m = (np.abs(a - bg).max(axis=2) > 14).sum(axis=0) > 6
    xs = np.where(m)[0]
    return (xs.min() + xs.max()) / 2 if len(xs) else 500

def offres():
    """Visuels des offres (1200 x 900, recadrés en 4:3 par les cartes) : trois photos fondues l'une dans l'autre,
    fond continu, sans bandes vides. -t.jpg : vignette carrée du milieu."""
    import cv2
    def planche(files, name, scs, ctr=450):
        """Trois photos (échelles scs) dont l'objet est centré dans sa case et à mi-hauteur ; fond lisse prolongé,
        ruban prolongé vers le haut, couleurs de fond accordées sur la première photo."""
        Wc, Hc, pas, x0 = 1200, 900, 380, 220
        acc = np.zeros((Hc, Wc, 3), np.float64); wsum = np.zeros((Hc, Wc), np.float64)
        xs = np.arange(Wc); ref = None
        for i, (f, sc) in enumerate(zip(files, scs)):
            src = Image.open(OUT + "/" + f).convert("RGB"); S = int(1000 * sc)
            t = np.asarray(src.resize((S, S), Image.LANCZOS)).astype(np.float64)
            side = np.concatenate([t[:, :S // 12], t[:, -S // 12:]], axis=1)
            med = np.maximum(np.median(side[:, :S // 12].reshape(-1, 3), axis=0), np.median(side[:, S // 12:].reshape(-1, 3), axis=0))
            if ref is None: ref = med
            t = t * (ref / med)[None, None, :]; side = side * (ref / med)
            # milieu vertical de l'objet (hors ruban et ombre) et horizontal
            a = np.asarray(src).astype(int); bgc = np.median(np.concatenate([a[:, :40], a[:, -40:]], axis=1), axis=1)[:, None, :]
            msk = np.abs(a - bgc).max(axis=2) > 14
            rows = np.where(msk[:, 300:700].sum(axis=1) > 60)[0]
            cy = (rows.min() + rows.max()) / 2 if len(rows) else 500
            slot = x0 + pas * i
            ox = int(round(slot - (centre_objet(OUT + "/" + f) - 500) * sc - S / 2))
            oy = int(round(ctr - cy * sc))
            rmed = np.maximum(np.median(side[:, :S // 12], axis=1), np.median(side[:, S // 12:], axis=1))   # le bord le plus clair (pas d'ombre)
            sm = np.stack([np.convolve(np.pad(rmed[:, c], 15, mode="edge"), np.ones(31) / 31, mode="valid") for c in range(3)], axis=1)
            fill = np.stack([np.interp(np.arange(Hc), oy + np.arange(S), sm[:, c]) for c in range(3)], axis=1)
            big = np.repeat(fill[:, None, :], Wc, axis=1)
            # ruban : les colonnes qui touchent le haut de la photo sont prolongées
            top = t[:3].mean(axis=0)
            rib = np.convolve(((top[:, 0] - top[:, 1] > 35) & (top.max(axis=1) - top.min(axis=1) > 50)).astype(float), np.ones(5) / 5, mode="same").clip(0, 1)
            for x in np.where(rib > 0)[0]:
                X = ox + x
                if 0 <= X < Wc and oy > 0: big[:oy, X] = big[:oy, X] * (1 - rib[x]) + top[x] * rib[x]
            yy = np.arange(S); fy = np.clip(np.minimum(yy, S - 1 - yy) / 40.0, 0, 1)
            fx = np.clip(np.minimum(yy, S - 1 - yy) / 40.0, 0, 1)
            al = (fy[:, None] * fx[None, :])[..., None]
            if rib.max() > 0:   # garder le ruban net jusqu'au bord haut de la photo
                al[:40] = np.maximum(al[:40], rib[None, :, None])
            ya, yb = max(0, oy), min(Hc, oy + S); xa, xb = max(0, ox), min(Wc, ox + S)
            T = t[ya - oy:yb - oy, xa - ox:xb - ox]; A = al[ya - oy:yb - oy, xa - ox:xb - ox]
            big[ya:yb, xa:xb] = big[ya:yb, xa:xb] * (1 - A) + T * A
            w = 1 / (1 + (np.abs(xs - slot) / (pas / 2 + 4)) ** 8)
            acc += big * w[None, :, None]; wsum += w[None, :]
        im = Image.fromarray((acc / wsum[..., None]).clip(0, 255).astype("uint8"))
        save_jpg(im, name + ".jpg")
        save_jpg(im.crop((x0 + pas - 230, ctr - 250, x0 + pas + 230, ctr + 210)).resize((240, 240), Image.LANCZOS), name + "-t.jpg", 82)
    planche(["np2-ex-mug-a-mamie-base.jpg", "np2-ex-mug-a-papy-base.jpg", "np2-ex-mug-b-maman-base.jpg"], "np2-offre-lot-mug", [0.54] * 3)
    planche(["np2-ex-verre-a-mamie-noel.jpg", "np2-ex-verre-b-papy-noel.jpg", "np2-ex-verre-a-famille-noel.jpg"], "np2-offre-lot-verre", [0.53] * 3, 470)
    planche(["np2-ex-bois-a-mamie-noel.jpg", "np2-ex-bois-b-couple-noel.jpg", "np2-ex-bois-a-papa-noel.jpg"], "np2-offre-lot-bois", [0.64] * 3, 470)
    planche(["np2-ex-mug-a-mamie-base.jpg", "np2-ex-verre-a-mamie-noel.jpg", "np2-ex-bois-b-mamie-noel.jpg"], "np2-offre-trio", [0.54, 0.52, 0.58], 470)

if __name__ == "__main__" and "offres" in sys.argv:
    offres()
