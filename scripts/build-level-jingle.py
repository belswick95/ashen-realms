import numpy as np,wave
rate=44100;duration=5.15;t=np.arange(int(rate*duration))/rate;out=np.zeros_like(t)
# Original Eldervale fanfare: bright bell/harp arpeggio and a soft resolving chord.
notes=[(0,67,.38),(.26,71,.38),(.52,74,.46),(.86,79,.64),(1.35,78,.46),(1.68,74,.44),(2.05,76,.58),(2.55,79,1.8),(2.65,71,1.7),(2.75,67,1.65),(2.85,55,1.65)]
for start,midi,length in notes:
 u=t-start;valid=(u>=0)&(u<length);v=u[valid];freq=440*2**((midi-69)/12);env=(1-np.exp(-v*70))*np.exp(-v*3/length)*np.minimum(1,(length-v)/.15)
 sound=sum(weight*np.sin(2*np.pi*freq*harm*v)*np.exp(-v*harm*.5) for harm,weight in [(1,1),(2,.3),(3,.13),(4,.05)])
 out[valid]+=sound*env*.12
out=np.tanh(out);out*=np.minimum(1,(duration-t)/.45);stereo=np.column_stack((out,np.roll(out,330)*.92));pcm=(stereo*28000).astype('<i2')
with wave.open('/tmp/level-up.wav','wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
