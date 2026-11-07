"""Generate the original Crown of the Heartlands score (NumPy + ffmpeg).

First written for Eldervale Castle; it now plays softly over the open world
(wilderness, see audio-regions.js wildernessMusic) under the nature beds.
Loudness is matched to the other region tracks (-19 LUFS); the quiet
wilderness level is a per-track gain in the mixer, not baked into the file."""
from pathlib import Path
import numpy as np, wave, subprocess, json, sys, tempfile
sys.path.insert(0,str(Path(__file__).resolve().parent))
from midi_score import encode
root=Path(__file__).resolve().parent.parent
rate=22050;beat=60/76;duration=32*4*beat;out=np.zeros((int((duration+3)*rate),2),dtype=np.float64)
rng=np.random.default_rng(305340)
def note(start,midi,length,volume,voice='lute',pan=0):
    f=440*2**((midi-69)/12);t=np.arange(int(length*rate))/rate
    if voice=='flute':
        wave=np.sin(2*np.pi*f*t+.011*np.sin(2*np.pi*4.7*t))+.19*np.sin(2*np.pi*2*f*t)+.035*np.sin(2*np.pi*3*f*t)
        envelope=np.minimum(1,t/.11)*np.minimum(1,(length-t)/.20)*.65
    elif voice=='strings':
        wave=sum(np.sin(2*np.pi*f*k*t+.2*k)/k**1.7 for k in range(1,6));envelope=np.minimum(1,t/.4)*np.minimum(1,(length-t)/.5)*.45
    else:
        wave=sum(np.sin(2*np.pi*f*k*t)*np.exp(-t*(1.8+k*.8))/k**1.5 for k in range(1,7));envelope=np.minimum(1,t/.008)*np.minimum(1,(length-t)/.09)
    x=wave*envelope*volume;first=int(start*rate);n=min(len(x),len(out)-first)
    if n>0:out[first:first+n,0]+=x[:n]*np.sqrt((1-pan)/2);out[first:first+n,1]+=x[:n]*np.sqrt((1+pan)/2)
chords=[[50,57,62,65],[48,55,60,64],[46,53,58,62],[45,52,57,61],[50,57,62,65],[53,60,65,69],[48,55,60,64],[45,52,57,61]]
melody=[[74,77,76,74,72,69],[72,76,79,76,74,72],[70,74,77,74,72,70],[69,73,76,73,69,67],[74,77,81,79,77,74],[77,81,84,81,79,77],[76,79,77,76,72,74],[73,76,74,73,69,73]]
for bar in range(32):
    start=bar*4*beat;c=chords[bar%8]
    for i in range(8):note(start+i*beat/2,c[[0,2,1,3,2,1,3,2][i]]+12,2*beat,.13,'lute',-.25)
    note(start,c[0]-12,3.9*beat,.15,'strings',.1)
    for pitch in c[1:]:note(start,pitch,4*beat,.042,'strings',.35)
    notes=melody[bar%8]
    for j,pitch in enumerate(notes):
        if bar//8==2:pitch-=12
        note(start+j*(4/6)*beat,pitch,(4/6)*beat*.92,.10 if bar<8 else .13,'flute',.08)
# Soft cross-channel room reflections, then fold the final tail into the opening.
for delay,gain in [(.087,.12),(.173,.09),(.327,.065),(.519,.04)]:
    n=int(delay*rate);out[n:]+=out[:-n,::-1].copy()*gain
n=int(duration*rate);out[:len(out)-n]+=out[n:];out=out[:n];out*=.82/np.max(np.abs(out))
# A tiny seam ramp avoids an MP3 decoder click without silencing the musical loop.
ramp=int(.012*rate);out[:ramp]*=np.linspace(0,1,ramp)[:,None];out[-ramp:]*=np.linspace(1,0,ramp)[:,None]
wav=Path(tempfile.mkdtemp(prefix='eldervale-wild-'))/'wilderness.wav'
with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes((out*32767).astype('<i2').tobytes())
encode(wav,root/'assets/audio/wilderness.mp3',-19,'112k',limit=False)
credits=root/'assets/audio/credits.json';data=json.loads(credits.read_text());data=[x for x in data if x['id'] not in ('castle','wilderness')];data.append(dict(id='wilderness',title='Crown of the Heartlands',artist='Eldervale',source='/scripts/compose-wilderness.py',license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/',file='/assets/audio/wilderness.mp3',duration=round(duration,2),changes='Original synthesized lute, flute and strings composition written for Eldervale; plays quietly in the open wilderness.'));credits.write_text(json.dumps(data,indent=2)+'\n')
print('Wilderness track:',round(duration,1),'seconds')
