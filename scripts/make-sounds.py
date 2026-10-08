"""Generates the app's UI sounds (short sine tones). Run: python3 scripts/make-sounds.py"""
import math, struct, wave, os

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

def tone(freq, ms, vol=0.35, am=0):
    n = int(RATE * ms / 1000)
    fade = min(n // 4, int(RATE * 0.008))
    out = []
    for i in range(n):
        env = min(1, i / fade, (n - i) / fade) if fade else 1
        v = math.sin(2 * math.pi * freq * i / RATE)
        if am:
            v *= 0.6 + 0.4 * math.sin(2 * math.pi * am * i / RATE)
        out.append(v * vol * env)
    return out

def gap(ms):
    return [0.0] * int(RATE * ms / 1000)

SOUNDS = {
    'tick': tone(1175, 70),
    'go': tone(880, 90) + gap(20) + tone(1319, 140),
    'up': tone(1047, 60, 0.3),
    'down': tone(784, 60, 0.3),
    'pause': tone(988, 90) + gap(20) + tone(740, 120),
    'stop': tone(659, 110) + gap(20) + tone(440, 200),
    'vibe': tone(196, 220, 0.45, am=28),
    'done': tone(1047, 90) + gap(15) + tone(1319, 90) + gap(15) + tone(1568, 200),
}

for name, samples in SOUNDS.items():
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(s * 32767)) for s in samples))
print('wrote', ', '.join(SOUNDS))
