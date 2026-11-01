#!/usr/bin/env python3
"""ECO SURVIVOR - generateur de la ville (image du sol + scene Main.tscn).

Le plan de la ville est decrit dans ce fichier (routes, batiments, parcs...).
Le programme :
  1. dessine l'image du sol  -> assets/backgrounds/city_ground.png (2560 x 1600)
  2. dessine une version floutee pour les menus -> assets/backgrounds/city_blur.png
  3. ecrit la scene de jeu   -> scenes/Main.tscn
     (collisions des batiments, arbres, stations de tri, voies de circulation...)

Ainsi l'image et les collisions correspondent toujours exactement.
Usage (depuis le dossier ECO_SURVIVOR) : python3 tools/generate_city.py
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_W, MAP_H = 2560, 1600
SS = 2  # sur-echantillonnage
SIDEWALK = 28
rnd = random.Random(2024)

ROADS_H = [512, 1088]          # centres des routes horizontales (y)
ROADS_V = [640, 1344, 1984]    # centres des routes verticales (x)
ROAD_HALF = 64
COLS = [(0, 576), (704, 1280), (1408, 1920), (2048, 2560)]
ROWS = [(0, 448), (576, 1024), (1152, 1600)]


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def R(*v):
    return [int(round(x * SS)) for x in v]


# ---------------------------------------------------------------------------
# PLAN DE LA VILLE
# ---------------------------------------------------------------------------
# type de chaque quartier (colonne, ligne)
BLOCKS = {
    (0, 0): "residential", (1, 0): "industrial", (2, 0): "park", (3, 0): "office",
    (0, 1): "park", (1, 1): "plaza", (2, 1): "residential", (3, 1): "garden",
    (0, 2): "office", (1, 2): "plaza", (2, 2): "park", (3, 2): "industrial",
}

# batiments : (x, y, largeur, hauteur, hauteur de facade, style)
BUILDINGS = [
    # A1 residentiel
    (64, 60, 190, 150, 34, "green"), (320, 52, 196, 120, 28, "solar"), (300, 250, 216, 140, 30, "hvac"),
    # B1 usine polluante
    (770, 60, 300, 170, 40, "factory"), (1130, 60, 100, 220, 36, "warehouse"),
    # D1 bureaux
    (2110, 56, 180, 200, 46, "glass"), (2350, 60, 160, 140, 30, "solar"), (2330, 270, 180, 120, 26, "green"),
    # B2 place centrale : kiosque
    (1100, 650, 120, 84, 22, "kiosk"),
    # C2 residentiel
    (1470, 640, 170, 150, 30, "hvac"), (1700, 630, 170, 130, 28, "green"), (1480, 860, 390, 110, 26, "solar"),
    # A3 bureaux
    (60, 1210, 220, 170, 42, "glass"), (330, 1210, 190, 140, 30, "solar"),
    # B3 petite place
    (760, 1205, 140, 110, 28, "hvac"), (1090, 1455, 140, 90, 24, "green"),
    # D3 zone industrielle
    (2110, 1210, 260, 160, 40, "factory"),
]
# obstacles rectangulaires bas (conteneurs, bacs potagers) : (x, y, w, h, couleur)
CRATES = [
    (790, 300, 64, 60, "#c0392b"), (960, 320, 96, 32, "#2471a3"), (880, 380, 60, 28, "#d68910"),
    (2120, 1450, 124, 32, "#7d6608"), (2280, 1490, 70, 30, "#2471a3"),
]
BEDS = [(2100, 640, 100, 44), (2100, 720, 100, 44), (2100, 872, 100, 44), (2100, 952, 100, 40),
        (2410, 640, 100, 44), (2410, 952, 100, 40)]
# obstacles circulaires : (x, y, rayon, type)
CIRCLES = [
    (992, 760, 62, "fountain"),
    (2460, 1265, 48, "tank"), (2462, 1400, 42, "tank"),
]
# etangs (ellipses) : (x, y, rx, ry)
PONDS = [(1590, 180, 112, 72), (1720, 1385, 74, 48)]
# eoliennes au sol (rotor anime) : (x, y)
TURBINES = [(2160, 800), (2450, 800)]
# eoliennes sur les toits
ROOF_TURBINES = [(2430, 130), (430, 110)]
# cheminees d'usine (fumee animee) : (x, y)
CHIMNEYS = [(820, 120), (890, 120), (960, 120), (2170, 1265), (2240, 1265), (2310, 1265)]
# arbres : (x, y, variante 0..2)
TREES = [
    (110, 300, 0), (200, 372, 1), (70, 392, 2), (190, 262, 1),
    (1478, 64, 1), (1862, 70, 0), (1474, 372, 0), (1640, 392, 2), (1840, 180, 1), (1712, 300, 0),
    (2090, 330, 2), (2210, 390, 1),
    (90, 650, 0), (210, 640, 1), (480, 650, 2), (520, 760, 0), (70, 960, 1), (500, 960, 0), (150, 860, 2),
    (430, 890, 1), (60, 780, 0),
    (780, 650, 1), (780, 950, 2), (1200, 960, 0),
    (1660, 820, 0), (1880, 640, 2),
    (2300, 660, 0), (2300, 950, 1), (2510, 860, 2),
    (100, 1500, 1), (250, 1530, 0), (420, 1490, 2), (520, 1400, 0),
    (800, 1500, 0), (1210, 1230, 2), (1210, 1360, 1), (800, 1380, 1),
    (1480, 1225, 0), (1570, 1300, 1), (1860, 1220, 2), (1520, 1530, 2), (1860, 1460, 0), (1660, 1240, 1),
    (1600, 1480, 0),
]
PLAYER_START = (992, 900)


def block_rect(c, r):
    return COLS[c][0], ROWS[r][0], COLS[c][1], ROWS[r][1]


def inner_rect(c, r):
    x0, y0, x1, y1 = block_rect(c, r)
    return x0 + SIDEWALK, y0 + SIDEWALK, x1 - SIDEWALK, y1 - SIDEWALK


# ---------------------------------------------------------------------------
# Dessin
# ---------------------------------------------------------------------------
def noise_layer(w, h, amp, scale=1, seed=0):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (h // scale + 1, w // scale + 1))
    if scale > 1:
        n = np.kron(n, np.ones((scale, scale)))[:h, :w]
    return n * amp


def draw_ground():
    W, H = MAP_W * SS, MAP_H * SS
    img = Image.new("RGBA", (W, H), hexc("#6f7f8c"))
    d = ImageDraw.Draw(img)
    # dalles des trottoirs
    for x in range(0, MAP_W, 32):
        d.line(R(x, 0, x, MAP_H), fill=hexc("#647482"), width=SS)
    for y in range(0, MAP_H, 32):
        d.line(R(0, y, MAP_W, y), fill=hexc("#647482"), width=SS)

    # interieur des quartiers
    for (c, r), kind in BLOCKS.items():
        x0, y0, x1, y1 = inner_rect(c, r)
        if kind in ("park", "garden"):
            d.rounded_rectangle(R(x0, y0, x1, y1), radius=10 * SS, fill=hexc("#3f8f47"))
        elif kind == "plaza":
            d.rounded_rectangle(R(x0, y0, x1, y1), radius=10 * SS, fill=hexc("#9aa7ae"))
            for x in range(int(x0), int(x1), 48):
                d.line(R(x, y0, x, y1), fill=hexc("#8d9aa1"), width=SS)
            for y in range(int(y0), int(y1), 48):
                d.line(R(x0, y, x1, y), fill=hexc("#8d9aa1"), width=SS)
        elif kind == "industrial":
            d.rectangle(R(x0, y0, x1, y1), fill=hexc("#5b6064"))
            for x in range(int(x0), int(x1), 64):
                d.line(R(x, y0, x, y1), fill=hexc("#53585c"), width=SS)
        else:  # residential / office : cour pavee + pelouse
            d.rounded_rectangle(R(x0, y0, x1, y1), radius=8 * SS, fill=hexc("#8494a0"))
    # herbe : variations douces + touffes
    grass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grass)
    for (c, r), kind in BLOCKS.items():
        x0, y0, x1, y1 = inner_rect(c, r)
        if kind in ("park", "garden"):
            for _ in range(90):
                x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
                rr = rnd.uniform(14, 46)
                col = rnd.choice(["#4fa356", "#367d3e", "#47994d", "#3a8441"])
                gd.ellipse(R(x - rr, y - rr, x + rr, y + rr), fill=hexc(col, 80))
    grass = grass.filter(ImageFilter.GaussianBlur(10 * SS))
    img = Image.alpha_composite(img, grass)
    d = ImageDraw.Draw(img)
    # petites pelouses nettes dans les cours des immeubles
    for (c, r), kind in BLOCKS.items():
        if kind in ("residential", "office"):
            x0, y0, x1, y1 = inner_rect(c, r)
            d.rounded_rectangle(R(x0 + 12, y1 - 150, x0 + 230, y1 - 12), radius=14 * SS, fill=hexc("#3a8441"))
            d.rounded_rectangle(R(x0 + 18, y1 - 144, x0 + 224, y1 - 18), radius=11 * SS, fill=hexc("#43944a"))
    for (c, r), kind in BLOCKS.items():
        x0, y0, x1, y1 = inner_rect(c, r)
        if kind in ("park", "garden"):
            for _ in range(260):
                x, y = rnd.uniform(x0 + 6, x1 - 6), rnd.uniform(y0 + 6, y1 - 6)
                col = rnd.choice(["#6cc06a", "#2f7536", "#7fd47a"])
                d.line(R(x, y, x + rnd.uniform(-2, 2), y - rnd.uniform(3, 6)), fill=hexc(col), width=SS)
            for _ in range(40):
                x, y = rnd.uniform(x0 + 6, x1 - 6), rnd.uniform(y0 + 6, y1 - 6)
                col = rnd.choice(["#fff59d", "#f8bbd0", "#ffffff", "#b39ddb"])
                d.ellipse(R(x - 2, y - 2, x + 2, y + 2), fill=hexc(col))

    # chemins de gravier dans les parcs
    def path(points, width=26):
        pts = [tuple(R(*p)) for p in points]
        d.line(pts, fill=hexc("#a8976e"), width=(width + 6) * SS, joint="curve")
        for p in pts:
            rr = (width + 6) * SS // 2
            d.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=hexc("#a8976e"))
        d.line(pts, fill=hexc("#c9b98f"), width=width * SS, joint="curve")
        for p in pts:
            rr = width * SS // 2
            d.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=hexc("#c9b98f"))

    path([(28, 800), (150, 780), (288, 800), (420, 820), (548, 800)])
    path([(288, 604), (300, 700), (288, 800), (270, 900), (288, 996)])
    path([(1436, 330), (1560, 300), (1700, 330), (1790, 320), (1892, 300)])
    path([(1436, 1300), (1520, 1370), (1620, 1330), (1892, 1330)])
    path([(1660, 1180), (1640, 1300), (1620, 1330), (1640, 1572)])
    path([(2076, 800), (2304, 800), (2532, 800)])
    path([(2304, 604), (2304, 996)])

    # bacs potagers (jardins partages)
    for (x, y, w, h) in BEDS:
        d.rounded_rectangle(R(x, y, x + w, y + h), radius=4 * SS, fill=hexc("#8d6e63"))
        d.rounded_rectangle(R(x + 4, y + 4, x + w - 4, y + h - 4), radius=3 * SS, fill=hexc("#4e342e"))
        for k in range(int(w // 16)):
            cx = x + 10 + k * 16
            for j in range(int(h // 18)):
                cy = y + 12 + j * 16
                d.ellipse(R(cx - 5, cy - 5, cx + 5, cy + 5), fill=hexc(rnd.choice(["#66bb6a", "#9ccc65", "#43a047"])))
                if rnd.random() < 0.3:
                    d.ellipse(R(cx - 2, cy - 2, cx + 2, cy + 2), fill=hexc(rnd.choice(["#ff7043", "#ffca28"])))

    # pollution au sol autour des usines
    pol = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pol)
    for (c, r), kind in BLOCKS.items():
        if kind != "industrial":
            continue
        x0, y0, x1, y1 = inner_rect(c, r)
        for _ in range(26):
            x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
            rr = rnd.uniform(16, 50)
            pd.ellipse(R(x - rr, y - rr * 0.7, x + rr, y + rr * 0.7),
                       fill=hexc(rnd.choice(["#2e2a20", "#4a3f22", "#3b4a1e"]), 150))
    pol = pol.filter(ImageFilter.GaussianBlur(6 * SS))
    img = Image.alpha_composite(img, pol)
    d = ImageDraw.Draw(img)

    # ---------------- routes ----------------
    road_mask = Image.new("L", (W, H), 0)
    rm = ImageDraw.Draw(road_mask)
    for y in ROADS_H:
        rm.rectangle(R(0, y - ROAD_HALF, MAP_W, y + ROAD_HALF), fill=255)
    for x in ROADS_V:
        rm.rectangle(R(x - ROAD_HALF, 0, x + ROAD_HALF, MAP_H), fill=255)
    n = noise_layer(W, H, 5, 2, 3)
    base = np.zeros((H, W, 4), np.float32)
    base[..., 0] = 38 + n
    base[..., 1] = 47 + n
    base[..., 2] = 58 + n
    base[..., 3] = 255
    asphalt = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA")
    img.paste(asphalt, (0, 0), road_mask)
    d = ImageDraw.Draw(img)
    # bordures (trottoir)
    for y in ROADS_H:
        for yy in (y - ROAD_HALF, y + ROAD_HALF):
            d.line(R(0, yy, MAP_W, yy), fill=hexc("#4a5763"), width=4 * SS)
    for x in ROADS_V:
        for xx in (x - ROAD_HALF, x + ROAD_HALF):
            d.line(R(xx, 0, xx, MAP_H), fill=hexc("#4a5763"), width=4 * SS)
    for y in ROADS_H:
        d.rectangle(R(0, y - ROAD_HALF + 2, MAP_W, y + ROAD_HALF - 2), fill=None)
    # re-remplit les intersections (pas de bordure au milieu)
    for y in ROADS_H:
        for x in ROADS_V:
            box = R(x - ROAD_HALF + 2, y - ROAD_HALF + 2, x + ROAD_HALF - 2, y + ROAD_HALF - 2)
            img.paste(asphalt.crop(box), box[:2])
    d = ImageDraw.Draw(img)

    def in_intersection_x(x):
        return any(abs(x - vx) < ROAD_HALF + 4 for vx in ROADS_V)

    def in_intersection_y(y):
        return any(abs(y - hy) < ROAD_HALF + 4 for hy in ROADS_H)

    # lignes de rive et ligne centrale en pointilles
    for y in ROADS_H:
        for x in range(0, MAP_W, 4):
            if in_intersection_x(x) or in_intersection_x(x + 4):
                continue
            for yy in (y - ROAD_HALF + 9, y + ROAD_HALF - 9):
                d.line(R(x, yy, x + 4, yy), fill=hexc("#c9d3d8", 170), width=2 * SS)
        for x in range(0, MAP_W, 48):
            if in_intersection_x(x) or in_intersection_x(x + 26):
                continue
            d.line(R(x, y, x + 26, y), fill=hexc("#f2c94c"), width=3 * SS)
    for x in ROADS_V:
        for y in range(0, MAP_H, 4):
            if in_intersection_y(y) or in_intersection_y(y + 4):
                continue
            for xx in (x - ROAD_HALF + 9, x + ROAD_HALF - 9):
                d.line(R(xx, y, xx, y + 4), fill=hexc("#c9d3d8", 170), width=2 * SS)
        for y in range(0, MAP_H, 48):
            if in_intersection_y(y) or in_intersection_y(y + 26):
                continue
            d.line(R(x, y, x, y + 26), fill=hexc("#f2c94c"), width=3 * SS)
    # passages pietons autour des intersections
    for y in ROADS_H:
        for x in ROADS_V:
            for k in range(7):
                o = -ROAD_HALF + 12 + k * 17
                # cote gauche / droit (bandes verticales)
                for sx in (x - ROAD_HALF - 26, x + ROAD_HALF + 8):
                    d.rectangle(R(sx, y + o, sx + 18, y + o + 9), fill=hexc("#dfe6ea", 210))
                for sy in (y - ROAD_HALF - 26, y + ROAD_HALF + 8):
                    d.rectangle(R(x + o, sy, x + o + 9, sy + 18), fill=hexc("#dfe6ea", 210))
    # plaques d'egout, taches d'huile, fissures
    for _ in range(40):
        if rnd.random() < 0.5:
            y = rnd.choice(ROADS_H) + rnd.uniform(-40, 40)
            x = rnd.uniform(0, MAP_W)
        else:
            x = rnd.choice(ROADS_V) + rnd.uniform(-40, 40)
            y = rnd.uniform(0, MAP_H)
        k = rnd.random()
        if k < 0.25:
            d.ellipse(R(x - 11, y - 11, x + 11, y + 11), fill=hexc("#1d242c"))
            d.ellipse(R(x - 8, y - 8, x + 8, y + 8), outline=hexc("#3c4855"), width=2 * SS)
        elif k < 0.7:
            rr = rnd.uniform(8, 20)
            d.ellipse(R(x - rr, y - rr * 0.6, x + rr, y + rr * 0.6), fill=hexc("#1a1f25", 150))
        else:
            px, py = x, y
            for _ in range(5):
                nx, ny = px + rnd.uniform(-14, 14), py + rnd.uniform(-14, 14)
                d.line(R(px, py, nx, ny), fill=hexc("#1c232b"), width=SS)
                px, py = nx, ny
    # fleches au sol (sens de circulation)
    def arrow(x, y, ang):
        pts = [(16, 0), (2, -9), (2, -4), (-14, -4), (-14, 4), (2, 4), (2, 9)]
        ca, sa = math.cos(ang), math.sin(ang)
        d.polygon([tuple(R(x + px * ca - py * sa, y + px * sa + py * ca)) for px, py in pts], fill=hexc("#dfe6ea", 120))
    for y in ROADS_H:
        for x in (300, 1000, 1660, 2300):
            arrow(x, y + 32, 0)
            arrow(x + 60, y - 32, math.pi)
    for x in ROADS_V:
        for y in (250, 800, 1360):
            arrow(x - 32, y, math.pi / 2)
            arrow(x + 32, y + 60, -math.pi / 2)

    # ---------------- ombres ----------------
    shadow = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shadow)
    for (x, y, w, h, f, style) in BUILDINGS:
        k = 0.55 if style == "kiosk" else 1.0
        dx, dy = 16 * k + f * 0.35, 18 * k + f * 0.4
        sd.rectangle(R(x + dx, y + dy, x + w + dx, y + h + dy), fill=150)
    for (x, y, w, h, col) in CRATES:
        sd.rectangle(R(x + 6, y + 7, x + w + 6, y + h + 7), fill=120)
    for (x, y, rr, kind) in CIRCLES:
        sd.ellipse(R(x - rr + 10, y - rr + 12, x + rr + 10, y + rr + 12), fill=130)
    shadow = shadow.filter(ImageFilter.GaussianBlur(7 * SS))
    sh = Image.new("RGBA", (W, H), hexc("#0b1219", 0))
    sh.putalpha(shadow)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)

    # ---------------- etangs ----------------
    for (x, y, rx, ry) in PONDS:
        d.ellipse(R(x - rx - 6, y - ry - 6, x + rx + 6, y + ry + 6), fill=hexc("#8d8a6f"))
        water = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        wm = Image.new("L", (W, H), 0)
        ImageDraw.Draw(wm).ellipse(R(x - rx, y - ry, x + rx, y + ry), fill=255)
        g = Image.new("RGBA", (W, H), hexc("#1f7fa3"))
        inner = Image.new("L", (W, H), 0)
        ImageDraw.Draw(inner).ellipse(R(x - rx * 0.7, y - ry * 0.7, x + rx * 0.6, y + ry * 0.6), fill=200)
        inner = inner.filter(ImageFilter.GaussianBlur(14 * SS))
        light = Image.new("RGBA", (W, H), hexc("#5fd0e6"))
        g.paste(light, (0, 0), inner)
        water.paste(g, (0, 0), wm)
        img = Image.alpha_composite(img, water)
        d = ImageDraw.Draw(img)
        for _ in range(5):
            a = rnd.uniform(0, 2 * math.pi)
            lx, ly = x + math.cos(a) * rx * 0.6, y + math.sin(a) * ry * 0.6
            d.ellipse(R(lx - 9, ly - 7, lx + 9, ly + 7), fill=hexc("#4caf50"))
            d.pieslice(R(lx - 9, ly - 7, lx + 9, ly + 7), 300, 330, fill=hexc("#1f7fa3"))
        for k in range(3):
            d.arc(R(x - rx * 0.5 + k * 20, y - 10 + k * 8, x - rx * 0.1 + k * 20, y + 2 + k * 8), 200, 340,
                  fill=hexc("#bdf3ff", 160), width=2 * SS)

    # ---------------- obstacles ronds ----------------
    for (x, y, rr, kind) in CIRCLES:
        if kind == "fountain":
            d.ellipse(R(x - rr, y - rr, x + rr, y + rr), fill=hexc("#cfd8dc"))
            d.ellipse(R(x - rr + 8, y - rr + 8, x + rr - 8, y + rr - 8), fill=hexc("#2a93b8"))
            d.ellipse(R(x - rr + 20, y - rr + 20, x + rr - 20, y + rr - 20), fill=hexc("#53c3dd"))
            d.ellipse(R(x - 16, y - 16, x + 16, y + 16), fill=hexc("#eceff1"))
            d.ellipse(R(x - 8, y - 8, x + 8, y + 8), fill=hexc("#a6ff4d"))
            for k in range(12):
                a = k * math.pi / 6
                d.line(R(x + math.cos(a) * 18, y + math.sin(a) * 18, x + math.cos(a) * 34, y + math.sin(a) * 34),
                       fill=hexc("#e0f7fa", 200), width=2 * SS)
        else:  # citerne
            d.ellipse(R(x - rr, y - rr, x + rr, y + rr), fill=hexc("#90a4ae"))
            d.ellipse(R(x - rr + 6, y - rr + 6, x + rr - 6, y + rr - 6), fill=hexc("#b0bec5"))
            d.ellipse(R(x - rr * 0.45, y - rr * 0.45, x + rr * 0.45, y + rr * 0.45), outline=hexc("#78909c"),
                      width=3 * SS)
            d.text(tuple(R(x - 10, y - 6)), "", fill=(0, 0, 0))
            d.arc(R(x - rr + 10, y - rr + 10, x + rr - 10, y + rr - 10), 200, 250, fill=hexc("#eceff1"), width=3 * SS)
            # fuite toxique
            d.ellipse(R(x + rr * 0.3, y + rr * 0.6, x + rr * 0.9, y + rr * 1.0), fill=hexc("#7dff3a", 170))

    # conteneurs
    for (x, y, w, h, col) in CRATES:
        d.rectangle(R(x, y, x + w, y + h), fill=hexc(col))
        horiz = w >= h
        for k in range(1, 8):
            if horiz:
                xx = x + k * w / 8
                d.line(R(xx, y + 2, xx, y + h - 2), fill=(0, 0, 0, 70), width=SS)
            else:
                yy = y + k * h / 8
                d.line(R(x + 2, yy, x + w - 2, yy), fill=(0, 0, 0, 70), width=SS)
        d.rectangle(R(x, y, x + w, y + h), outline=hexc("#111111", 200), width=SS)

    # ---------------- batiments ----------------
    for b in BUILDINGS:
        draw_building(img, d, *b)
    d = ImageDraw.Draw(img)

    # socles des eoliennes au sol / sur les toits
    for (x, y) in TURBINES + ROOF_TURBINES:
        d.ellipse(R(x - 12, y - 12, x + 12, y + 12), fill=hexc("#eceff1"))
        d.ellipse(R(x - 12, y - 12, x + 12, y + 12), outline=hexc("#546e7a"), width=2 * SS)
    # cheminees
    for (x, y) in CHIMNEYS:
        d.ellipse(R(x - 15, y - 15, x + 15, y + 15), fill=hexc("#5d4037"))
        d.ellipse(R(x - 15, y - 15, x + 15, y + 15), outline=hexc("#3e2723"), width=2 * SS)
        d.ellipse(R(x - 10, y - 10, x + 10, y + 10), fill=hexc("#120d0b"))
        d.arc(R(x - 13, y - 13, x + 13, y + 13), 180, 270, fill=hexc("#8d6e63"), width=2 * SS)
    # bancs
    for (x, y, vert) in ((150, 700, False), (430, 700, False), (150, 900, False), (430, 905, False),
                         (870, 880, False), (1110, 880, False), (1540, 360, False), (1760, 1300, True)):
        if vert:
            d.rounded_rectangle(R(x - 6, y - 22, x + 6, y + 22), radius=2 * SS, fill=hexc("#8d6e63"))
        else:
            d.rounded_rectangle(R(x - 22, y - 6, x + 22, y + 6), radius=2 * SS, fill=hexc("#8d6e63"))
            d.line(R(x - 20, y, x + 20, y), fill=hexc("#5d4037"), width=SS)
    # lampadaires (le halo lumineux est ajoute dans le jeu)
    for (x, y) in lamp_positions():
        d.ellipse(R(x - 5, y - 5, x + 5, y + 5), fill=hexc("#263238"))
        d.ellipse(R(x - 3, y - 3, x + 3, y + 3), fill=hexc("#e0fffa"))
    return img.resize((MAP_W, MAP_H), Image.LANCZOS)


def draw_building(img, d, x, y, w, h, f, style):
    pal = {
        "solar": ("#566472", "#6b7a88", "#2a3540"),
        "green": ("#4b5a52", "#617268", "#28352f"),
        "hvac": ("#6b7680", "#808c96", "#2e3842"),
        "glass": ("#2f5f7c", "#4b86a6", "#1d3346"),
        "factory": ("#6d5d4b", "#806e5a", "#33281f"),
        "warehouse": ("#5f6a6f", "#76838a", "#2c3438"),
        "kiosk": ("#d7dde0", "#f2f5f6", "#38474f"),
    }[style]
    roof, rim, facade = pal
    fy = y + h - f
    # facade (face avant, donne l'impression de hauteur)
    d.rectangle(R(x, fy, x + w, y + h), fill=hexc(facade))
    d.rectangle(R(x, fy, x + w, fy + 3), fill=(0, 0, 0, 90))
    cols = max(1, int((w - 12) // 18))
    rows = max(1, int((f - 10) // 14))
    gap = (w - 12) / cols
    for i in range(cols):
        for j in range(rows):
            wx = x + 8 + i * gap
            wy = fy + 7 + j * 14
            r = rnd.random()
            col = "#ffe08a" if r < 0.25 else ("#7ff6ff" if r < 0.45 else "#3b4a57")
            if style == "factory" and r < 0.45:
                col = "#ffb74d"
            d.rectangle(R(wx, wy, wx + gap - 7, wy + 8), fill=hexc(col))
    if style in ("kiosk", "glass", "green"):
        dx = x + w / 2
        d.rectangle(R(dx - 9, y + h - 14, dx + 9, y + h), fill=hexc("#a6ff4d" if style == "green" else "#42f5e0"))
    # toit
    d.rectangle(R(x, y, x + w, fy), fill=hexc(rim))
    d.rectangle(R(x + 5, y + 5, x + w - 5, fy - 4), fill=hexc(roof))
    ix0, iy0, ix1, iy1 = x + 10, y + 10, x + w - 10, fy - 9
    if style == "solar":
        pw, ph = 30, 18
        yy = iy0
        while yy + ph <= iy1:
            xx = ix0
            while xx + pw <= ix1:
                d.rectangle(R(xx, yy, xx + pw, yy + ph), fill=hexc("#1b2f4a"))
                d.line(R(xx + pw / 3, yy, xx + pw / 3, yy + ph), fill=hexc("#3a6ea5"), width=SS)
                d.line(R(xx + 2 * pw / 3, yy, xx + 2 * pw / 3, yy + ph), fill=hexc("#3a6ea5"), width=SS)
                d.line(R(xx, yy + ph / 2, xx + pw, yy + ph / 2), fill=hexc("#3a6ea5"), width=SS)
                d.line(R(xx + 2, yy + 2, xx + 9, yy + 2), fill=hexc("#9ee7ff"), width=SS)
                xx += pw + 5
            yy += ph + 6
    elif style == "green":
        d.rectangle(R(ix0, iy0, ix1, iy1), fill=hexc("#4c9a4a"))
        for _ in range(int((ix1 - ix0) * (iy1 - iy0) / 500)):
            cx, cy = rnd.uniform(ix0 + 6, ix1 - 6), rnd.uniform(iy0 + 6, iy1 - 6)
            rr = rnd.uniform(4, 9)
            d.ellipse(R(cx - rr, cy - rr, cx + rr, cy + rr), fill=hexc(rnd.choice(["#66bb6a", "#2e7d32", "#81c784"])))
        d.rectangle(R(ix0, (iy0 + iy1) / 2 - 5, ix1, (iy0 + iy1) / 2 + 5), fill=hexc("#a1887f"))
    elif style == "hvac":
        for _ in range(max(2, int((ix1 - ix0) * (iy1 - iy0) / 3500))):
            bw, bh = rnd.uniform(26, 40), rnd.uniform(22, 30)
            bx, by = rnd.uniform(ix0, max(ix0, ix1 - bw)), rnd.uniform(iy0, max(iy0, iy1 - bh))
            d.rectangle(R(bx, by, bx + bw, by + bh), fill=hexc("#9aa5ad"))
            d.rectangle(R(bx, by, bx + bw, by + bh), outline=hexc("#4e5a63"), width=SS)
            cr = min(bw, bh) * 0.32
            d.ellipse(R(bx + bw / 2 - cr, by + bh / 2 - cr, bx + bw / 2 + cr, by + bh / 2 + cr), fill=hexc("#4e5a63"))
            d.line(R(bx + bw / 2 - cr, by + bh / 2, bx + bw / 2 + cr, by + bh / 2), fill=hexc("#9aa5ad"), width=SS)
        d.line(R(ix0, iy1 - 4, ix1, iy1 - 4), fill=hexc("#8a959e"), width=3 * SS)
    elif style == "glass":
        refl = Image.new("RGBA", img.size, (0, 0, 0, 0))
        rd = ImageDraw.Draw(refl)
        for k in range(-10, 20):
            x0 = ix0 + k * 26
            rd.line(R(x0, iy1, x0 + (iy1 - iy0), iy0), fill=hexc("#a8e6ff", 50), width=8 * SS)
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rectangle(R(ix0, iy0, ix1, iy1), fill=255)
        clipped = Image.new("RGBA", img.size, (0, 0, 0, 0))
        clipped.paste(refl, (0, 0), mask)
        img.alpha_composite(clipped)
        d.rectangle(R(ix0, iy0, ix1, iy1), outline=hexc("#7fd3f7"), width=SS)
        cx, cy = (ix0 + ix1) / 2, (iy0 + iy1) / 2
        d.rectangle(R(cx - 24, cy - 18, cx + 24, cy + 18), fill=hexc("#3c5566"))
        d.ellipse(R(cx - 14, cy - 14, cx + 14, cy + 14), outline=hexc("#42f5e0"), width=2 * SS)
        d.text(tuple(R(cx - 4, cy - 6)), "", fill=(0, 0, 0))
    elif style in ("factory", "warehouse"):
        stripe = 10
        horiz = (ix1 - ix0) > (iy1 - iy0)
        k = 0
        if horiz:
            xx = ix0
            while xx < ix1:
                d.rectangle(R(xx, iy0, min(ix1, xx + stripe / 2), iy1), fill=hexc("#000000", 30))
                xx += stripe
        else:
            yy = iy0
            while yy < iy1:
                d.rectangle(R(ix0, yy, ix1, min(iy1, yy + stripe / 2)), fill=hexc("#000000", 30))
                yy += stripe
        for _ in range(5):
            cx, cy = rnd.uniform(ix0, ix1), rnd.uniform(iy0, iy1)
            rr = rnd.uniform(6, 16)
            d.ellipse(R(cx - rr, cy - rr * 0.6, cx + rr, cy + rr * 0.6), fill=hexc("#8d4f2a", 90))
        if style == "warehouse":
            d.rectangle(R(ix0 + 8, iy0 + 8, ix1 - 8, iy0 + 24), fill=hexc("#f9a825"))
            for k in range(6):
                d.line(R(ix0 + 8 + k * 14, iy0 + 8, ix0 + 18 + k * 14, iy0 + 24), fill=hexc("#212121"), width=3 * SS)
    elif style == "kiosk":
        d.rectangle(R(ix0, (iy0 + iy1) / 2 - 4, ix1, (iy0 + iy1) / 2 + 4), fill=hexc("#3ef2d0"))
        d.ellipse(R(ix0 + 4, iy0 + 2, ix0 + 22, iy0 + 20), fill=hexc("#a6ff4d"))
    # bord eclaire (lumiere en haut a gauche)
    d.line(R(x, y, x + w, y), fill=hexc("#ffffff", 70), width=2 * SS)
    d.line(R(x, y, x, fy), fill=hexc("#ffffff", 50), width=2 * SS)


def lamp_positions():
    pts = []
    for y in ROADS_H:
        for x in range(128, MAP_W, 256):
            if any(abs(x - vx) < 120 for vx in ROADS_V):
                continue
            pts.append((x, y - ROAD_HALF - 12))
            pts.append((x + 128, y + ROAD_HALF + 12))
    for x in ROADS_V:
        for y in range(128, MAP_H, 256):
            if any(abs(y - hy) < 120 for hy in ROADS_H):
                continue
            pts.append((x - ROAD_HALF - 12, y + 64))
            pts.append((x + ROAD_HALF + 12, y - 64))
    return [p for p in pts if 10 < p[0] < MAP_W - 10 and 10 < p[1] < MAP_H - 10]


# ---------------------------------------------------------------------------
# Ecriture de la scene Main.tscn
# ---------------------------------------------------------------------------
def write_main_scene():
    ext = []

    def ext_res(kind, path):
        ext.append((kind, path))
        return len(ext)

    E_SCRIPT = ext_res("Script", "res://scripts/game_manager.gd")
    E_GROUND = ext_res("Texture2D", "res://assets/backgrounds/city_ground.png")
    E_PLAYER = ext_res("PackedScene", "res://scenes/Player.tscn")
    E_TREE = ext_res("PackedScene", "res://scenes/Tree.tscn")
    E_HUD = ext_res("PackedScene", "res://scenes/HUD.tscn")
    E_PAUSE = ext_res("PackedScene", "res://scenes/PauseMenu.tscn")
    E_SMOKE = ext_res("PackedScene", "res://scenes/ChimneySmoke.tscn")
    E_LAMP = ext_res("PackedScene", "res://scenes/StreetLamp.tscn")
    E_TURB = ext_res("PackedScene", "res://scenes/Turbine.tscn")
    E_OVERLAY = ext_res("Shader", "res://assets/shaders/overlay.gdshader")
    E_NOISE = ext_res("Texture2D", "res://assets/sprites/fx/noise.png")

    subs = []
    nodes = []

    def sub(kind, body):
        subs.append((kind, body))
        return f"sub_{len(subs)}"

    def node(text):
        nodes.append(text)

    node(f'[node name="Main" type="Node2D"]\nscript = ExtResource("{E_SCRIPT}")\n')
    node('[node name="World" type="Node2D" parent="."]\n')
    node(f'[node name="Ground" type="Sprite2D" parent="World"]\ntexture = ExtResource("{E_GROUND}")\ncentered = false\n')
    node('[node name="Obstacles" type="StaticBody2D" parent="World"]\ncollision_layer = 1\ncollision_mask = 0\n')
    shapes = []
    # murs autour de la carte
    walls = [("WallTop", MAP_W / 2, -32, MAP_W + 256, 64), ("WallBottom", MAP_W / 2, MAP_H + 32, MAP_W + 256, 64),
             ("WallLeft", -32, MAP_H / 2, 64, MAP_H + 256), ("WallRight", MAP_W + 32, MAP_H / 2, 64, MAP_H + 256)]
    for name, cx, cy, w, h in walls:
        shapes.append((name, cx, cy, ("rect", w, h)))
    for i, (x, y, w, h, f, style) in enumerate(BUILDINGS):
        shapes.append((f"Building{i + 1:02d}_{style}", x + w / 2, y + h / 2, ("rect", w, h)))
    for i, (x, y, w, h, col) in enumerate(CRATES):
        shapes.append((f"Container{i + 1:02d}", x + w / 2, y + h / 2, ("rect", w, h)))
    for i, (x, y, w, h) in enumerate(BEDS):
        shapes.append((f"GardenBed{i + 1:02d}", x + w / 2, y + h / 2, ("rect", w, h)))
    for i, (x, y, rr, kind) in enumerate(CIRCLES):
        shapes.append((f"{kind.capitalize()}{i + 1:02d}", x, y, ("circle", rr)))
    for i, (x, y) in enumerate(TURBINES):
        shapes.append((f"TurbinePole{i + 1:02d}", x, y, ("circle", 13)))
    for name, cx, cy, sh in shapes:
        if sh[0] == "rect":
            sid = sub("RectangleShape2D", f"size = Vector2({sh[1]:g}, {sh[2]:g})")
        else:
            sid = sub("CircleShape2D", f"radius = {sh[1]:g}")
        node(f'[node name="{name}" type="CollisionShape2D" parent="World/Obstacles"]\n'
             f'position = Vector2({cx:g}, {cy:g})\nshape = SubResource("{sid}")\n')
    for i, (x, y, rx, ry) in enumerate(PONDS):
        pts = []
        for k in range(20):
            a = k * 2 * math.pi / 20
            pts += [round(math.cos(a) * (rx + 2), 1), round(math.sin(a) * (ry + 2), 1)]
        node(f'[node name="Pond{i + 1:02d}" type="CollisionPolygon2D" parent="World/Obstacles"]\n'
             f'position = Vector2({x:g}, {y:g})\npolygon = PackedVector2Array({", ".join(f"{p:g}" for p in pts)})\n')
    # voies de circulation (Path2D) : les voitures les suivent
    node('[node name="Lanes" type="Node2D" parent="World"]\n')
    lanes = []
    for i, y in enumerate(ROADS_H):
        lanes.append((f"Road{i + 1}_East", (-160, y + 32), (MAP_W + 160, y + 32)))
        lanes.append((f"Road{i + 1}_West", (MAP_W + 160, y - 32), (-160, y - 32)))
    for i, x in enumerate(ROADS_V):
        lanes.append((f"Avenue{i + 1}_South", (x - 32, -160), (x - 32, MAP_H + 160)))
        lanes.append((f"Avenue{i + 1}_North", (x + 32, MAP_H + 160), (x + 32, -160)))
    for name, a, b in lanes:
        cid = sub("Curve2D", '_data = {\n"points": PackedVector2Array(0, 0, 0, 0, %g, %g, 0, 0, 0, 0, %g, %g)\n}\n'
                             'point_count = 2' % (a[0], a[1], b[0], b[1]))
        node(f'[node name="{name}" type="Path2D" parent="World/Lanes"]\ncurve = SubResource("{cid}")\n')
    # decor anime
    node('[node name="Decor" type="Node2D" parent="World"]\n')
    for i, (x, y) in enumerate(TURBINES + ROOF_TURBINES):
        node(f'[node name="Turbine{i + 1:02d}" parent="World/Decor" instance=ExtResource("{E_TURB}")]\n'
             f'position = Vector2({x:g}, {y:g})\n')
    # elements au-dessus des entites : fumee + halos
    node('[node name="Entities" type="Node2D" parent="."]\n')
    node('[node name="Collectibles" type="Node2D" parent="Entities"]\n')
    node('[node name="Hazards" type="Node2D" parent="Entities"]\n')
    node('[node name="Cars" type="Node2D" parent="Entities"]\n')
    node(f'[node name="Player" parent="Entities" instance=ExtResource("{E_PLAYER}")]\n'
         f'position = Vector2({PLAYER_START[0]:g}, {PLAYER_START[1]:g})\n')
    node('[node name="Trees" type="Node2D" parent="Entities"]\n')
    for i, (x, y, v) in enumerate(TREES):
        node(f'[node name="Tree{i + 1:02d}" parent="Entities/Trees" instance=ExtResource("{E_TREE}")]\n'
             f'position = Vector2({x:g}, {y:g})\nvariant = {v}\n')
    node('[node name="Pollution" type="Node2D" parent="Entities"]\n')
    node('[node name="Effects" type="Node2D" parent="Entities"]\nz_index = 20\n')
    node('[node name="Sky" type="Node2D" parent="."]\n')
    for i, (x, y) in enumerate(CHIMNEYS):
        node(f'[node name="Smoke{i + 1:02d}" parent="Sky" instance=ExtResource("{E_SMOKE}")]\n'
             f'position = Vector2({x:g}, {y:g})\n')
    for i, (x, y) in enumerate(lamp_positions()):
        node(f'[node name="Lamp{i + 1:02d}" parent="Sky" instance=ExtResource("{E_LAMP}")]\n'
             f'position = Vector2({x:g}, {y:g})\n')
    node(f'[node name="PlayerStart" type="Marker2D" parent="."]\nposition = Vector2({PLAYER_START[0]:g}, {PLAYER_START[1]:g})\n')
    # filtre d'ecran (brume de pollution + vignette)
    mat = sub("ShaderMaterial", f'shader = ExtResource("{E_OVERLAY}")\nshader_parameter/noise_tex = ExtResource("{E_NOISE}")\n'
                                'shader_parameter/pollution = 0.0\nshader_parameter/damage = 0.0\nshader_parameter/toxic = 0.0')
    node('[node name="Overlay" type="CanvasLayer" parent="."]\nlayer = 5\n')
    node(f'[node name="Haze" type="ColorRect" parent="Overlay"]\nmaterial = SubResource("{mat}")\n'
         'anchors_preset = 15\nanchor_right = 1.0\nanchor_bottom = 1.0\ngrow_horizontal = 2\ngrow_vertical = 2\n'
         'mouse_filter = 2\n')
    node(f'[node name="HUD" parent="." instance=ExtResource("{E_HUD}")]\n')
    node(f'[node name="PauseMenu" parent="." instance=ExtResource("{E_PAUSE}")]\n')
    # minuteurs d'apparition (fonctionnent pendant la physique pour pouvoir tester les collisions)
    for name, wait in (("WasteTimer", 1.6), ("ToxicTimer", 10.0), ("PollutionTimer", 12.0), ("CarTimer", 4.0),
                       ("BonusTimer", 16.0)):
        node(f'[node name="{name}" type="Timer" parent="."]\nprocess_callback = 0\nwait_time = {wait}\n')

    out = [f"[gd_scene load_steps={len(ext) + len(subs) + 1} format=3]\n"]
    for i, (kind, path) in enumerate(ext):
        out.append(f'[ext_resource type="{kind}" path="{path}" id="{i + 1}"]\n')
    for i, (kind, body) in enumerate(subs):
        out.append(f'[sub_resource type="{kind}" id="sub_{i + 1}"]\n{body}\n')
    out += nodes
    with open(os.path.join(ROOT, "scenes", "Main.tscn"), "w") as fh:
        fh.write("\n".join(out))


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "assets", "backgrounds"), exist_ok=True)
    ground = draw_ground()
    ground.convert("RGB").save(os.path.join(ROOT, "assets", "backgrounds", "city_ground.png"), optimize=True)
    blur = ground.resize((MAP_W // 2, MAP_H // 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
    blur.convert("RGB").save(os.path.join(ROOT, "assets", "backgrounds", "city_blur.png"), optimize=True)
    write_main_scene()
    print("Ville generee :", len(BUILDINGS), "batiments,", len(TREES), "arbres,", len(lamp_positions()), "lampadaires")
