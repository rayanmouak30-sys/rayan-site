#!/usr/bin/env python3
"""ECO SURVIVOR - generateur des images originales du jeu.

Toutes les images (personnage, dechets, voitures, arbres, icones, logo, textures)
sont DESSINEES PAR CE PROGRAMME : aucune image externe n'est utilisee.

Usage (depuis le dossier ECO_SURVIVOR) :  python3 tools/generate_art.py
Dependances : Python 3, Pillow, numpy.

Technique : chaque image est dessinee 4 fois plus grande (sur-echantillonnage)
puis reduite, ce qui donne des bords lisses (anti-crenelage).
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")
UI = os.path.join(ROOT, "assets", "ui")
FONTS = os.path.join(ROOT, "assets", "fonts")
SS = 4
random.seed(42)
np.random.seed(42)


# ---------------------------------------------------------------------------
# Outils de base
# ---------------------------------------------------------------------------
def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def new(w, h):
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def S(v):
    return int(round(v * SS))


def ell(cx, cy, rx, ry):
    return [S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)]


def rect(x0, y0, x1, y1):
    return [S(x0), S(y0), S(x1), S(y1)]


def finish(img, w, h):
    return img.resize((w, h), Image.LANCZOS)


def save(img, *path):
    full = os.path.join(*path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full, optimize=True)
    return full


def outline(img, px, color):
    """Ajoute un contour colore autour de l'image (dilatation de l'alpha)."""
    a = img.split()[3]
    size = S(px) * 2 + 1
    if size % 2 == 0:
        size += 1
    dil = a.filter(ImageFilter.MaxFilter(size))
    base = Image.new("RGBA", img.size, color[:3] + (0,))
    base.putalpha(dil.point(lambda v: v * color[3] // 255))
    return Image.alpha_composite(base, img)


def glow_under(img, radius, color, strength=1.0):
    a = img.split()[3].filter(ImageFilter.GaussianBlur(S(radius)))
    a = a.point(lambda v: min(255, int(v * strength)))
    g = Image.new("RGBA", img.size, color[:3] + (0,))
    g.putalpha(a.point(lambda v: v * color[3] // 255))
    return Image.alpha_composite(g, img)


def gradient(size, c1, c2, vertical=True):
    w, h = size
    if vertical:
        t = np.linspace(0, 1, h)[:, None].repeat(w, 1)
    else:
        t = np.linspace(0, 1, w)[None, :].repeat(h, 0)
    c1 = np.array(c1, float)
    c2 = np.array(c2, float)
    arr = c1[None, None, :] * (1 - t[..., None]) + c2[None, None, :] * t[..., None]
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def paste_grad(img, mask_shape_fn, c1, c2, vertical=True):
    """Remplit une forme (dessinee par mask_shape_fn sur un masque) avec un degrade."""
    mask = Image.new("L", img.size, 0)
    mask_shape_fn(ImageDraw.Draw(mask))
    g = gradient(img.size, c1, c2, vertical)
    img.paste(g, (0, 0), mask)


def layer(img):
    return Image.new("RGBA", img.size, (0, 0, 0, 0))


def comp(a, b):
    return Image.alpha_composite(a, b)


# ---------------------------------------------------------------------------
# Textures generiques (particules, halos, ombres)
# ---------------------------------------------------------------------------
def radial(size, inner=1.0, power=2.0, color=(255, 255, 255)):
    y, x = np.mgrid[0:size, 0:size]
    c = (size - 1) / 2
    d = np.sqrt((x - c) ** 2 + (y - c) ** 2) / c
    a = np.clip(1 - d, 0, 1) ** power * inner
    arr = np.zeros((size, size, 4), np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def make_generic():
    save(radial(128, 1.0, 1.8), SPR, "fx", "glow.png")
    save(radial(32, 1.0, 1.2), SPR, "fx", "dot.png")
    # ombre douce (ellipse noire floutee)
    img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([14, 12, 114, 52], fill=(0, 0, 0, 200))
    img = img.filter(ImageFilter.GaussianBlur(8))
    save(img, SPR, "fx", "shadow.png")
    # etincelle a 4 branches
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    d.polygon([(S(16), S(1)), (S(18.5), S(13.5)), (S(31), S(16)), (S(18.5), S(18.5)),
               (S(16), S(31)), (S(13.5), S(18.5)), (S(1), S(16)), (S(13.5), S(13.5))], fill=(255, 255, 255, 255))
    img = glow_under(img, 2, (255, 255, 255, 255), 1.5)
    save(finish(img, 32, 32), SPR, "fx", "spark.png")
    # fumee : nuage doux irregulier
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(9):
        r = random.randint(14, 24)
        cx, cy = 48 + random.randint(-14, 14), 48 + random.randint(-14, 14)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 120))
    img = img.filter(ImageFilter.GaussianBlur(7))
    save(img, SPR, "fx", "smoke.png")
    # feuille
    img = new(32, 32)
    d = ImageDraw.Draw(img)
    d.chord(ell(16, 16, 13, 7), 0, 360, fill=(255, 255, 255, 255))
    lay = layer(img)
    ImageDraw.Draw(lay).polygon([(S(3), S(16)), (S(16), S(9)), (S(29), S(16)), (S(16), S(23))], fill=(255, 255, 255, 255))
    img = comp(img, lay).rotate(35, resample=Image.BICUBIC)
    ImageDraw.Draw(img).line([S(6), S(22), S(26), S(10)], fill=(200, 200, 200, 255), width=S(1.2))
    save(finish(img, 32, 32), SPR, "fx", "leaf.png")
    # confetti
    img = Image.new("RGBA", (16, 8), (255, 255, 255, 255))
    save(img, SPR, "fx", "confetti.png")
    # anneau
    img = new(128, 128)
    ImageDraw.Draw(img).ellipse(ell(64, 64, 58, 58), outline=(255, 255, 255, 255), width=S(5))
    img = glow_under(img, 4, (255, 255, 255, 255), 1.2)
    save(finish(img, 128, 128), SPR, "fx", "ring.png")
    # fleche indicatrice
    img = new(64, 64)
    d = ImageDraw.Draw(img)
    d.polygon([(S(58), S(32)), (S(14), S(10)), (S(24), S(32)), (S(14), S(54))], fill=(255, 255, 255, 255))
    img = outline(img, 2, hexc("#0b1a20"))
    save(finish(img, 64, 64), SPR, "fx", "arrow.png")
    # texture de bruit raccordable (pour le brouillard de pollution)
    n = 256
    freq = np.fft.fftfreq(n)
    fx, fy = np.meshgrid(freq, freq)
    f = np.sqrt(fx ** 2 + fy ** 2)
    f[0, 0] = 1
    spec = (np.random.randn(n, n) + 1j * np.random.randn(n, n)) / (f ** 1.6)
    spec[0, 0] = 0
    noise = np.real(np.fft.ifft2(spec))
    noise = (noise - noise.min()) / (noise.max() - noise.min())
    save(Image.fromarray((noise * 255).astype(np.uint8), "L"), SPR, "fx", "noise.png")


# ---------------------------------------------------------------------------
# Personnage (vue du dessus, regarde vers le haut)
# ---------------------------------------------------------------------------
def draw_player(phase, moving, breath=0.0):
    W = 96
    img = new(W, W)
    cx, cy = 48, 50
    sw = math.sin(phase) if moving else 0.0
    leg = 13 * sw
    arm = -7 * sw
    d = ImageDraw.Draw(img)
    # jambes + chaussures
    for side, off in ((-1, leg), (1, -leg)):
        x = cx + side * 8
        fy = cy + 2 - off
        d.line([S(x), S(cy + 2), S(x), S(fy)], fill=hexc("#253049"), width=S(8))
        d.ellipse(ell(x, fy, 5, 6.5), fill=hexc("#1a1f2b"))
        d.ellipse(ell(x - 1, fy - 1.5, 2.5, 2.5), fill=hexc("#3a4a63"))
    # bras + gants
    for side, off in ((-1, arm), (1, -arm)):
        sx = cx + side * 15
        hx = cx + side * 17.5
        hy = cy - 2 - off
        d.line([S(sx), S(cy - 1), S(hx), S(hy)], fill=hexc("#139e8e"), width=S(7))
        if side == 1:
            # pince ramasse-dechets tenue dans la main droite
            d.line([S(hx), S(hy), S(hx + 1), S(hy - 22)], fill=hexc("#cfd8dc"), width=S(2.6))
            d.line([S(hx + 1), S(hy - 22), S(hx - 3), S(hy - 27)], fill=hexc("#a6ff4d"), width=S(2.4))
            d.line([S(hx + 1), S(hy - 22), S(hx + 5), S(hy - 27)], fill=hexc("#a6ff4d"), width=S(2.4))
        d.ellipse(ell(hx, hy, 4.2, 4.2), fill=hexc("#ffd166"))
    # torse (veste) avec degrade
    br = 1 + breath * 0.03
    paste_grad(img, lambda m: m.ellipse(ell(cx, cy + 1, 17 * br, 11 * br), fill=255),
               hexc("#3ef2d0"), hexc("#0f8f86"))
    d = ImageDraw.Draw(img)
    # bandes reflechissantes
    d.arc(ell(cx, cy + 1, 13, 7.5), 200, 340, fill=hexc("#c6ff3d"), width=S(2.2))
    # sac a dos (recyclage)
    paste_grad(img, lambda m: m.rounded_rectangle(rect(cx - 10, cy + 3, cx + 10, cy + 17), radius=S(4), fill=255),
               hexc("#5cc95f"), hexc("#2b7d3a"))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(rect(cx - 6, cy + 8, cx + 6, cy + 11), radius=S(1.5), fill=hexc("#a6ff4d"))
    d.ellipse(ell(cx, cy + 14, 2, 2), fill=hexc("#e9fff0"))
    # tete : casque + visiere lumineuse
    hy = cy - 4
    paste_grad(img, lambda m: m.ellipse(ell(cx, hy, 10.5, 10.5), fill=255), hexc("#ffffff"), hexc("#a9bcc2"))
    d = ImageDraw.Draw(img)
    vis = layer(img)
    ImageDraw.Draw(vis).chord(ell(cx, hy, 9, 9), 218, 322, fill=hexc("#42f5e0"))
    vis = glow_under(vis, 2.5, hexc("#42f5e0"), 1.4)
    img = comp(img, vis)
    d = ImageDraw.Draw(img)
    d.chord(ell(cx - 3, hy - 3, 5, 4), 200, 290, fill=(255, 255, 255, 150))
    d.ellipse(ell(cx, hy + 5, 1.6, 1.6), fill=hexc("#a6ff4d"))
    img = outline(img, 1.6, hexc("#0c1820"))
    return finish(img, W, W)


def make_player():
    frames = 8
    for i in range(frames):
        save(draw_player(i / frames * 2 * math.pi, True), SPR, "player", f"walk_{i}.png")
    for i in range(4):
        save(draw_player(0, False, math.sin(i / 4 * 2 * math.pi)), SPR, "player", f"idle_{i}.png")


# ---------------------------------------------------------------------------
# Objets a ramasser
# ---------------------------------------------------------------------------
def rotated(img, angle):
    return img.rotate(angle, resample=Image.BICUBIC, center=(img.width / 2, img.height / 2))


def item_plastic():
    img = new(64, 64)
    paste_grad(img, lambda m: m.rounded_rectangle(rect(22, 14, 42, 54), radius=S(7), fill=255),
               hexc("#b9ecff", 235), hexc("#3aa7e8", 235), vertical=False)
    d = ImageDraw.Draw(img)
    d.polygon([(S(25), S(15)), (S(39), S(15)), (S(36), S(8)), (S(28), S(8))], fill=hexc("#8fd8ff", 235))
    d.rounded_rectangle(rect(27.5, 2, 36.5, 9), radius=S(2), fill=hexc("#1565c0"))
    d.rectangle(rect(22, 28, 42, 39), fill=hexc("#ffffff"))
    d.rectangle(rect(22, 31, 42, 35), fill=hexc("#1e88e5"))
    d.line([S(26), S(17), S(26), S(52)], fill=(255, 255, 255, 190), width=S(2.2))
    img = rotated(img, -35)
    img = outline(img, 1.4, hexc("#0d2a40"))
    return finish(img, 64, 64)


def item_paper():
    img = new(64, 64)
    d = ImageDraw.Draw(img)
    d.polygon([(S(12), S(14)), (S(46), S(10)), (S(52), S(48)), (S(18), S(53))], fill=hexc("#f5ecd2"))
    d.polygon([(S(46), S(10)), (S(52), S(48)), (S(44), S(30))], fill=hexc("#d9caa0"))
    for i, y in enumerate((18, 24, 30, 36, 42)):
        w = 22 if i else 26
        d.line([S(17), S(y + 1 - i * 0.4), S(17 + w), S(y - 2 - i * 0.4)], fill=hexc("#8a7f6a" if i else "#c0392b"),
               width=S(3.0 if i == 0 else 1.6))
    d.rectangle(rect(30, 33, 40, 44), fill=hexc("#b8a77d"))
    img = rotated(img, 12)
    img = outline(img, 1.4, hexc("#3a2f12"))
    return finish(img, 64, 64)


def item_glass():
    img = new(64, 64)
    paste_grad(img, lambda m: (m.rounded_rectangle(rect(21, 22, 43, 58), radius=S(7), fill=255),
                               m.polygon([(S(23), S(25)), (S(41), S(25)), (S(35), S(12)), (S(29), S(12))], fill=255),
                               m.rectangle(rect(28.5, 3, 35.5, 14), fill=255)),
               hexc("#7dffb0", 240), hexc("#128a4a", 240), vertical=False)
    d = ImageDraw.Draw(img)
    d.rectangle(rect(28, 3, 36, 7), fill=hexc("#d4af37"))
    d.rounded_rectangle(rect(21, 36, 43, 48), radius=S(2), fill=hexc("#f7f1dc"))
    d.ellipse(ell(32, 42, 4, 3.5), fill=hexc("#7a1f2b"))
    d.line([S(25), S(26), S(25), S(55)], fill=(255, 255, 255, 170), width=S(2.2))
    img = rotated(img, 38)
    img = outline(img, 1.4, hexc("#06301a"))
    return finish(img, 64, 64)


def item_ewaste():
    img = new(64, 64)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(rect(19, 6, 45, 58), radius=S(6), fill=hexc("#2b2f3a"))
    paste_grad(img, lambda m: m.rounded_rectangle(rect(22, 11, 42, 51), radius=S(2), fill=255),
               hexc("#7b5cff"), hexc("#00e5ff"))
    d = ImageDraw.Draw(img)
    for a, b in (((26, 16), (33, 27)), ((33, 27), (30, 38)), ((33, 27), (40, 31)), ((30, 38), (37, 47))):
        d.line([S(a[0]), S(a[1]), S(b[0]), S(b[1])], fill=(255, 255, 255, 220), width=S(1.3))
    d.ellipse(ell(32, 54.5, 2, 2), fill=hexc("#555b6a"))
    d.rounded_rectangle(rect(28, 7.5, 36, 9.5), radius=S(1), fill=hexc("#555b6a"))
    # petite puce electronique
    d.rectangle(rect(40, 36, 52, 48), fill=hexc("#1f7a3e"))
    d.rectangle(rect(43, 39, 49, 45), fill=hexc("#1a1a1a"))
    for k in range(3):
        d.line([S(44 + k * 2), S(36), S(44 + k * 2), S(33)], fill=hexc("#ffcf4d"), width=S(1))
    img = rotated(img, -18)
    img = outline(img, 1.4, hexc("#0f0a24"))
    return finish(img, 64, 64)


def heart_shape(d, cx, cy, s, fill):
    d.ellipse(ell(cx - s * 0.5, cy - s * 0.25, s * 0.55, s * 0.55), fill=fill)
    d.ellipse(ell(cx + s * 0.5, cy - s * 0.25, s * 0.55, s * 0.55), fill=fill)
    d.polygon([(S(cx - s * 1.03), S(cy - s * 0.05)), (S(cx + s * 1.03), S(cy - s * 0.05)), (S(cx), S(cy + s * 1.05))],
              fill=fill)


def item_health():
    img = new(64, 64)
    paste_grad(img, lambda m: heart_shape(m, 32, 34, 20, 255), hexc("#ff8fa3"), hexc("#e0244a"))
    d = ImageDraw.Draw(img)
    d.ellipse(ell(23, 26, 5, 4), fill=(255, 255, 255, 170))
    # feuille sur le coeur
    leaf = layer(img)
    ImageDraw.Draw(leaf).chord(ell(41, 13, 9, 4.5), 0, 360, fill=hexc("#5fdc5f"))
    leaf = rotated(leaf, -30)
    img = comp(img, leaf)
    d = ImageDraw.Draw(img)
    d.line([S(32), S(20), S(38), S(13)], fill=hexc("#2e7d32"), width=S(2))
    d.rectangle(rect(29, 31, 35, 45), fill=(255, 255, 255, 235))
    d.rectangle(rect(25, 35, 39, 41), fill=(255, 255, 255, 235))
    img = outline(img, 1.4, hexc("#3d0a14"))
    return finish(img, 64, 64)


def bolt(d, ox, oy, s, fill):
    pts = [(0.15, -1.0), (-0.45, 0.12), (-0.02, 0.12), (-0.2, 1.0), (0.45, -0.18), (0.02, -0.18)]
    d.polygon([(S(ox + x * s), S(oy + y * s)) for x, y in pts], fill=fill)


def item_energy():
    img = new(64, 64)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(rect(18, 12, 46, 58), radius=S(6), fill=hexc("#1e2a33"))
    d.rounded_rectangle(rect(26, 6, 38, 13), radius=S(2), fill=hexc("#90a4ae"))
    paste_grad(img, lambda m: m.rounded_rectangle(rect(22, 22, 42, 54), radius=S(3), fill=255),
               hexc("#d9ff7a"), hexc("#3fbf3f"))
    d = ImageDraw.Draw(img)
    bolt(d, 32, 37, 14, hexc("#fff59d"))
    bolt(d, 32, 37, 9, hexc("#ffffff"))
    img = outline(img, 1.4, hexc("#0b1a10"))
    return finish(img, 64, 64)


def item_toxic():
    W = 80
    img = new(W, W)
    d = ImageDraw.Draw(img)
    # flaque toxique
    pud = layer(img)
    pd = ImageDraw.Draw(pud)
    for (x, y, r) in ((40, 56, 22), (24, 58, 10), (58, 60, 11), (48, 66, 9), (30, 66, 8)):
        pd.ellipse(ell(x, y, r * 1.2, r * 0.75), fill=hexc("#7dff3a", 230))
    pud = glow_under(pud, 3, hexc("#b6ff00"), 1.2)
    img = comp(img, pud)
    d = ImageDraw.Draw(img)
    # baril (corps + couvercle vus en 3/4)
    paste_grad(img, lambda m: m.rectangle(rect(22, 22, 58, 58), fill=255), hexc("#ffd54f"), hexc("#c99a06"),
               vertical=False)
    d = ImageDraw.Draw(img)
    d.ellipse(ell(40, 58, 18, 6), fill=hexc("#b8890a"))
    paste_grad(img, lambda m: m.rectangle(rect(22, 22, 58, 58), fill=255), hexc("#ffd54f"), hexc("#c99a06"),
               vertical=False)
    d = ImageDraw.Draw(img)
    for y in (34, 46):
        d.rectangle(rect(22, y, 58, y + 4), fill=hexc("#2b2b2b"))
    d.ellipse(ell(40, 22, 18, 7), fill=hexc("#ffe082"))
    d.ellipse(ell(40, 22, 14, 5), fill=hexc("#f1c232"))
    # symbole danger (trefle)
    for a in (90, 210, 330):
        d.pieslice(ell(40, 22, 7, 3.4), a - 30, a + 30, fill=hexc("#1c1c1c"))
    d.ellipse(ell(40, 22, 1.4, 0.8), fill=hexc("#f1c232"))
    # coulure verte
    d.polygon([(S(30), S(22)), (S(35), S(22)), (S(34), S(40)), (S(31), S(42))], fill=hexc("#7dff3a"))
    d.ellipse(ell(32.5, 42, 2.4, 2.4), fill=hexc("#7dff3a"))
    img = outline(img, 1.4, hexc("#1a1500"))
    return finish(img, W, W)


def make_items():
    for name, fn in (("plastic", item_plastic), ("paper", item_paper), ("glass", item_glass),
                     ("ewaste", item_ewaste), ("bonus_health", item_health), ("bonus_energy", item_energy),
                     ("toxic_barrel", item_toxic)):
        save(fn(), SPR, "items", name + ".png")


# ---------------------------------------------------------------------------
# Voitures (vue du dessus, regardent vers la droite)
# ---------------------------------------------------------------------------
def make_car(name, body1, body2, length=96, width=46, truck=False):
    W, H = length + 8, width + 8
    img = new(W, H)
    x0, y0, x1, y1 = 4, 4, 4 + length, 4 + width
    if truck:
        # remorque (bennes de dechets non tries) + cabine
        paste_grad(img, lambda m: m.rounded_rectangle(rect(x0, y0, x0 + length * 0.68, y1), radius=S(5), fill=255),
                   hexc(body1), hexc(body2))
        d = ImageDraw.Draw(img)
        for k in range(5):
            xx = x0 + 6 + k * (length * 0.68 - 12) / 5
            d.line([S(xx), S(y0 + 4), S(xx), S(y1 - 4)], fill=(0, 0, 0, 60), width=S(2))
        paste_grad(img, lambda m: m.rounded_rectangle(rect(x0 + length * 0.70, y0 + 2, x1, y1 - 2), radius=S(8),
                                                      fill=255), hexc("#eceff1"), hexc("#90a4ae"))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle(rect(x1 - 14, y0 + 6, x1 - 5, y1 - 6), radius=S(3), fill=hexc("#1b2a35"))
        # pot d'echappement
        d.ellipse(ell(x0 + length * 0.69, y0 + 3, 3, 3), fill=hexc("#333333"))
    else:
        paste_grad(img, lambda m: m.rounded_rectangle(rect(x0, y0, x1, y1), radius=S(14), fill=255),
                   hexc(body1), hexc(body2))
        d = ImageDraw.Draw(img)
        # toit / vitres
        d.rounded_rectangle(rect(x0 + length * 0.30, y0 + 6, x0 + length * 0.74, y1 - 6), radius=S(8),
                            fill=hexc("#16222c"))
        paste_grad(img, lambda m: m.rounded_rectangle(rect(x0 + length * 0.36, y0 + 8, x0 + length * 0.66, y1 - 8),
                                                      radius=S(6), fill=255), hexc(body1), hexc(body2))
        d = ImageDraw.Draw(img)
        d.line([S(x0 + length * 0.70), S(y0 + 10), S(x0 + length * 0.70), S(y1 - 10)], fill=(140, 220, 255, 120),
               width=S(2))
        # retroviseurs
        d.ellipse(ell(x0 + length * 0.62, y0 - 0.5, 4, 2.5), fill=hexc(body2))
        d.ellipse(ell(x0 + length * 0.62, y1 + 0.5, 4, 2.5), fill=hexc(body2))
        # reflet
        d.line([S(x0 + 10), S(y0 + 6), S(x0 + length * 0.28), S(y0 + 6)], fill=(255, 255, 255, 110), width=S(2))
    d = ImageDraw.Draw(img)
    # phares (avant = droite) et feux (arriere = gauche)
    for yy in (y0 + 7, y1 - 7):
        d.ellipse(ell(x1 - 4, yy, 3.2, 4), fill=hexc("#fffbe0"))
        d.rectangle(rect(x0 + 1, yy - 4, x0 + 4, yy + 4), fill=hexc("#ff1744"))
    img = outline(img, 1.2, hexc("#0b0f14"))
    save(finish(img, W, H), SPR, "cars", name + ".png")


def make_cars():
    make_car("car_red", "#ff6b6b", "#b71c1c")
    make_car("car_orange", "#ffb74d", "#e65100")
    make_car("car_grey", "#cfd8dc", "#607d8b")
    make_car("car_purple", "#b388ff", "#5e35b1")
    make_car("truck", "#8d6e63", "#4e342e", length=132, width=52, truck=True)
    # cone de lumiere des phares
    w, h = 160, 96
    y, x = np.mgrid[0:h, 0:w]
    ang = np.abs((y - h / 2) / np.maximum(x, 1))
    a = np.clip(1 - x / w, 0, 1) * np.clip(1 - ang / 0.45, 0, 1)
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., :3] = 255
    arr[..., 3] = (a ** 1.5 * 255).astype(np.uint8)
    save(Image.fromarray(arr, "RGBA"), SPR, "cars", "headlight.png")


# ---------------------------------------------------------------------------
# Arbres (feuillage) et decor
# ---------------------------------------------------------------------------
def make_tree(name, size, palette, flowers=None, seed=0):
    rnd = random.Random(seed)
    img = new(size, size)
    c = size / 2
    R = size * 0.42
    d = ImageDraw.Draw(img)
    blobs = []
    for _ in range(9):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, R * 0.45)
        blobs.append((c + math.cos(a) * r, c + math.sin(a) * r, rnd.uniform(R * 0.45, R * 0.6)))
    blobs.append((c, c, R * 0.62))
    for x, y, r in blobs:
        d.ellipse(ell(x, y, r, r), fill=hexc(palette[0]))
    for x, y, r in blobs:
        d.ellipse(ell(x - r * 0.12, y - r * 0.14, r * 0.82, r * 0.82), fill=hexc(palette[1]))
    for x, y, r in blobs:
        d.ellipse(ell(x - r * 0.28, y - r * 0.3, r * 0.45, r * 0.45), fill=hexc(palette[2]))
    if flowers:
        for _ in range(int(size / 5)):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0, R * 0.85)
            x, y = c + math.cos(a) * r, c + math.sin(a) * r
            d.ellipse(ell(x, y, 1.8, 1.8), fill=hexc(flowers))
    img = outline(img, 1.3, hexc("#0e2414", 220))
    save(finish(img, size, size), SPR, "decor", name + ".png")


def make_decor():
    make_tree("tree_green", 120, ("#2e7d32", "#43a047", "#7cd36b"), seed=1)
    make_tree("tree_lime", 104, ("#558b2f", "#7cb342", "#c5e86c"), flowers="#fff59d", seed=2)
    make_tree("tree_blossom", 112, ("#ad1457", "#ec407a", "#f8bbd0"), flowers="#ffffff", seed=3)
    # rotor d'eolienne
    img = new(112, 112)
    d = ImageDraw.Draw(img)
    for k in range(3):
        a = k * 2 * math.pi / 3
        tip = (56 + math.cos(a) * 52, 56 + math.sin(a) * 52)
        side = (56 + math.cos(a + 0.22) * 18, 56 + math.sin(a + 0.22) * 18)
        side2 = (56 + math.cos(a - 0.1) * 12, 56 + math.sin(a - 0.1) * 12)
        d.polygon([(S(56), S(56)), (S(side[0]), S(side[1])), (S(tip[0]), S(tip[1])), (S(side2[0]), S(side2[1]))],
                  fill=hexc("#f5f7f8"))
    d.ellipse(ell(56, 56, 7, 7), fill=hexc("#b0bec5"))
    d.ellipse(ell(56, 56, 3, 3), fill=hexc("#42f5e0"))
    img = outline(img, 1.2, hexc("#24323a"))
    save(finish(img, 112, 112), SPR, "decor", "turbine_rotor.png")


# ---------------------------------------------------------------------------
# Icones d'interface
# ---------------------------------------------------------------------------
def make_icons():
    # coeurs
    for name, c1, c2, empty in (("heart", "#ff8fa3", "#e0244a", False), ("heart_empty", "#3b4651", "#26303a", True)):
        img = new(48, 48)
        paste_grad(img, lambda m: heart_shape(m, 24, 25, 15, 255), hexc(c1), hexc(c2))
        d = ImageDraw.Draw(img)
        if not empty:
            d.ellipse(ell(17, 19, 4, 3), fill=(255, 255, 255, 180))
        img = outline(img, 1.6, hexc("#0a1014"))
        save(finish(img, 48, 48), UI, name + ".png")
    # eclair
    img = new(48, 48)
    d = ImageDraw.Draw(img)
    bolt(d, 24, 24, 19, hexc("#d9ff5c"))
    img = glow_under(outline(img, 1.4, hexc("#0a1014")), 2, hexc("#a6ff4d"), 1.0)
    save(finish(img, 48, 48), UI, "energy.png")
    # horloge
    img = new(48, 48)
    d = ImageDraw.Draw(img)
    d.ellipse(ell(24, 24, 19, 19), fill=hexc("#e8fbff"))
    d.ellipse(ell(24, 24, 19, 19), outline=hexc("#3ef2d0"), width=S(3.5))
    d.line([S(24), S(24), S(24), S(13)], fill=hexc("#16323a"), width=S(3))
    d.line([S(24), S(24), S(32), S(28)], fill=hexc("#16323a"), width=S(3))
    img = outline(img, 1.4, hexc("#0a1014"))
    save(finish(img, 48, 48), UI, "clock.png")
    # etoiles (ecran de victoire)
    for name, c1, c2 in (("star", "#fff59d", "#ffb300"), ("star_empty", "#3b4651", "#222b33")):
        img = new(96, 96)
        pts = []
        for k in range(10):
            r = 44 if k % 2 == 0 else 19
            a = -math.pi / 2 + k * math.pi / 5
            pts.append((S(48 + math.cos(a) * r), S(50 + math.sin(a) * r)))
        paste_grad(img, lambda m: m.polygon(pts, fill=255), hexc(c1), hexc(c2))
        img = outline(img, 2, hexc("#0a1014"))
        save(finish(img, 96, 96), UI, name + ".png")
    # trophee
    img = new(64, 64)
    paste_grad(img, lambda m: (m.chord(ell(32, 18, 18, 22), 0, 180, fill=255), m.rectangle(rect(14, 6, 50, 19), fill=255)),
               hexc("#fff59d"), hexc("#ff9800"))
    d = ImageDraw.Draw(img)
    d.arc(ell(14, 20, 8, 8), 90, 270, fill=hexc("#ffb300"), width=S(3))
    d.arc(ell(50, 20, 8, 8), 270, 90, fill=hexc("#ffb300"), width=S(3))
    d.rectangle(rect(29, 39, 35, 50), fill=hexc("#ffb300"))
    d.rounded_rectangle(rect(20, 50, 44, 58), radius=S(2), fill=hexc("#6d4c41"))
    img = outline(img, 1.4, hexc("#0a1014"))
    save(finish(img, 64, 64), UI, "trophy.png")
    # pollution (crane dans un nuage)
    img = new(48, 48)
    d = ImageDraw.Draw(img)
    for x, y, r in ((16, 28, 10), (26, 22, 12), (35, 29, 9), (24, 32, 10)):
        d.ellipse(ell(x, y, r, r), fill=hexc("#9ccc65"))
    d.ellipse(ell(25, 26, 7, 6.5), fill=hexc("#1c2a1a"))
    d.ellipse(ell(22.5, 25.5, 1.8, 2), fill=hexc("#9ccc65"))
    d.ellipse(ell(27.5, 25.5, 1.8, 2), fill=hexc("#9ccc65"))
    img = outline(img, 1.4, hexc("#0a1014"))
    save(finish(img, 48, 48), UI, "pollution.png")


# ---------------------------------------------------------------------------
# Logo, icone du projet, ecran de demarrage
# ---------------------------------------------------------------------------
def leaf_emblem(size):
    img = new(size, size)
    c = size / 2
    d = ImageDraw.Draw(img)
    d.ellipse(ell(c, c, c * 0.92, c * 0.92), fill=hexc("#0d2b31"))
    d.ellipse(ell(c, c, c * 0.92, c * 0.92), outline=hexc("#3ef2d0"), width=S(size * 0.04))
    leaf = layer(img)
    paste_grad(leaf, lambda m: m.chord(ell(c, c, c * 0.62, c * 0.34), 0, 360, fill=255), hexc("#d4ff5c"),
               hexc("#2fbf4a"), vertical=False)
    ld = ImageDraw.Draw(leaf)
    ld.line([S(c - c * 0.6), S(c), S(c + c * 0.55), S(c)], fill=hexc("#1b6b2a"), width=S(size * 0.025))
    for k in range(-2, 3):
        x = c + k * c * 0.18
        ld.line([S(x), S(c), S(x + c * 0.12), S(c - c * 0.2)], fill=hexc("#1b6b2a"), width=S(size * 0.015))
        ld.line([S(x), S(c), S(x + c * 0.12), S(c + c * 0.2)], fill=hexc("#1b6b2a"), width=S(size * 0.015))
    leaf = rotated(leaf, 40)
    img = comp(img, leaf)
    return img


def make_logo():
    W, H = 980, 240
    f_big = ImageFont.truetype(os.path.join(FONTS, "Orbitron-Black.ttf"), 170)
    probe = ImageDraw.Draw(Image.new("L", (10, 10)))
    w1 = probe.textlength("ECO", font=f_big)
    w2 = probe.textlength("SURVIVOR", font=f_big)
    emb = 300
    cw = int(40 + emb + 50 + w1 + 50 + w2 + 60)
    ch = 420
    img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    emblem = leaf_emblem(120).resize((emb, emb), Image.LANCZOS)
    img.alpha_composite(emblem, (40, (ch - emb) // 2))
    x1 = 40 + emb + 50
    ty = (ch - 170) // 2 - 30
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).text((x1, ty), "ECO", font=f_big, fill=255)
    t1 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    t1.paste(gradient(img.size, hexc("#e4ff6b"), hexc("#2fd16a")), (0, 0), m)
    m2 = Image.new("L", img.size, 0)
    ImageDraw.Draw(m2).text((x1 + w1 + 50, ty), "SURVIVOR", font=f_big, fill=255)
    t2 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    t2.paste(gradient(img.size, hexc("#ffffff"), hexc("#3ef2d0")), (0, 0), m2)
    text = Image.alpha_composite(t1, t2)
    text = outline(text, 1.5, hexc("#06141a"))
    text = glow_under(text, 4, hexc("#3ef2d0", 190), 1.0)
    img = Image.alpha_composite(img, text)
    img = img.crop(img.getbbox())
    img.thumbnail((W, H), Image.LANCZOS)
    save(img, UI, "logo.png")
    # icone du projet (256x256)
    ic = Image.new("RGBA", (256 * SS, 256 * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(ic)
    d.rounded_rectangle([0, 0, 256 * SS - 1, 256 * SS - 1], radius=S(52), fill=hexc("#0a1d22"))
    em = leaf_emblem(220)
    ic.alpha_composite(em, (S(18), S(18)))
    save(finish(ic, 256, 256), ROOT, "icon.png")
    # ecran de demarrage (affiche pendant le chargement, surtout sur le Web)
    sp = Image.new("RGBA", (640, 360), (0, 0, 0, 0))
    lg = Image.open(os.path.join(UI, "logo.png"))
    lg.thumbnail((600, 180), Image.LANCZOS)
    sp.alpha_composite(lg, ((640 - lg.width) // 2, (360 - lg.height) // 2))
    save(sp, UI, "splash.png")


if __name__ == "__main__":
    make_generic()
    make_player()
    make_items()
    make_cars()
    make_decor()
    make_icons()
    make_logo()
    print("Images generees dans assets/")
