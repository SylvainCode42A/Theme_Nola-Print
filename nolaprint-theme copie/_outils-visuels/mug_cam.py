"""Calage d'une caméra sténopé sur la photo du mug vierge (np-mug-vierge.jpg, 1000 px)."""
import numpy as np
from scipy.optimize import least_squares
R = 41.0
CX = 451.5
# observations (photo) : (h: 'top'|'bot', theta_deg, y attendu) et largeurs de silhouette
OBS_Y = [("top", 180, 150.0), ("top", 0, 223.0), ("top", None, 215.5, 300.0), ("bot", 0, 849.0), ("bot", None, 830.0, 300.0)]
OBS_W = [("top", 254.5), ("bot", 244.5)]

def proj(p, X, Y, Z):
    F, D, Hc, phi, cy0, H = p
    dx, dy, dz = X, Y - Hc, Z + D
    fw = -dy * np.sin(phi) + dz * np.cos(phi)
    up = dy * np.cos(phi) + dz * np.sin(phi)
    return CX + F * dx / fw, cy0 - F * up / fw

def ring(p, h, n=3600):
    th = np.linspace(-np.pi, np.pi, n)
    return th, proj(p, R * np.sin(th), np.full_like(th, h), -R * np.cos(th))

def resid(p):
    H = p[5]; out = []
    for o in OBS_Y:
        h = H if o[0] == "top" else 0.0
        th, (x, y) = ring(p, h)
        if o[1] is not None:
            t = np.radians(o[1]); xx, yy = proj(p, R * np.sin(t), h, -R * np.cos(t)); out.append(yy - o[2])
        else:   # point avant de l'anneau à l'abscisse donnée
            front = np.abs(th) < np.pi / 2
            i = np.argmin(np.abs(x[front] - o[3])); out.append(y[front][i] - o[2])
    for o in OBS_W:
        h = H if o[0] == "top" else 0.0
        th, (x, y) = ring(p, h); out.append((x.max() - x.min()) / 2 - o[1])
    return np.array(out)

if __name__ == "__main__":
    p0 = [2000, 400, 200, 0.3, 500, 95]
    r = least_squares(resid, p0, bounds=([200, 80, 50, -0.5, 0, 80], [20000, 5000, 3000, 1.2, 1000, 110]))
    print(r.x.tolist(), resid(r.x).round(2).tolist())
