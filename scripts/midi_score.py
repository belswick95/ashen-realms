"""Tiny score toolkit for Eldervale's original music.

A score is written note by note in Python, saved as a Standard MIDI File and
rendered with FluidSynth through a General MIDI SoundFont (FluidR3_GM, MIT
licence: apt install fluidsynth fluid-soundfont-gm). Region tracks are loops:
the reverb tail that rings past the loop point is folded back onto the start so
the MP3 loops without a gap or a cut. Loudness is set with ffmpeg's EBU R128
meter so every track sits at the same level as the licensed recordings.
"""
from pathlib import Path
import json, random, re, shutil, struct, subprocess, tempfile, wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOUNDFONT = Path('/usr/share/sounds/sf2/FluidR3_GM.sf2')
TPB = 480
DRUMS = 9  # MIDI channel 10

# General MIDI programs (0-based) used by the scores.
GM = dict(nylon=24, strings=48, slow_strings=49, tremolo=44, pizzicato=45, harp=46, timpani=47, choir=52,
          trumpet=56, trombone=57, tuba=58, horn=60, brass=61, flute=73, recorder=74, piccolo=72, oboe=68,
          clarinet=71, cello=42, contrabass=43, violin=40, glock=9, celesta=8, viola=41)
# General MIDI percussion keys.
KIT = dict(kick=35, bass=36, snare=38, rim=37, crash=49, crash2=57, ride=51, tambourine=54, triangle=81,
           cabasa=69, shaker=70, hand_clap=39, low_tom=45, high_tom=50, splash=55)


def vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append(0x80 | (n & 0x7F))
        n >>= 7
    return bytes(reversed(out))


class Part:
    def __init__(self, score, name, channel, program=None, volume=100, pan=64, reverb=60, chorus=0):
        self.score, self.name, self.channel, self.program = score, name, channel, program
        self.events = []  # (tick, order, bytes)
        self.cc(0, 7, volume); self.cc(0, 10, pan); self.cc(0, 91, reverb); self.cc(0, 93, chorus); self.cc(0, 11, 127)
        if program is not None:
            self.events.append((0, 1, bytes([0xC0 | channel, program])))

    def cc(self, beat, number, value):
        self.events.append((self.score.tick(beat), 0, bytes([0xB0 | self.channel, number, max(0, min(127, int(value)))])))

    def ramp(self, beat, length, number, start, end, steps=16):
        for i in range(steps + 1):
            self.cc(beat + length * i / steps, number, start + (end - start) * i / steps)

    def note(self, beat, pitch, length, velocity=90, human=True):
        s = self.score
        jitter = s.rng.uniform(-s.swing_ms, s.swing_ms) / 1000 * s.bpm / 60 if human else 0
        vel = int(max(1, min(127, velocity + (s.rng.randint(-5, 5) if human else 0))))
        on, off = s.tick(max(0, beat + jitter)), s.tick(beat + jitter + length * .97)
        self.events.append((on, 3, bytes([0x90 | self.channel, pitch, vel])))
        self.events.append((max(on + 1, off), 2, bytes([0x80 | self.channel, pitch, 0])))

    def chord(self, beat, pitches, length, velocity=80, human=True):
        for p in pitches:
            self.note(beat, p, length, velocity, human)

    def line(self, beat, notes, velocity=90, transpose=0, legato=1.0):
        """notes: [(pitch or None, beats)]; returns the beat after the line."""
        for pitch, beats in notes:
            if pitch is not None:
                self.note(beat, pitch + transpose, beats * legato, velocity)
            beat += beats
        return beat


class Score:
    def __init__(self, bpm, seed=1, swing_ms=7):
        self.bpm, self.parts, self.rng, self.swing_ms = bpm, [], random.Random(seed), swing_ms
        self.channels = iter([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15])

    def tick(self, beat):
        return int(round(beat * TPB))

    def seconds(self, beats):
        return beats * 60 / self.bpm

    def part(self, name, program, **kw):
        p = Part(self, name, next(self.channels), GM[program] if isinstance(program, str) else program, **kw)
        self.parts.append(p)
        return p

    def drums(self, name='drums', **kw):
        p = Part(self, name, DRUMS, None, **kw)
        self.parts.append(p)
        return p

    def write(self, path, end_beat):
        tempo = int(60_000_000 / self.bpm)
        tracks = [bytes([0, 0xFF, 0x51, 3]) + tempo.to_bytes(3, 'big') + vlq(self.tick(end_beat)) + b'\xff\x2f\x00']
        for p in self.parts:
            data, last = b'', 0
            for tick, _, msg in sorted(p.events, key=lambda e: (e[0], e[1])):
                data += vlq(tick - last) + msg
                last = tick
            data += vlq(max(0, self.tick(end_beat) - last)) + b'\xff\x2f\x00'
            tracks.append(data)
        blob = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), TPB)
        for t in tracks:
            blob += b'MTrk' + struct.pack('>I', len(t)) + t
        Path(path).write_bytes(blob)


def render(midi, wav_path, rate=44100, gain=.6, reverb=(.75, .3, .9, .5)):
    room, damp, width, level = reverb
    subprocess.run(['fluidsynth', '-ni', '-q', '-r', str(rate), '-g', str(gain),
                    '-o', f'synth.reverb.room-size={room}', '-o', f'synth.reverb.damp={damp}',
                    '-o', f'synth.reverb.width={width}', '-o', f'synth.reverb.level={level}',
                    '-o', 'synth.chorus.active=1', '-F', str(wav_path), str(SOUNDFONT), str(midi)], check=True)


def read_wav(path):
    with wave.open(str(path)) as w:
        rate, ch = w.getframerate(), w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768
    return data.reshape(-1, ch), rate


def write_wav(path, data, rate):
    data = np.clip(data, -1, 1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(data.shape[1]); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes((data * 32767).astype('<i2').tobytes())


def loudness(path):
    log = subprocess.run(['ffmpeg', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1])


def encode(wav_path, mp3_path, target_lufs, bitrate='112k', limit=True):
    level = loudness(wav_path)
    chain = f'volume={target_lufs - level:.2f}dB' + (',alimiter=limit=0.89:level=false' if limit else '')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav_path), '-af', chain, '-codec:a', 'libmp3lame',
                    '-b:a', bitrate, str(mp3_path)], check=True)
    return loudness(mp3_path)


def produce(score, end_beat, out_mp3, target_lufs=-19, loop=True, bitrate='112k', tail=6.0, fade=None):
    """Render `score` up to `end_beat`; for loops fold the tail onto the start."""
    work = Path(tempfile.mkdtemp(prefix='eldervale-score-'))
    try:
        midi, wav, final = work / 'score.mid', work / 'render.wav', work / 'final.wav'
        score.write(midi, end_beat + tail * score.bpm / 60)
        render(midi, wav)
        data, rate = read_wav(wav)
        n = int(round(score.seconds(end_beat) * rate))
        if loop:
            body = data[:n].copy()
            rest = data[n:]
            body[:len(rest)] += rest[:n]
            data = body
        else:
            # One-shots stop `tail` seconds after the last beat, with a fade.
            data = data[:int(round((score.seconds(end_beat) + tail) * rate))].copy()
            if fade:
                k = int(fade * rate)
                data[-k:] *= np.linspace(1, 0, k)[:, None] ** 2
        write_wav(final, data / max(1e-9, np.max(np.abs(data))) * .9, rate)
        level = encode(final, out_mp3, target_lufs, bitrate)
        return dict(duration=round(len(data) / rate, 2), lufs=level, bytes=Path(out_mp3).stat().st_size)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def credit(entry):
    """Insert or replace one entry in assets/audio/credits.json."""
    path = ROOT / 'assets/audio/credits.json'
    data = [x for x in json.loads(path.read_text()) if x['id'] != entry['id']]
    data.append(entry)
    path.write_text(json.dumps(data, indent=2) + '\n')
