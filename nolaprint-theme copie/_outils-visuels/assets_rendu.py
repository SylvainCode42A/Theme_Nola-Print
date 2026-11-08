"""Fichiers du thème pour l'aperçu dynamique (assets/np-rendu.js) :
- np2-el-<id>.png : les 18 éléments d'Antoine (production/valides), 400 px au plus ;
- np2-sol-*.png, np2-branche-*.png : bouts et tuile du sol (jardin) et de la branche (sapin) ;
- np2-scene-<dest>-<decl>.png : la table du goûter (mug, gabarit B), PROVISOIRE, 130 x 88 mm à 10 px/mm ;
- np2-motif-<dest>-<decl>.png : un seul motif centré (théière et tasse) pour la boule et le bois, PROVISOIRE ;
- np-font-caveat-brush.ttf, np-font-nunito.ttf : polices des gabarits (OFL).
"""
import math, os, shutil, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import visuels as V

A = "/home/claude/antoine/3-systeme/recherches/tests-images/production/"
OUT = "/home/claude/gen/"
IDS = {"pied-alouette": "pied-dalouette", "pain-epice": "pain-depice", "coeur": "coeur-noel"}
SYMS = ["oeillet", "violette", "jonquille", "marguerite", "muguet", "rose", "pied-alouette", "tournesol", "aster", "souci",
        "chrysantheme", "houx", "boule", "etoile", "sapin", "flocon", "pain-epice", "coeur"]

def elements():
    for n in SYMS:
        e = Image.open(A + "valides/" + n + ".png").convert("RGBA")
        e = e.crop(e.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
        e.thumbnail((400, 400), Image.LANCZOS)
        e.save(OUT + f"np2-el-{IDS.get(n, n)}.png", optimize=True)
    for sup in ("sol", "branche"):
        for p in ("gauche", "tuile", "droite"):
            e = Image.open(A + f"valides/{sup}-{p}.png").convert("RGBA")
            k = 100 / e.height
            e.resize((max(1, round(e.width * k)), 100), Image.LANCZOS).save(OUT + f"np2-{sup}-{p}.png", optimize=True)
    shutil.copy(A + "rendu/fonts/CaveatBrush-Regular.ttf", OUT + "np-font-caveat-brush.ttf")
    shutil.copy(A + "rendu/fonts/Nunito[wght].ttf", OUT + "np-font-nunito.ttf")

def scene(dest, decl):
    """Table du goûter dans un rectangle 130 x 88 mm (10 px/mm), fond de la palette, sol en bas."""
    W, H = 1300 * 2, 880 * 2
    fond, acc, txt = V.PAL[dest]
    im = Image.new("RGB", (W, H), fond); d = ImageDraw.Draw(im)
    sol = H * 0.84
    d.rectangle([0, sol, W, H], fill=V.mix(acc[2], fond, 0.45))
    d.line([0, sol, W, sol], fill=V.mix(acc[2], "#3A2A22", 0.25), width=6)
    V.gouter(d, W * 0.06, H * 0.08, W * 0.88, H * 0.88, acc, decl == "noel", sol)
    return im.resize((1300, 880), Image.LANCZOS)

def motif(dest, decl):
    """Un seul motif centré : la théière et sa tasse sur un napperon (et un petit sapin à Noël), fond transparent."""
    W, H = 1400, 1100
    fond, acc, txt = V.PAL[dest]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    L = "#3A2A22"; w = 7
    ty = H * 0.80
    d.ellipse([W * 0.08, ty - H * 0.07, W * 0.92, ty + H * 0.07], fill=acc[0], outline=L, width=w)        # napperon
    for k in range(18):
        a = math.pi * 2 * k / 18; x, y = W / 2 + W * 0.42 * math.cos(a), ty + H * 0.07 * math.sin(a)
        d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=acc[0])
    cx, r1 = W * 0.40, W * 0.17                                                                               # théière
    d.polygon([(cx - r1 * 0.8, ty - r1 * 0.75), (cx - r1 * 1.75, ty - r1 * 1.3), (cx - r1 * 1.6, ty - r1 * 1.45), (cx - r1 * 0.85, ty - r1 * 1.0)], fill=acc[1], outline=L)
    d.ellipse([cx + r1 * 0.55, ty - r1 * 1.35, cx + r1 * 1.35, ty - r1 * 0.45], outline=L, width=w * 3)
    d.ellipse([cx - r1, ty - r1 * 1.6, cx + r1, ty + r1 * 0.05], fill=acc[1], outline=L, width=w)
    d.ellipse([cx - r1 * 0.45, ty - r1 * 1.78, cx + r1 * 0.45, ty - r1 * 1.42], fill=acc[1], outline=L, width=w)
    d.ellipse([cx - r1 * 0.12, ty - r1 * 1.98, cx + r1 * 0.12, ty - r1 * 1.72], fill="#F2C14E", outline=L, width=w)
    cx, r2 = W * 0.70, W * 0.075                                                                              # tasse
    d.ellipse([cx - r2 * 1.6, ty - r2 * 0.35, cx + r2 * 1.6, ty + r2 * 0.25], fill="#F4EDE1", outline=L, width=w)
    d.ellipse([cx + r2 * 0.7, ty - r2 * 1.5, cx + r2 * 1.5, ty - r2 * 0.7], outline=L, width=w * 2)
    d.polygon([(cx - r2, ty - r2 * 1.8), (cx + r2, ty - r2 * 1.8), (cx + r2 * 0.75, ty - r2 * 0.1), (cx - r2 * 0.75, ty - r2 * 0.1)], fill="#F4EDE1", outline=L)
    d.rectangle([cx - r2 * 0.93, ty - r2 * 1.45, cx + r2 * 0.93, ty - r2 * 1.15], fill=acc[2])
    for k in (-1, 1):
        x = cx + k * r2 * 0.35; d.arc([x - r2 * 0.3, ty - r2 * 3.4, x + r2 * 0.3, ty - r2 * 2.0], 100, 260, fill="#B9A89A", width=w)
    if decl == "noel":
        V.ornement(d, W * 0.88, ty - H * 0.22, H * 0.15, 2, None)
    im = im.crop(im.getchannel("A").getbbox())
    im.thumbnail((700, 700), Image.LANCZOS)
    return im

if __name__ == "__main__":
    elements()
    for dest in V.PAL:
        scene(dest, "base").save(OUT + f"np2-scene-{dest}-base.png", optimize=True)
        for decl in ("base", "noel"):
            motif(dest, decl).save(OUT + f"np2-motif-{dest}-{decl}.png", optimize=True)
    print("ok")
