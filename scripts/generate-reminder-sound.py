#!/usr/bin/env python3
"""Sinal de estudo original, sem áudio de terceiros; instalado em res/raw."""
import math
import struct
import wave
from pathlib import Path

out=Path("android/app/src/main/res/raw/study_alarm.wav")
out.parent.mkdir(parents=True,exist_ok=True)
sample_rate=22050
duration=3.3
samples=[]
# Três acordes ascendentes suaves com pausas curtas, audíveis sem volume agressivo.
notes=[(0.0,0.75,(523.25,659.25)),(1.05,0.75,(587.33,739.99)),(2.10,0.92,(659.25,783.99))]
for i in range(int(duration*sample_rate)):
    t=i/sample_rate
    signal=0.
    for start,length,pitches in notes:
        elapsed=t-start
        if 0<=elapsed<length:
            attack=min(1.,elapsed/.035)
            release=min(1.,(length-elapsed)/.16)
            envelope=max(0.,min(attack,release))**1.1
            signal+=.24*envelope*(math.sin(2*math.pi*pitches[0]*elapsed)+.5*math.sin(2*math.pi*pitches[1]*elapsed))
    samples.append(struct.pack("<h",int(max(-1.,min(1.,signal))*32767)))
with wave.open(str(out),"wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sample_rate)
    f.writeframes(b"".join(samples))
print(f"Generated {out} ({out.stat().st_size} bytes)")
