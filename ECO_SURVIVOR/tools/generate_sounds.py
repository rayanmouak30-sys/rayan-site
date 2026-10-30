#!/usr/bin/env python3
"""ECO SURVIVOR - synthese de tous les sons et musiques du jeu.

Aucun echantillon externe : chaque son est calcule a partir de formes d'ondes
(sinus, carre, dent de scie, bruit) et d'enveloppes de volume.
Les effets sont ecrits en WAV (16 bits mono), les musiques en OGG Vorbis
(conversion avec ffmpeg si disponible, sinon WAV).

Usage (depuis le dossier ECO_SURVIVOR) : python3 tools/generate_sounds.py
Dependances : Python 3, numpy, scipy (ffmpeg facultatif pour l'OGG).
"""
import os
import shutil
import subprocess
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sounds")
SR = 44100
rng = np.random.default_rng(11)


def t_(d, sr=SR):
    return np.arange(int(d * sr)) / sr


def note(n):
    """Frequence d'une note MIDI (69 = La 440 Hz)."""
    return 440.0 * 2 ** ((n - 69) / 12)


def env(d, a=0.005, r=0.1, sr=SR):
    t = t_(d, sr)
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.clip((d - t) / max(r, 1e-4), 0, 1)
    return e


def expdec(d, tau, sr=SR):
    return np.exp(-t_(d, sr) / tau)


def sine(f, d, sr=SR):
    if np.isscalar(f):
        return np.sin(2 * np.pi * f * t_(d, sr))
    return np.sin(2 * np.pi * np.cumsum(f) / sr)


def square(f, d, duty=0.5, sr=SR):
    ph = (np.cumsum(np.full(int(d * sr), f) if np.isscalar(f) else f) / sr) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def saw(f, d, sr=SR):
    ph = (np.cumsum(np.full(int(d * sr), f) if np.isscalar(f) else f) / sr) % 1.0
    return 2 * ph - 1


def tri(f, d, sr=SR):
    return 2 * np.abs(saw(f, d, sr)) - 1


def noise(d, sr=SR):
    return rng.standard_normal(int(d * sr))


def lp(x, f, sr=SR, order=2):
    b, a = signal.butter(order, min(f, sr / 2 - 50) / (sr / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, f, sr=SR, order=2):
    b, a = signal.butter(order, f / (sr / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, sr=SR):
    b, a = signal.butter(2, [f1 / (sr / 2), f2 / (sr / 2)], "band")
    return signal.lfilter(b, a, x)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def at(x, start, total, sr=SR):
    out = np.zeros(int(total * sr))
    i = int(start * sr)
    seg = x[:max(0, len(out) - i)]
    out[i:i + len(seg)] += seg
    return out


def norm(x, peak=0.85):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def write_wav(name, x, sr=SR, peak=0.85):
    x = norm(x, peak)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    return path


def write_music(name, x, sr):
    wav = write_wav(name, x, sr, peak=0.8)
    if shutil.which("ffmpeg"):
        ogg = os.path.join(OUT, name + ".ogg")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4", ogg],
                       check=True)
        os.remove(wav)


# ---------------------------------------------------------------------------
# Effets sonores
# ---------------------------------------------------------------------------
def sfx():
    # ramassage : deux notes cristallines montantes
    d = 0.32
    a = sine(note(84), 0.16) * expdec(0.16, 0.05) + 0.4 * sine(note(96), 0.16) * expdec(0.16, 0.03)
    b = sine(note(91), 0.22) * expdec(0.22, 0.07) + 0.4 * sine(note(103), 0.22) * expdec(0.22, 0.04)
    write_wav("collect", mix(at(a, 0, d), at(b, 0.06, d)))
    # bonus : arpege rapide brillant
    d = 0.6
    parts = [at(tri(note(n), 0.18) * expdec(0.18, 0.06) * 0.8 + 0.3 * sine(note(n + 12), 0.18) * expdec(0.18, 0.05),
                k * 0.06, d) for k, n in enumerate([72, 76, 79, 84, 88, 91])]
    write_wav("bonus", mix(*parts))
    # degat : choc sourd + gresillement
    d = 0.35
    thud = sine(np.linspace(180, 50, int(d * SR)), d) * expdec(d, 0.08)
    crunch = bp(noise(d), 400, 3000) * expdec(d, 0.05)
    write_wav("hurt", mix(thud, crunch * 0.6))
    # vie perdue : trois notes descendantes
    d = 1.0
    parts = [at(square(note(n), 0.28, 0.3) * env(0.28, 0.005, 0.12) * 0.5, k * 0.2, d) for k, n in enumerate([67, 63, 58])]
    write_wav("life_lost", lp(mix(*parts), 3500))
    # dechet toxique : "blop" gluant + petite explosion
    d = 0.6
    blop = sine(np.linspace(600, 90, int(0.25 * SR)), 0.25) * expdec(0.25, 0.08)
    boom = lp(noise(d), 900) * expdec(d, 0.12)
    bubbles = mix(*[at(sine(np.linspace(f, f * 1.8, int(0.06 * SR)), 0.06) * expdec(0.06, 0.02), s, d)
                    for f, s in ((500, 0.12), (700, 0.2), (420, 0.27), (850, 0.33))])
    write_wav("toxic", mix(blop, boom * 0.8, bubbles * 0.5))
    # klaxon de voiture
    d = 0.5
    horn = (saw(392, d) + saw(494, d)) * env(d, 0.01, 0.08)
    write_wav("horn", lp(horn, 2200) * 0.6)
    # alarme de pollution (niveau superieur)
    d = 1.2
    f = np.where((t_(d) * 4).astype(int) % 2 == 0, 880, 660)
    siren = square(f.astype(float), d, 0.5) * env(d, 0.01, 0.2)
    write_wav("alarm", lp(siren, 2500) * 0.5)
    # tic des 10 dernieres secondes
    d = 0.08
    write_wav("tick", bp(noise(d), 1800, 4000) * expdec(d, 0.012) + sine(1500, d) * expdec(d, 0.01))
    # interface : survol et clic
    d = 0.06
    write_wav("ui_hover", sine(note(88), d) * expdec(d, 0.015), peak=0.4)
    d = 0.12
    write_wav("ui_click", mix(sine(note(79), d) * expdec(d, 0.03), at(sine(note(86), 0.08) * expdec(0.08, 0.025), 0.03, d)),
              peak=0.6)
    # reapparition
    d = 0.8
    sweep = sine(np.linspace(300, 1400, int(d * SR)), d) * env(d, 0.05, 0.3)
    sh = sine(np.linspace(600, 2800, int(d * SR)), d) * env(d, 0.05, 0.3) * 0.3
    write_wav("respawn", mix(sweep, sh) * 0.7)
    # fanfare de victoire
    d = 2.4
    seq = [(72, 0), (76, 0.15), (79, 0.3), (84, 0.45), (79, 0.7), (84, 0.85)]
    parts = [at((square(note(n), 0.3, 0.25) * 0.4 + tri(note(n), 0.3)) * env(0.3, 0.005, 0.1), s, d) for n, s in seq]
    chord = mix(*[tri(note(n), 1.3) for n in (72, 76, 79, 84)]) * env(1.3, 0.02, 0.9) * 0.6
    write_wav("victory", lp(mix(*parts, at(chord, 1.0, d)), 5000))
    # game over : descente mineure
    d = 2.2
    seq = [(69, 0), (68, 0.3), (67, 0.6), (66, 0.9)]
    parts = [at((saw(note(n), 0.4) * 0.5 + tri(note(n - 12), 0.4)) * env(0.4, 0.01, 0.2), s, d) for n, s in seq]
    low = tri(note(45), 1.0) * env(1.0, 0.02, 0.8)
    write_wav("gameover", lp(mix(*parts, at(low, 1.2, d)), 2500))


# ---------------------------------------------------------------------------
# Musiques (boucles parfaites)
# ---------------------------------------------------------------------------
def circular_delay(x, sr, delay_s, feedback, wet):
    """Echo qui boucle : la fin de la musique 'deborde' sur le debut."""
    out = x.copy()
    d = int(delay_s * sr)
    tap = x.copy()
    for k in range(6):
        tap = np.roll(tap, d) * feedback
        out += tap * wet
    return out


def music_game():
    sr = 22050
    bpm = 120
    beat = 60 / bpm
    bars = 16
    total = bars * 4 * beat
    n = int(total * sr)
    out = np.zeros(n)
    prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]  # Am F C G

    def put(x, start):
        i = int(start * sr) % n
        seg = x[:n]
        end = i + len(seg)
        if end <= n:
            out[i:end] += seg
        else:
            out[i:] += seg[:n - i]
            out[:end - n] += seg[n - i:]

    for bar in range(bars):
        root, chord = prog[(bar // 2) % 4]
        t0 = bar * 4 * beat
        intensity = 0.6 if bar < 4 else 1.0
        for b in range(4):
            # grosse caisse
            dk = 0.3
            kick = sine(np.linspace(140, 45, int(dk * sr)), dk, sr) * expdec(dk, 0.09, sr)
            put(kick * 0.9, t0 + b * beat)
            # charleston sur les contretemps
            dh = 0.06
            hat = hp(noise(dh, sr), 7000, sr) * expdec(dh, 0.015, sr)
            put(hat * 0.25 * intensity, t0 + b * beat + beat / 2)
            if bar >= 4 and b % 2 == 1:
                ds = 0.2
                snare = bp(noise(ds, sr), 1200, 6000, sr) * expdec(ds, 0.05, sr) + sine(200, ds, sr) * expdec(ds, 0.03, sr)
                put(snare * 0.45, t0 + b * beat)
        # basse (croches)
        for k in range(8):
            f = note(root - 12 + (12 if k % 4 == 3 else 0))
            dbs = beat / 2 * 0.9
            bass = lp(saw(f, dbs, sr), 600, sr) * env(dbs, 0.005, 0.05, sr)
            put(bass * 0.45, t0 + k * beat / 2)
        # arpege (doubles croches)
        if bar >= 2:
            seq = chord + [chord[0] + 12, chord[1] + 12, chord[2], chord[1], chord[0] + 12]
            for k in range(16):
                f = note(seq[k % len(seq)] + 12)
                da = beat / 4 * 0.95
                arp = (square(f, da, 0.25, sr) * 0.5 + tri(f, da, sr)) * expdec(da, 0.06, sr)
                put(lp(arp, 3500, sr) * 0.16 * intensity, t0 + k * beat / 4)
        # nappe
        dp = 4 * beat
        pad = mix(*[saw(note(m) * (1 + det), dp, sr) for m in chord for det in (-0.004, 0.004)])
        pad = lp(pad, 1200, sr) * env(dp, 0.3, 0.4, sr)
        put(pad * 0.05, t0)
        # melodie principale (seconde moitie)
        if bar >= 8:
            mel = [chord[2] + 12, chord[1] + 12, chord[0] + 12, chord[1] + 12][(bar % 4)]
            dm = beat * 1.5
            lead = (tri(note(mel), dm, sr) + 0.3 * square(note(mel), dm, 0.5, sr)) * env(dm, 0.02, 0.3, sr)
            put(lp(lead, 2800, sr) * 0.18, t0 + beat * 2)
    out = circular_delay(out, sr, beat * 0.75, 0.45, 0.25)
    write_music("music_game", out, sr)


def music_menu():
    sr = 22050
    bpm = 80
    beat = 60 / bpm
    bars = 8
    total = bars * 4 * beat
    n = int(total * sr)
    out = np.zeros(n)
    prog = [[57, 64, 67, 72], [53, 60, 64, 69], [48, 55, 64, 67], [55, 62, 66, 71]]  # Am9 Fmaj7 C G

    def put(x, start):
        i = int(start * sr) % n
        seg = x[:n]
        end = i + len(seg)
        if end <= n:
            out[i:end] += seg
        else:
            out[i:] += seg[:n - i]
            out[:end - n] += seg[n - i:]

    for bar in range(bars):
        chord = prog[bar % 4]
        t0 = bar * 4 * beat
        dp = 4 * beat * 1.1
        pad = mix(*[saw(note(m) * (1 + det), dp, sr) for m in chord for det in (-0.005, 0.005)])
        pad = lp(pad, 900, sr) * env(dp, 1.0, 1.2, sr)
        put(pad * 0.07, t0)
        bass = sine(note(chord[0] - 12), dp, sr) * env(dp, 0.2, 1.0, sr)
        put(bass * 0.35, t0)
        for k in range(8):
            m = chord[(k * 3) % 4] + 12
            da = 0.7
            pl = (sine(note(m), da, sr) + 0.25 * sine(note(m) * 2, da, sr)) * expdec(da, 0.25, sr)
            put(pl * 0.16, t0 + k * beat / 2)
        dh = 0.05
        for k in range(4):
            put(hp(noise(dh, sr), 8000, sr) * expdec(dh, 0.012, sr) * 0.08, t0 + k * beat + beat / 2)
    out = circular_delay(out, sr, beat * 0.75, 0.5, 0.35)
    write_music("music_menu", out, sr)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sfx()
    music_game()
    music_menu()
    print("Sons generes dans assets/sounds/ :", sorted(os.listdir(OUT)))
