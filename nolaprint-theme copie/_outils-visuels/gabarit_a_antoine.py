"""Gabarit A rendu par le module d'Antoine (production/rendu/rendu.py, 03/11/2026) : « Le jardin de … » (fleurs
plantées dans une bande de sol, mois sous chaque prénom) et « Le sapin de … » (ornements pendus à une branche).
Renvoie l'image au format des visuels du thème (mug 1238 x 578, boule 900 x 900 RGBA, bois cœur 820 x 1084)."""
import sys
from PIL import Image
sys.path.insert(0, "/home/claude/antoine/3-systeme/recherches/tests-images/production/rendu")
from rendu import rendre

MOIS = {"oeillet": "janvier", "violette": "février", "jonquille": "mars", "marguerite": "avril", "muguet": "mai", "rose": "juin",
        "pied-alouette": "juillet", "tournesol": "août", "aster": "septembre", "souci": "octobre", "chrysantheme": "novembre", "houx": "décembre"}
NOMS = ["Léa", "Hugo", "Jade"]
SURNOM = {"mamie": "Mamie", "papy": "Papy", "maman": "Maman", "papa": "Papa", "couple": "Papy et Mamie", "famille": "la famille"}
TEXTE = {"mamie": "#6B4430", "papy": "#2B3A67", "maman": "#7B3F61", "papa": "#2B3A67", "couple": "#7A1E2E", "famille": "#2E5E4E"}
FLEURS = {"mamie": ["rose", "tournesol", "muguet"], "papy": ["tournesol", "violette", "muguet"], "maman": ["muguet", "oeillet", "rose"],
          "papa": ["pied-alouette", "souci", "marguerite"], "couple": ["rose", "houx", "jonquille"], "famille": ["chrysantheme", "aster", "rose"]}
ORNEMENTS = {"mamie": ["boule", "etoile", "sapin"], "papy": ["sapin", "flocon", "boule"], "maman": ["coeur", "etoile", "pain-epice"],
             "papa": ["flocon", "sapin", "etoile"], "couple": ["coeur", "boule", "sapin"], "famille": ["pain-epice", "sapin", "etoile"]}

def plat_A(objet, dest, decl, texte=True):
    syms = FLEURS[dest] if decl == "base" else ORNEMENTS[dest]
    if objet != "mug": syms = syms[:1]     # boule et bois : un seul ornement, bien centré (03/11/2026)
    pren = [{"prenom": NOMS[i] if texte else "", "symbole": s, "mois": MOIS.get(s) if (texte and decl == "base") else None} for i, s in enumerate(syms)]
    cmd = dict(support={"mug": "mug", "verre": "boule", "bois": "bois"}[objet], gabarit="A", destinataire=dest, saison=decl,
               surnom=SURNOM[dest] if texte else "", couleur_texte=TEXTE[dest], phrase="", prenoms=pren)
    if objet == "bois": cmd["forme"] = "coeur"
    im, _ = rendre(cmd)
    if objet == "mug": return im.convert("RGB").resize((1238, 578), Image.LANCZOS)
    if objet == "verre": return im.resize((900, 900), Image.LANCZOS)
    # cœur : la zone de titre est estimée par le module (y 7 mm) et tombe sur le trou du ruban ; pour la maquette,
    # le dessin est réduit à 78 % et descendu de 23 mm (sous le ruban de la photo) — à corriger dans gabarits.json par Antoine
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    k = 0.78; sm = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    bg.alpha_composite(sm, ((im.width - sm.width) // 2, round(23 * im.height / 115)))
    return bg.convert("RGB").resize((820, 1084), Image.LANCZOS)
