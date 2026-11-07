"""Login screen: "The Gates of Eldervale", an original title theme.

D minor, slow and wide: tremolo strings and harp open in mist, a solo horn
states the theme, the strings carry it an octave higher over a rising run, then
brass, choir and timpani take it into F major before it sinks back into the
mist (the loop point). Melody, harmony and arrangement are original to
Eldervale. Rendered with FluidSynth + FluidR3_GM (see midi_score.py).
Run: python3 scripts/compose-login.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from midi_score import Score, KIT, ROOT, produce, credit

BAR = 4
s = Score(bpm=70, seed=31415, swing_ms=10)
trem = s.part('tremolo', 'tremolo', volume=92, pan=48, reverb=100)
pad = s.part('strings', 'slow_strings', volume=100, pan=40, reverb=110)
violins = s.part('violins', 'strings', volume=104, pan=30, reverb=100)
low = s.part('low strings', 'strings', volume=98, pan=86, reverb=90)
harp = s.part('harp', 'harp', volume=92, pan=96, reverb=110)
horn = s.part('horn', 'horn', volume=108, pan=58, reverb=105)
trumpet = s.part('trumpets', 'trumpet', volume=88, pan=72, reverb=100)
trombone = s.part('trombones', 'trombone', volume=90, pan=84, reverb=95)
choir = s.part('choir', 'choir', volume=84, pan=64, reverb=120)
timp = s.part('timpani', 'timpani', volume=108, pan=70, reverb=100)
drum = s.drums(volume=90, reverb=100)
celesta = s.part('celesta', 'celesta', volume=70, pan=20, reverb=120)

# (bass root, voicing)
CH = {'Dm': (38, [57, 62, 65, 69]), 'Bb': (34, [58, 62, 65, 70]), 'F': (41, [57, 60, 65, 69]),
      'C': (36, [55, 60, 64, 67]), 'Gm': (43, [55, 58, 62, 67]), 'A': (33, [57, 61, 64, 69]),
      'Asus': (33, [57, 62, 64, 69]), 'C/E': (40, [55, 60, 64, 67])}
INTRO = ['Dm', 'Bb', 'Dm', 'Asus']
THEME = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Bb', 'A']
THEME2 = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Bb', 'C']
CLIMAX = ['F', 'C', 'Dm', 'Bb', 'F', 'C/E', 'Bb', 'A']
OUTRO = ['Dm', 'Bb']
form = ([('intro', c) for c in INTRO] + [('theme', c) for c in THEME] + [('theme2', c) for c in THEME2]
        + [('climax', c) for c in CLIMAX] + [('outro', c) for c in OUTRO])

# The theme: a rising fifth and a sigh, answered by a climb (original).
MEL = [[(62, 1), (69, 1.5), (70, .5), (69, 1)],
       [(67, 1.5), (65, .5), (62, 2)],
       [(65, 1), (69, 1), (72, 1.5), (70, .5)],
       [(67, 2), (64, 1), (67, 1)],
       [(62, 1), (69, 1.5), (70, .5), (69, 1)],
       [(74, 1.5), (72, .5), (70, 2)],
       [(70, 1), (69, .5), (67, .5), (65, 1), (67, 1)],
       [(69, 4)]]
MEL2_END = [[(70, 1), (69, .5), (67, .5), (65, 1), (64, 1)], [(67, 2), (None, 2)]]
GLORY = [[(65, 1), (72, 1.5), (74, .5), (72, 1)],
         [(79, 1.5), (77, .5), (76, 2)],
         [(74, 1), (77, 1), (81, 1.5), (79, .5)],
         [(77, 3), (74, 1)],
         [(72, 1), (77, 1.5), (79, .5), (81, 1)],
         [(84, 2), (79, 1), (76, 1)],
         [(77, 1.5), (74, .5), (82, 2)],
         [(81, 4)]]


def arpeggio(b, voicing, vel, step=.5, up=True):
    notes = [voicing[0] - 12] + voicing + [voicing[1] + 12, voicing[2] + 12]
    seq = notes + notes[-2:0:-1]
    for k in range(int(4 / step)):
        harp.note(b + k * step, seq[k % len(seq)], step * 2, vel)


for bar, (section, name) in enumerate(form):
    b = bar * BAR
    root, voicing = CH[name]
    i = bar - {'intro': 0, 'theme': 4, 'theme2': 12, 'climax': 20, 'outro': 28}[section]
    if section in ('intro', 'outro'):
        trem.chord(b, [root + 12] + voicing[:2], 4, 54 if section == 'intro' else 50)
        low.note(b, root, 4, 60)
        arpeggio(b, voicing, 46 - 4 * (section == 'outro'))
        if section == 'intro':
            if i == 0:
                timp.note(b, 38, 2, 70)
            if i == 3:  # timpani swell into the theme
                for k in range(16):
                    timp.note(b + 2 + k * .125, 33, .12, 40 + k * 4, human=False)
            celesta.note(b + 2, voicing[-1] + 12, 2, 40)
        else:
            horn.line(b, MEL[i][:2] if i == 0 else [(None, 4)], 58)  # a distant echo of the theme
    elif section == 'theme':
        pad.chord(b, voicing, 4, 60)
        trem.chord(b, [root + 12], 4, 48)
        low.note(b, root, 4, 70)
        horn.line(b, MEL[i], 98, legato=.98)
        arpeggio(b, voicing, 42, step=1)
        if i % 2 == 0:
            timp.note(b, 38 if name in ('Dm', 'F') else root % 12 + 36, 1.5, 58)
    elif section == 'theme2':
        line = MEL[i] if i < 6 else MEL2_END[i - 6]
        violins.line(b, line, 96, transpose=12, legato=1)
        pad.chord(b, voicing, 4, 66)
        low.line(b, [(root, 2), (root + 7, 2)], 80)
        horn.chord(b, voicing[1:3], 4, 60 + 3 * i)  # horns swell under the strings
        choir.chord(b, voicing[:2], 4, 40 + 3 * i)
        timp.note(b, 38, 1, 64 + 3 * i); timp.note(b + 2, 45, 1, 54 + 3 * i)
        if i == 7:  # the rising string run into the climax
            for k, p in enumerate([60, 62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86]):
                violins.note(b + 2 + k * .125, p, .14, 68 + k * 3, human=False)
            for k in range(16):
                drum.note(b + 2 + k * .125, KIT['snare'], .1, 30 + k * 4, human=False)
                timp.note(b + 2 + k * .125, 36, .12, 50 + k * 4, human=False)
    elif section == 'climax':
        trumpet.line(b, GLORY[i], 104, legato=.95)
        horn.line(b, GLORY[i], 96, transpose=-12, legato=.98)
        violins.line(b, GLORY[i], 92, transpose=12, legato=1)
        trombone.chord(b, [root + 12, voicing[0]], 4, 82)
        pad.chord(b, voicing, 4, 76)
        choir.chord(b, voicing, 4, 66)
        low.line(b, [(root, 1.5), (root, .5), (root + 7, 2)], 92)
        timp.note(b, root % 12 + 36 if root % 12 + 36 >= 36 else root + 12, 1, 92)
        timp.note(b + 2, (root + 7) % 12 + 36, 1, 74)
        drum.note(b, KIT['bass'], 1, 76)
        if i in (0, 4):
            drum.note(b, KIT['crash'], 4, 84)
        if i == 7:
            for k in range(24):
                timp.note(b + 1 + k * .125, 45, .12, 60 + k, human=False)

end = len(form) * BAR
out = ROOT / 'assets/audio/login.mp3'
info = produce(s, end, out, target_lufs=-19, loop=True, bitrate='112k', tail=8)
credit(dict(id='login', title='The Gates of Eldervale', artist='Eldervale', source='/scripts/compose-login.py',
            license='CC BY 4.0', licenseUrl='https://creativecommons.org/licenses/by/4.0/', file='/assets/audio/login.mp3',
            duration=info['duration'], changes='Original title theme (tremolo strings, harp, solo horn, choir, brass, timpani) '
            'composed for the Eldervale login screen; MIDI rendered with FluidSynth and the FluidR3 GM SoundFont (MIT), looped seamlessly.'))
print('Login theme:', info)
