import numpy as np,json,pathlib,base64
from scipy.spatial import ConvexHull
import argparse
args=argparse.ArgumentParser();args.add_argument('--source',required=True,type=pathlib.Path);config=args.parse_args();D=config.source;v=[];uv=[];faces=[];groups={};g=''
for l in (D/'base.obj').read_text().splitlines():
 if l.startswith('v '):v.append(list(map(float,l.split()[1:])))
 elif l.startswith('vt '):uv.append(list(map(float,l.split()[1:3])))
 elif l.startswith('g '):g=l[2:];groups.setdefault(g,[])
 elif l.startswith('f '):
  f=[tuple(int(x)-1 for x in t.split('/')[:2]) for t in l.split()[1:]];groups[g].extend(i[0] for i in f)
  if g=='body':
   for i in range(1,len(f)-1):faces.append([f[0],f[i],f[i+1]])
v=np.array(v);baseVertices=v.copy();uv=np.array(uv)
# Explicit authored adult male macro, not the neutral/female base silhouette.
for target in ['caucasian-male-young.target','universal-male-young-averagemuscle-averageweight.target']:
 for line in (D/target).read_text().splitlines():
  if line and not line.startswith('#'):
   vals=line.split()
   if len(vals)==4:v[int(vals[0])]+=np.array(list(map(float,vals[1:])))
body_indices=list(set(i for f in faces for i,_ in f));body_min=v[body_indices,1].min();body_max=v[body_indices,1].max();S=2.75/(body_max-body_min);origin=np.array([0,body_min,.45])
def joint(n):return v[groups['joint-'+n]].mean(0)
def point(p):return (p-origin)*S+np.array([0,.015,0])
def rotation(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);c=np.cross(a,b);d=np.dot(a,b);K=np.array([[0,-c[2],c[1]],[c[2],0,-c[0]],[-c[1],c[0],0]]);return np.eye(3)+K+K@K/(1+d)
names=['base','head','leftArm','leftElbow','leftHand','rightArm','rightElbow','rightHand','leftLeg','leftKnee','leftAnkle','rightLeg','rightKnee','rightAnkle'];index={n:i for i,n in enumerate(names)};targets={'base':np.array([0,0,0]),'head':point(joint('head'))};transforms={'base':lambda p:point(p),'head':lambda p:targets['head']+(p-joint('head'))*S*1.07};lengths={}
for side,prefix in [('l','left'),('r','right')]:
 A=joint(side+'-shoulder');B=joint(side+'-elbow');C=joint(side+'-hand');hip=joint(side+'-upper-leg');knee=joint(side+'-knee');ankle=joint(side+'-ankle');s=1 if side=='l' else -1
 shoulder=point(A);upper=np.linalg.norm(B-A)*S;lower=np.linalg.norm(C-B)*S;targets[prefix+'Arm']=shoulder;targets[prefix+'Elbow']=shoulder+np.array([0,-upper,0]);targets[prefix+'Hand']=shoulder+np.array([0,-upper-lower,0]);lengths[prefix+'Arm']=[upper,lower]
 up=np.linalg.norm(knee-hip)*S;low=np.linalg.norm(ankle-knee)*S;targets[prefix+'Leg']=point(hip);targets[prefix+'Knee']=point(hip)+np.array([0,-up,0]);targets[prefix+'Ankle']=point(hip)+np.array([0,-up-low,0]);lengths[prefix+'Leg']=[up,low]
 for label,start,end in [(prefix+'Arm',A,B),(prefix+'Elbow',B,C),(prefix+'Leg',hip,knee),(prefix+'Knee',knee,ankle)]:
  R=rotation(end-start,np.array([0,-1,0]));transforms[label]=lambda p,R=R,start=start,target=targets[label]:target+R@(p-start)*S
 transforms[prefix+'Ankle']=lambda p,start=ankle,target=targets[prefix+'Ankle']:target+(p-start)*S
 # Put the complete authored palm and fingers into a neutral gripping pose.
 forward=joint(side+'-finger-3-1')-C;forward/=np.linalg.norm(forward);across=joint(side+'-finger-2-1')-joint(side+'-finger-5-1');across-=forward*np.dot(across,forward);across/=np.linalg.norm(across);normal=np.cross(across,-forward)
 def hand(p,C=C,target=targets[prefix+'Hand'],across=across,forward=forward,normal=normal,s=s):
  d=p-C;row=np.dot(d,across)*S;length=np.dot(d,forward)*S;depth=np.dot(d,normal)*S
  return target+np.array([s*row,-length,s*depth])
 transforms[prefix+'Hand']=hand
skel=json.load(open(D/'default.mhskel'));weights=json.load(open(D/'default_weights.mhw'))['weights']
def mapped(bone):
 b=bone
 while b in skel['bones']:
  side='left' if b.endswith('.L') else 'right'
  if b.startswith('upperarm'):return side+'Arm'
  if b.startswith('lowerarm'):return side+'Elbow'
  if b.startswith(('wrist','finger')):return side+'Hand'
  if b.startswith('upperleg'):return side+'Leg'
  if b.startswith('lowerleg'):return side+'Knee'
  if b.startswith(('foot','toe')):return side+'Ankle'
  if b=='head':return 'head'
  b=skel['bones'][b]['parent']
 return 'base'
w=[{} for _ in v]
for bone,items in weights.items():
 target=mapped(bone)
 for i,weight in items:w[i][target]=w[i].get(target,0)+weight
posed=[];si=[];sw=[]
for i,p in enumerate(v):
 ws=sorted(w[i].items(),key=lambda x:-x[1])[:4] or [('base',1)];total=sum(a for _,a in ws);ws=[(a,b/total) for a,b in ws];q=sum(transforms[a](p)*b for a,b in ws);posed.append(q);si.append([index[a] for a,b in ws]+[0]*(4-len(ws)));sw.append([b for a,b in ws]+[0]*(4-len(ws)))
posed=np.array(posed);parts={}
def part_for(f):
 src=baseVertices[[a[0] for a in f]];c=src.mean(0);bw={}
 for a,_ in f:
  for bone,weight in w[a].items():bw[bone]=bw.get(bone,0)+weight/3
 b=max(bw,key=bw.get)
 if c[1]>5.97:return 'head'
 if b.endswith('Ankle'):return b.replace('Ankle','Foot')
 if b.endswith('Hand'):return b
 if b.endswith('Elbow') and bw[b]>.55:return 'skin'
 if c[1]>1.3 or b.endswith('Arm'):return 'shirt'
 return 'pants'
for f in faces:parts.setdefault(part_for(f),[]).append(f)
def pack(a,dtype):return base64.b64encode(np.array(a,dtype=dtype).tobytes()).decode()
out={'author':'MakeHuman Community','license':'CC0','sex':'male','age':'adult','source':'https://github.com/makehumancommunity/makehuman','bones':names,'targets':{k:np.round(v,6).tolist() for k,v in targets.items()},'lengths':lengths,'parts':{},'landmarks':{name:np.round(point(joint(name)),6).tolist() for name in ['l-eye','r-eye','jaw','neck','head']}}
for name,fs in parts.items():
 keys={};positions=[];tex=[];skins=[];values=[];indices=[]
 for f in fs:
  for vi,ui in f:
   key=(vi,ui)
   if key not in keys:
    keys[key]=len(keys);q=posed[vi].copy()
    if name=='pants' and -1.8<v[vi,1]<.5 and abs(v[vi,0])<.8:q[2]=min(q[2],.15)
    if name in ['shirt','pants']:q[0]*=1.025;q[2]+=.008 if q[2]>0 else -.008
    positions.extend(q);tex.extend(uv[ui]);skins.extend(si[vi]);values.extend(sw[vi])
   indices.append(keys[key])
 if name.endswith('Foot'):
  points=np.array(positions).reshape(-1,3);hull=ConvexHull(points);closed=[]
  for face,eq in zip(hull.simplices,hull.equations):
   a,b,c=face
   if np.dot(np.cross(points[b]-points[a],points[c]-points[a]),eq[:3])<0:b,c=c,b
   closed.extend([int(a),int(b),int(c)])
  indices=closed
 out['parts'][name]={'positions':pack(positions,'<f4'),'uv':pack(tex,'<f4'),'skinIndex':pack(skins,'<u2'),'skinWeight':pack(values,'<f4'),'indices':pack(indices,'<u2')};print(name,len(keys),len(indices)//3)
(pathlib.Path(__file__).resolve().parent.parent/'full-human-asset.js').write_text('// Complete CC0 MakeHuman hm08 body, adapted weights and clothing partitions. See assets/models/human-LICENSE.md.\nexport const fullHumanAsset='+json.dumps(out,separators=(',',':'))+';\n')
print('LENGTHS',lengths,'TARGETS',out['targets'])
