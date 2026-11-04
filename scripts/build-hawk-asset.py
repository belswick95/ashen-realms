import xml.etree.ElementTree as E,numpy as np,json,pathlib,urllib.request,base64
import argparse
args=argparse.ArgumentParser();args.add_argument('--source',required=True,type=pathlib.Path);config=args.parse_args();D=config.source;N={'c':'http://www.collada.org/2005/11/COLLADASchema'}
def source(node):
 out={}
 for s in node.findall('c:source',N):
  f=s.find('c:float_array',N);names=s.find('c:Name_array',N);stride=int(s.find('c:technique_common/c:accessor',N).get('stride','1'))
  out[s.get('id')]=np.array(list(map(float,f.text.split()))).reshape(-1,stride) if f is not None else names.text.split()
 return out
anim=E.parse(D/'hawk_flight.dae').getroot();tracks={}
for a in anim.findall('.//c:animation',N):
 ch=a.find('c:channel',N)
 if ch is None:continue
 ss=source(a);sam=a.find('c:sampler',N);inputs={i.get('semantic'):ss[i.get('source')[1:]] for i in sam}
 tracks[ch.get('target').split('/')[0]]=inputs['OUTPUT'].reshape(-1,4,4)
steps=len(next(iter(tracks.values())));print('ANIMATION',steps)
# Inspect raw skeleton, bind pose and animated frame, then bake unique UV vertices.
def load(name):
 r=E.parse(D/name).getroot();skin=r.find('.//c:skin',N);ss=source(skin);ji={i.get('semantic'):ss[i.get('source')[1:]] for i in skin.find('c:joints',N)};joints=ji['JOINT'];inv=ji['INV_BIND_MATRIX'].reshape(-1,4,4)
 mesh=r.find('.//c:mesh',N);ms=source(mesh);vs={i.get('semantic'):ms[i.get('source')[1:]] for i in mesh.find('c:vertices',N)};p=vs['POSITION'];vv=skin.find('c:vertex_weights',N);inputs={i.get('semantic'):(int(i.get('offset')),ss[i.get('source')[1:]]) for i in vv.findall('c:input',N)};stride=max(x[0] for x in inputs.values())+1;flat=list(map(int,vv.find('c:v',N).text.split()));counts=list(map(int,vv.find('c:vcount',N).text.split()));weights=[];cursor=0
 for count in counts:
  w=[]
  for i in range(count):
   v=flat[cursor:cursor+stride];cursor+=stride;w.append((v[inputs['JOINT'][0]],float(inputs['WEIGHT'][1][v[inputs['WEIGHT'][0]]][0])))
  weights.append(w)
 rootnode=r.find('.//c:visual_scene/c:node',N)
 def world(frame=None):
  out={}
  def walk(node,parent):
   mat=node.find('c:matrix',N);m=np.array(list(map(float,mat.text.split()))).reshape(4,4) if mat is not None else np.eye(4)
   if frame is not None and node.get('id') in tracks:m=tracks[node.get('id')][frame]
   w=parent@m;out[node.get('sid') or node.get('id')]=w
   for c in node.findall('c:node',N):walk(c,w)
  walk(rootnode,np.eye(4));return out
 def pose(frame=None):
  mats=world(frame);bm=[mats[j]@inv[i] for i,j in enumerate(joints)];pts=np.zeros((len(p),3))
  for i,w in enumerate(weights):
   v=np.r_[p[i],1.0]
   for j,weight in w:pts[i]+=(bm[j]@v)[:3]*weight
  return pts,mats
 bind,mats=pose();print(name,'bounds',bind.min(0),bind.max(0),'binderr',abs(bind-p).max());print('ANCHORS',[(j,np.round(mats[j][:3,3],3).tolist()) for j in ['Horse_Spine','Horse_Spine_1','Horse_Head','Horse_Hoof_R','Horse_Hoof_L','Hoof_F_R','Hoof_F_L'] if j in mats])
 tris=mesh.find('c:triangles',N);poly=tris is None;tris=mesh.find('c:polylist',N) if poly else tris;inp={i.get('semantic'):(int(i.get('offset')),i.get('source')[1:]) for i in tris.findall('c:input',N) if i.get('semantic')!='TEXCOORD' or i.get('set','0')=='0'};stride=max(x[0] for x in inp.values())+1;raw=np.array(list(map(int,tris.find('c:p',N).text.split()))).reshape(-1,stride);
 if poly:
  triangles=[];cursor=0
  for n in map(int,tris.find('c:vcount',N).text.split()):
   polygon=raw[cursor:cursor+n];cursor+=n
   for j in range(1,n-1):triangles.extend([polygon[0],polygon[j],polygon[j+1]])
  raw=np.array(triangles)
 uv=ms[inp['TEXCOORD'][1]];keys={};vi=[];uvs=[];indices=[]
 for v in raw:
  pair=(int(v[inp['VERTEX'][0]]),int(v[inp['TEXCOORD'][0]]))
  if pair not in keys:keys[pair]=len(keys);vi.append(pair[0]);uvs.extend(uv[pair[1]].tolist())
  indices.append(keys[pair])
 return {'pose':pose,'indices':indices,'uv':uvs,'vi':vi,'world':world}

part=load('hawk.dae');bind,_=part['pose']();scale=.95/(bind[:,0].max()-bind[:,0].min());out={'author':'Wildfire Games','license':'CC-BY-SA-3.0','parts':[]};poses=[]
for frame in [None]+list(range(steps-1)):
 p,_=part['pose'](frame);p=p[part['vi']];p=np.stack([p[:,0]*scale,p[:,2]*scale,-p[:,1]*scale],axis=1);poses.append(p)
packed=np.round(np.array(poses)*10000).astype('<i2');out['parts'].append({'indices':part['indices'],'uv':np.round(part['uv'],5).tolist(),'vertexCount':len(part['vi']),'frameCount':len(poses),'packed':base64.b64encode(packed.tobytes()).decode()})
(D/'hawk-baked.json').write_text(json.dumps(out,separators=(',',':')))
