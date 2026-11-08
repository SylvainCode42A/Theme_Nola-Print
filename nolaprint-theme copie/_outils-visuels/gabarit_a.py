"""Gabarit A avec les vrais éléments d'Antoine (production/valides/, 02/11/2026), placés selon
CMP - Gabarits de support (gabarits.json) : mug 210 x 98 mm fond blanc, boule disque 76,2 mm fond transparent,
bois (cœur 87 x 115 mm) fond transparent (blanc ici : le bois est multiplié).
Exemple de texte : titre du destinataire, trois prénoms (Léa, Hugo, Jade)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

EL = "/home/claude/elements/"
F = "/home/claude/fonts/"
NOMS = ["Léa", "Hugo", "Jade"]
TITRE = {"mamie": "Mamie", "papy": "Papy", "maman": "Maman", "papa": "Papa", "couple": "Papy et Mamie", "famille": "Notre tribu"}
TEXTE = {"mamie": "#6B4430", "papy": "#2B3A67", "maman": "#7B3F61", "papa": "#2B3A67", "couple": "#7A1E2E", "famille": "#2E5E4E"}
# trois fleurs (ou ornements) d'exemple, différentes d'un destinataire à l'autre
FLEURS = {"mamie": ["rose", "marguerite", "tournesol"], "papy": ["tournesol", "violette", "muguet"], "maman": ["tulipe", "muguet", "oeillet"],
          "papa": ["pied-alouette", "souci", "marguerite"], "couple": ["rose", "houx", "jonquille"], "famille": ["chrysantheme", "aster", "rose"]}
ORNEMENTS = {"mamie": ["boule", "etoile", "sapin"], "papy": ["sapin", "flocon", "boule"], "maman": ["coeur", "etoile", "pain-epice"],
             "papa": ["flocon", "sapin", "etoile"], "couple": ["coeur", "boule", "sapin"], "famille": ["pain-epice", "sapin", "etoile"]}
_cache = {}

def element(nom):
    if nom not in _cache:
        e = Image.open(EL + nom + ".png").convert("RGBA")
        _cache[nom] = e.crop(e.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
    return _cache[nom]

def coller(im, nom, cx, top, box):
    """Élément centré dans un carré de côté box (px), haut du carré à top."""
    e = element(nom); sc = box / max(e.size)
    e = e.resize((max(1, int(e.width * sc)), max(1, int(e.height * sc))), Image.LANCZOS)
    im.alpha_composite(e, (int(cx - e.width / 2), int(top + (box - e.height) / 2)))

def police(px):
    return ImageFont.truetype(F + "CaveatBrush.ttf", max(8, int(px)))

def taille_pour_cap(cap_px):
    f = police(100); l, t, r, b = f.getbbox("H")
    return cap_px * 100 / (b - t)

def texte_c(d, cx, y_haut, s, cap_px, col, lmax=None):
    sz = taille_pour_cap(cap_px)
    f = police(sz)
    if lmax:
        while f.getlength(s) > lmax and sz > 8: sz *= 0.95; f = police(sz)
    l, t, r, b = d.textbbox((0, 0), s, font=f, anchor="ls")
    capt = police(sz).getbbox("H"); cap = capt[3] - capt[1]
    d.text((cx - (r - l) / 2, y_haut + cap), s, font=f, fill=col, anchor="ls")

def texte_arc(im, cx, cy, rayon, deg0, deg1, s, cap_px, col):
    """Texte sur l'arc supérieur (angles en degrés, 0 = droite, sens horaire écran), centré entre deg0 et deg1."""
    f = police(taille_pour_cap(cap_px))
    larg = [f.getlength(c) for c in s]; tot = sum(larg) * 1.04
    a_tot = tot / rayon; a_mid = math.radians((deg0 + deg1) / 2)
    a = a_mid - a_tot / 2
    for c, w in zip(s, larg):
        am = a + (w * 1.04) / 2 / rayon
        x, y = cx + rayon * math.cos(am), cy + rayon * math.sin(am)
        g = Image.new("RGBA", (int(w * 2 + 20), int(cap_px * 3 + 20)), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), c, font=f, fill=col, anchor="ms")
        g = g.rotate(-math.degrees(am) - 90, resample=Image.BICUBIC, expand=True)
        im.alpha_composite(g, (int(x - g.width / 2), int(y - g.height / 2)))
        a += (w * 1.04) / rayon

def plat_A(objet, dest, decl, texte=True, W=None, H=None):
    syms = FLEURS[dest] if decl == "base" else ORNEMENTS[dest]
    col = TEXTE[dest]
    if objet == "mug":                       # 1238 x 578 px pour 210 x 98 mm
        W, H = 1238 * 2, 578 * 2; k = W / 210
        im = Image.new("RGBA", (W, H), (255, 255, 255, 255)); d = ImageDraw.Draw(im)
        box, gap = 40 * k, 2.5 * k
        x0 = 105 * k - (3 * box + 2 * gap) / 2
        if texte: texte_c(d, 105 * k, 8 * k + 3 * k, TITRE[dest], 8 * k, col, 170 * k)
        for i, s in enumerate(syms):
            cx = x0 + box / 2 + i * (box + gap)
            coller(im, s, cx, 26 * k, box)
            if texte: texte_c(d, cx, 26 * k + box + 2 * k + 1 * k, NOMS[i], 4 * k, col, box)
        return im.convert("RGB").resize((1238, 578), Image.LANCZOS)
    if objet == "verre":                     # disque 76,2 mm -> 900 px, fond transparent
        W = H = 1800; k = W / 76.2; c = W / 2
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        box, gap = 19 * k, 2.5 * k
        x0 = c - (3 * box + 2 * gap) / 2
        if texte: texte_arc(im, c, c, 30 * k - 2.5 * k, 200, 340, TITRE[dest], 5 * k, col)
        for i, s in enumerate(syms):
            cx = x0 + box / 2 + i * (box + gap)
            coller(im, s, cx, c - box / 2, box)
            if texte: texte_c(d, cx, c + box / 2 + 1 * k, NOMS[i], 3 * k, col, box)
        return im.resize((900, 900), Image.LANCZOS)
    # bois, cœur 87 x 115 mm -> 820 x 1084 px ; zone utile 13, 20, 60, 55 ; 3 symboles en 2 x 2 de 24 mm
    W, H = 820 * 2, 1084 * 2; k = W / 87
    im = Image.new("RGBA", (W, H), (255, 255, 255, 255)); d = ImageDraw.Draw(im)
    if texte: texte_c(d, 43.5 * k, 28 * k, TITRE[dest], 6 * k, col, 50 * k)
    box, gap = 20 * k, 2 * k
    pos = [(43.5 * k - (box + gap) / 2, 37 * k), (43.5 * k + (box + gap) / 2, 37 * k), (43.5 * k, 37 * k + box + 6 * k)]
    for i, s in enumerate(syms):
        cx, top = pos[i]
        coller(im, s, cx, top, box)
        if texte: texte_c(d, cx, top + box + 0.8 * k, NOMS[i], 3.5 * k, col, box + 4 * k)
    return im.convert("RGB").resize((820, 1084), Image.LANCZOS)
