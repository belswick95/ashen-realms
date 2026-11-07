"""Level-up fanfares (original to Eldervale): one for any skill level, a bolder
one for a combat level. About 3-4 s each, rendered with FluidSynth + FluidR3_GM
(see midi_score.py) to assets/audio/level-up-skill.mp3 and level-up-combat.mp3.
music.js plays them on the Sound effects channel and ducks the music meanwhile.
Run: python3 scripts/build-level-jingle.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from midi_score import Score, KIT, ROOT, produce, credit

LICENSE = dict(artist='Eldervale', license='CC BY 4.0', licenseUrl='https://creativecommons.org/licenses/by/4.0/')


def skill():
    """C major, bright: harp sweep, a quick trumpet climb, a turn, a held high tonic with glockenspiel."""
    s = Score(bpm=60, seed=1201, swing_ms=3)  # 1 beat = 1 second
    tpt = s.part('trumpet', 'trumpet', volume=104, pan=60, reverb=80)
    horn = s.part('horns', 'horn', volume=92, pan=48, reverb=85)
    strings = s.part('strings', 'strings', volume=96, pan=36, reverb=90)
    flute = s.part('flute', 'flute', volume=84, pan=80, reverb=90)
    harp = s.part('harp', 'harp', volume=96, pan=90, reverb=95)
    glock = s.part('glockenspiel', 'glock', volume=78, pan=70, reverb=100)
    timp = s.part('timpani', 'timpani', volume=100, pan=64, reverb=80)
    drum = s.drums(volume=80, reverb=90)
    for k, p in enumerate([60, 64, 67, 72, 76, 79, 84]):
        harp.note(k * .045, p, .8, 70 + k * 3, human=False)
    melody = [(.30, 67, .13), (.44, 72, .13), (.58, 76, .13), (.72, 79, .42), (1.18, 81, .15), (1.34, 79, .15),
              (1.50, 77, .15), (1.66, 76, .15), (1.84, 74, .22), (2.08, 79, .26), (2.38, 84, 1.25)]
    for t, p, d in melody:
        tpt.note(t, p, d, 104, human=False)
        flute.note(t, p + 12, d, 70, human=False)
    strings.chord(.3, [48, 55, 60, 64], .85, 74)
    strings.chord(1.18, [53, 57, 60, 65], .62, 74)
    strings.chord(1.84, [55, 59, 62, 67], .5, 78)
    strings.chord(2.38, [48, 55, 60, 64, 67, 72], 1.3, 88)
    horn.chord(.72, [64, 67], .42, 74)
    horn.chord(1.84, [62, 67], .5, 80)
    horn.chord(2.38, [64, 67, 72], 1.25, 92)
    glock.note(2.38, 84, 1, 86, human=False); glock.note(2.52, 88, .8, 70, human=False); glock.note(2.66, 91, .8, 62, human=False)
    timp.note(.3, 36, .5, 84, human=False)
    for k in range(6):
        timp.note(2.0 + k * .065, 43, .07, 56 + k * 8, human=False)
    timp.note(2.38, 36, 1, 104, human=False)
    drum.note(2.38, KIT['crash'], 1.4, 64, human=False)
    drum.note(2.38, KIT['triangle'], 1, 70, human=False)
    return s, 3.7


def combat():
    """D major, martial: a snare pickup, a brass triplet call, a rising answer, a held tutti over drums and a cymbal crash."""
    s = Score(bpm=60, seed=1202, swing_ms=3)
    tpt = s.part('trumpets', 'trumpet', volume=110, pan=60, reverb=75)
    brass = s.part('brass', 'brass', volume=100, pan=70, reverb=75)
    horn = s.part('horns', 'horn', volume=104, pan=46, reverb=80)
    bone = s.part('trombones', 'trombone', volume=104, pan=84, reverb=70)
    tuba = s.part('tuba', 'tuba', volume=96, pan=64, reverb=60)
    strings = s.part('strings', 'strings', volume=92, pan=34, reverb=85)
    timp = s.part('timpani', 'timpani', volume=112, pan=64, reverb=75)
    drum = s.drums(volume=104, reverb=70)
    for k in range(5):  # snare pickup
        drum.note(k * .06, KIT['snare'], .05, 64 + k * 9, human=False)
    melody = [(.32, 62, .12), (.45, 62, .12), (.58, 62, .12), (.72, 69, .40), (1.16, 67, .13), (1.30, 69, .13),
              (1.44, 71, .13), (1.58, 74, .48), (2.10, 73, .14), (2.25, 71, .14), (2.40, 73, .14), (2.58, 74, 1.3)]
    for t, p, d in melody:
        tpt.note(t, p + 12, d, 112, human=False)
        horn.note(t, p, d, 100, human=False)
    brass.chord(.72, [57, 62, 66], .4, 96)
    brass.chord(1.58, [59, 62, 67], .48, 96)
    brass.chord(2.10, [57, 61, 64], .45, 92)
    brass.chord(2.58, [57, 62, 66, 69, 74], 1.3, 112)
    for t, p, d in [(.32, 38, .38), (.72, 45, .4), (1.16, 43, .4), (1.58, 47, .48), (2.10, 45, .45), (2.58, 38, 1.3)]:
        bone.chord(t, [p + 12, p + 19], d, 100, human=False)
        tuba.note(t, p, d, 100, human=False)
    strings.chord(2.58, [50, 57, 62, 66, 69, 74, 78], 1.3, 96)
    for t, v in [(.32, 92), (.72, 100), (1.58, 104)]:
        timp.note(t, 38 if t != .72 else 45, .4, v, human=False)
        drum.note(t, KIT['kick'], .3, v, human=False)
    for k in range(12):  # snare and timpani roll into the final chord
        drum.note(2.1 + k * .04, KIT['snare'], .04, 70 + k * 4, human=False)
        timp.note(2.1 + k * .04, 45, .05, 70 + k * 3, human=False)
    timp.note(2.58, 38, 1.2, 120, human=False)
    drum.note(2.58, KIT['kick'], .5, 120, human=False)
    drum.note(2.58, KIT['crash'], 1.6, 104, human=False)
    drum.note(2.58, KIT['crash2'], 1.6, 86, human=False)
    for t in (1.16, 1.30, 1.44):
        drum.note(t, KIT['snare'], .05, 80, human=False)
    return s, 3.9


old = ROOT / 'assets/audio/level-up.mp3'
if old.exists():
    old.unlink()
for kind, build, title, what in [
        ('skill', skill, 'Eldervale Level Up', 'trumpet, flute, strings, harp, glockenspiel and timpani'),
        ('combat', combat, 'Eldervale Combat Level Up', 'trumpets, horns, trombones, tuba, timpani, snare and cymbals')]:
    score, length = build()
    out = ROOT / f'assets/audio/level-up-{kind}.mp3'
    info = produce(score, length, out, target_lufs=-15, loop=False, bitrate='128k', tail=.9, fade=.8)
    credit(dict(id=f'level-up-{kind}', title=title, source='/scripts/build-level-jingle.py', file=f'/assets/audio/level-up-{kind}.mp3',
                duration=info['duration'], changes=f'Original level-up fanfare ({what}) composed for Eldervale; '
                'MIDI rendered with FluidSynth and the FluidR3 GM SoundFont (MIT).', **LICENSE))
    print(kind, info)
