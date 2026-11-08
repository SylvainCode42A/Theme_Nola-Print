"""Maquette du mug : plaque l'image de la zone d'impression (2475 x 1155 px = 210 x 98 mm, ou réduite) sur la photo
np-mug-vierge.jpg par lancer de rayons sur un cylindre vu par une caméra calée sur la photo (mug_cam.py, écart < 0,2 px).
- le milieu du panneau face à soi, comme la pose de repos du mug 3D ;
- la bande suit la perspective du bord et du pied ; 2 mm de blanc sous la lèvre et au-dessus du pied arrondi ;
- l'ombrage de la photo est conservé (multiplication par la luminance du mug blanc) ; bords lissés (suréchantillonnage 3x).
Réutilisable telle quelle avec les vraies images d'Antoine : python3 maquette_mug.py plat.jpg sortie.jpg
(Python 3 avec numpy, opencv-python et pillow ; la caméra ne vaut que pour cette photo-là.)
"""
import os, sys
import numpy as np
import cv2

# photo du mug vierge : variable NP_PHOTO_MUG, sinon celle du thème v2 (../_noel-v2/assets), sinon celle du banc d'essai
_ICI = os.path.dirname(os.path.abspath(__file__))
PHOTO = next(p for p in [os.environ.get("NP_PHOTO_MUG", ""), os.path.join(_ICI, "..", "_noel-v2", "assets", "np-mug-vierge.jpg"),
                         "/mnt/user-data/uploads/nolaprint-theme/assets/np-mug-vierge.jpg"] if p and os.path.exists(p))
CAM = dict(F=2586.797931930921, D=414.6445083298388, Hc=156.52827462991408, phi=0.17611477425525132, cy0=268.9338354173269, H=96.88266390644766)
R, CX = 41.0, 451.5
BAND_MM = (210.0, 98.0)
MARGE = 2.0          # mm de blanc sous la lèvre et au-dessus du pied
SS = 3               # suréchantillonnage
BOX = (180, 130, 730, 870)  # x0, y0, x1, y1 : zone du corps dans la photo
LREF = 236.0         # luminance du blanc le plus clair du corps

_cache = {}

def _carte(centre=105.0):
    """Coordonnées (u, v) dans le panneau en mm, pour chaque point suréchantillonné de la zone du corps."""
    if centre in _cache: return _cache[centre]
    c = CAM; x0, y0, x1, y1 = BOX
    xs = x0 + (np.arange((x1 - x0) * SS) + 0.5) / SS
    ys = y0 + (np.arange((y1 - y0) * SS) + 0.5) / SS
    X, Y = np.meshgrid(xs, ys)
    a = (X - CX) / c["F"]; b = -(Y - c["cy0"]) / c["F"]
    sp, cp = np.sin(c["phi"]), np.cos(c["phi"])
    dx, dy, dz = a, b * cp - sp, b * sp + cp
    A = dx * dx + dz * dz; B = -2 * c["D"] * dz; C0 = c["D"] ** 2 - R * R
    disc = B * B - 4 * A * C0
    ok = disc >= 0
    t = (-B - np.sqrt(np.where(ok, disc, 0))) / (2 * A)
    h = c["Hc"] + t * dy
    th = np.arctan2(t * dx, c["D"] - t * dz)
    h0, h1 = MARGE, c["H"] - MARGE
    s = (h1 - h0) / BAND_MM[1]                      # échelle uniforme panneau -> mug
    u = centre + R * th / s                         # mm dans le panneau (centre : point face à soi)
    v = (h1 - h) / s
    ok &= (h >= h0) & (h <= h1) & (u >= 0) & (u <= BAND_MM[0])
    _cache[centre] = (u, v, ok)
    return _cache[centre]

def maquette(plat_rgb, centre=105.0):
    """plat_rgb : tableau HxWx3 uint8 (ou image PIL) de la zone d'impression. Renvoie la photo 1000 x 1000 (uint8 RGB)."""
    plat = np.asarray(plat_rgb.convert("RGB") if hasattr(plat_rgb, "convert") else plat_rgb)
    ph = cv2.cvtColor(cv2.imread(PHOTO), cv2.COLOR_BGR2RGB)
    u, v, ok = _carte(centre)
    Hp, Wp = plat.shape[:2]
    mx = (u * Wp / BAND_MM[0] - 0.5).astype(np.float32)
    my = (v * Hp / BAND_MM[1] - 0.5).astype(np.float32)
    # le motif est réduit d'un facteur ~5 : on le pré-filtre pour éviter le crénelage
    k = max(1.0, Wp / ((BOX[2] - BOX[0]) * SS) * 0.9)
    src = cv2.GaussianBlur(plat, (0, 0), k * 0.5) if k > 1.5 else plat
    col = cv2.remap(src, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    x0, y0, x1, y1 = BOX
    zone = ph[y0:y1, x0:x1].astype(np.float32)
    big = cv2.resize(zone, ((x1 - x0) * SS, (y1 - y0) * SS), interpolation=cv2.INTER_CUBIC)
    lum = (0.299 * big[..., 0] + 0.587 * big[..., 1] + 0.114 * big[..., 2])[..., None]
    shade = np.clip(lum / LREF, 0, 1.06)
    imp = col * shade
    m = ok[..., None].astype(np.float32)
    out = big * (1 - m) + imp * m
    small = cv2.resize(out, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
    res = ph.copy(); res[y0:y1, x0:x1] = np.clip(small, 0, 255).astype(np.uint8)
    return res

if __name__ == "__main__":
    from PIL import Image
    im = Image.fromarray(maquette(Image.open(sys.argv[1])))
    im.save(sys.argv[2], quality=88)
