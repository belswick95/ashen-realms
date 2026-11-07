"""Eldervale Castle: "Banners over Eldervale", an original martial march.

Snare and timpani march, horn call, trumpet fanfare, noble strings in the
relative minor, then the full band. Written for this game (melody, harmony and
arrangement are original); rendered with FluidSynth + FluidR3_GM (see
midi_score.py). Run: python3 scripts/compose-castle.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from midi_score import Score, KIT, ROOT, produce, credit

BAR = 4
s = Score(bpm=108, seed=7741)
horn = s.part('horns', 'horn', volume=104, pan=50, reverb=70)
trumpet = s.part('trumpets', 'trumpet', volume=96, pan=72, reverb=70)
trombone = s.part('trombones', 'trombone', volume=92, pan=80, reverb=65)
tuba = s.part('tuba', 'tuba', volume=88, pan=64, reverb=50)
strings = s.part('strings', 'strings', volume=98, pan=40, reverb=75)
violins = s.part('violins', 'slow_strings', volume=100, pan=34, reverb=80)
low = s.part('low strings', 'strings', volume=100, pan=84, reverb=55)
timp = s.part('timpani', 'timpani', volume=110, pan=70, reverb=70)
drum = s.drums(volume=104, reverb=55)

# Chords: (timpani/bass root, mid voicing)
CH = {'Bb': (46, [58, 62, 65, 70]), 'Eb': (51, [58, 63, 67, 70]), 'F': (41, [57, 60, 65, 69]),
      'F7': (41, [57, 60, 63, 65]), 'Gm': (43, [58, 62, 67, 70]), 'Cm': (48, [55, 60, 63, 67]),
      'Cm7': (48, [58, 60, 63, 67])}
FIFTH = {'Bb': 41, 'Eb': 46, 'F': 48, 'F7': 48, 'Gm': 50, 'Cm': 43, 'Cm7': 43}
INTRO = ['Bb', 'Bb', 'Eb', 'F']
A = ['Bb', 'Eb', 'F', 'F', 'Bb', 'Eb', 'F7', 'Bb']
B = ['Gm', 'F', 'Bb', 'Cm', 'Eb', 'F', 'Cm7', 'F']
C = ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Cm', 'Cm7', 'F']
form = [('intro', c) for c in INTRO] + [('A', c) for c in A] + [('B', c) for c in B] + [('C', c) for c in C] + [('A2', c) for c in A]

MEL_A = [[(65, .75), (65, .25), (70, 1), (70, .75), (72, .25), (74, 1)],
         [(75, 1.5), (74, .5), (72, 1), (70, 1)],
         [(69, .75), (70, .25), (72, 1), (65, 1), (65, .75), (67, .25)],
         [(72, 3), (None, 1)],
         [(65, .75), (65, .25), (70, 1), (74, .75), (75, .25), (77, 1)],
         [(79, 1.5), (77, .5), (75, 1), (74, 1)],
         [(72, .75), (74, .25), (75, 1), (72, 1), (69, 1)],
         [(70, 3), (None, 1)]]
T3 = 1 / 3
MEL_B = [[(74, T3), (74, T3), (74, T3), (79, 1), (79, T3), (77, T3), (75, T3), (74, 1)],
         [(72, 1.5), (70, .5), (72, 2)],
         [(77, T3), (77, T3), (77, T3), (82, 1), (82, T3), (81, T3), (79, T3), (77, 1)],
         [(75, 1.5), (74, .5), (72, 2)],
         [(70, .75), (72, .25), (74, 1), (75, .75), (77, .25), (79, 1)],
         [(81, 1.5), (79, .5), (77, 2)],
         [(79, .75), (77, .25), (75, 1), (74, 1), (72, 1)],
         [(72, 2), (65, 1), (None, 1)]]
MEL_C = [[(67, 2), (70, 1), (74, 1)], [(75, 3), (74, .5), (72, .5)], [(74, 2), (70, 1), (65, 1)], [(72, 4)],
         [(67, 2), (70, 1), (74, 1)], [(79, 2), (75, 1), (72, 1)], [(75, 1.5), (74, .5), (72, 1), (70, 1)],
         [(69, 2), (72, 1), (77, 1)]]
CELLO_C = [[(55, 2), (53, 2)], [(51, 4)], [(50, 2), (53, 2)], [(48, 2), (45, 2)],
           [(43, 2), (46, 2)], [(48, 2), (51, 2)], [(48, 4)], [(53, 2), (45, 2)]]


def snare(beat, level=1.0, roll_from=None):
    pattern = [(0, 1), (.5, .5), (.75, .6), (1, .8), (1.5, .5), (2, .95), (2.5, .5), (2.75, .6), (3, .8), (3.5, .6)]
    for off, accent in pattern:
        if roll_from is not None and off >= roll_from:
            break
        drum.note(beat + off, KIT['snare'], .1, int(112 * level * accent))
    if roll_from is not None:
        steps = int((4 - roll_from) / .125)
        for i in range(steps):
            drum.note(beat + roll_from + i * .125, KIT['snare'], .1, int((58 + 60 * i / steps) * level), human=False)


for bar, (section, name) in enumerate(form):
    b = bar * BAR
    root, voicing = CH[name]
    i = bar - {'intro': 0, 'A': 4, 'B': 12, 'C': 20, 'A2': 28}[section]
    phrase_end = i == 7 or (section == 'intro' and i == 3)
    loud = {'intro': .8, 'A': .9, 'B': 1.0, 'C': .55, 'A2': 1.08}[section]

    # March percussion: snare pattern, bass drum on 1 and 3, cymbals at section starts.
    if section == 'C':
        drum.note(b, KIT['snare'], .1, 52); drum.note(b + 2, KIT['rim'], .1, 46)
        if i == 7:
            snare(b, .9, roll_from=2)
    else:
        snare(b, loud, roll_from=2 if phrase_end else None)
        drum.note(b, KIT['kick'], .2, int(96 * loud)); drum.note(b + 2, KIT['kick'], .2, int(80 * loud))
    if i == 0 and section in ('A', 'B', 'A2'):
        drum.note(b, KIT['crash'], 2, 96 if section == 'A2' else 80)

    # Timpani: root on 1, fifth on 3; a roll into each new section.
    if phrase_end:
        timp.note(b, root, 1, int(100 * loud))
        for k in range(16):
            timp.note(b + 2 + k * .125, root, .12, 50 + k * 4, human=False)
    else:
        timp.note(b, root, 1, int(104 * loud)); timp.note(b + 2, FIFTH[name], 1, int(84 * loud))

    # Low strings and tuba: marching quarter notes.
    if section != 'C':
        for q, p in enumerate([root + 12, FIFTH[name] + 12, root + 12, FIFTH[name] + 12]):
            low.note(b + q, p, .45, int(92 * loud))
        if section != 'intro':
            tuba.note(b, root, 1.6, int(84 * loud)); tuba.note(b + 2, FIFTH[name], 1.6, int(76 * loud))

    if section == 'intro':
        strings.chord(b, voicing, 4, 58)
        if i >= 2:
            horn.chord(b, [voicing[0], voicing[2]], 4, 62 + 8 * i)
    elif section == 'A':
        strings.chord(b, voicing, 4, 64)
        horn.line(b, MEL_A[i], 104, legato=.92)
        trombone.note(b, root + 12, 2, 66); trombone.note(b + 2, root + 12, 2, 60)
    elif section == 'B':
        trumpet.line(b, MEL_B[i], 108, legato=.85)
        for q in (0, 2):  # horn and trombone stabs answering the fanfare
            horn.chord(b + q + 1, voicing[1:], .5, 84)
            trombone.chord(b + q + 1, [root + 12, voicing[0] - 12], .5, 80)
        strings.chord(b, voicing, 4, 70)
        if i == 7:  # rising string run into the strings section
            for k, p in enumerate([60, 62, 63, 65, 67, 69, 70, 72]):
                violins.note(b + 2 + k * .25, p, .25, 70 + k * 4)
    elif section == 'C':
        violins.line(b, MEL_C[i], 96, transpose=12)
        strings.line(b, MEL_C[i], 80)
        low.line(b, CELLO_C[i], 86)
        horn.chord(b, voicing[1:3], 4, 52)
    else:  # A2: the full band
        trumpet.line(b, MEL_A[i], 112, legato=.9)
        violins.line(b, MEL_A[i], 96, transpose=12, legato=.95)
        horn.chord(b, voicing[:3], 2, 82); horn.chord(b + 2, voicing[:3], 2, 76)
        trombone.chord(b, [root + 12, FIFTH[name] + 12], 2, 84); trombone.chord(b + 2, [root + 12], 2, 76)
        strings.chord(b, voicing, 4, 74)

end = len(form) * BAR
out = ROOT / 'assets/audio/castle.mp3'
info = produce(s, end, out, target_lufs=-19, loop=True, bitrate='112k')
credit(dict(id='castle', title='Banners over Eldervale', artist='Eldervale', source='/scripts/compose-castle.py',
            license='CC BY 4.0', licenseUrl='https://creativecommons.org/licenses/by/4.0/', file='/assets/audio/castle.mp3',
            duration=info['duration'], changes='Original march (snare, timpani, horns, trumpets, strings) composed for '
            'Eldervale Castle; MIDI rendered with FluidSynth and the FluidR3 GM SoundFont (MIT), looped seamlessly.'))
print('Castle march:', info)
