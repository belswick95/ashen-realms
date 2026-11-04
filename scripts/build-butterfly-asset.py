import bpy,math,base64,json
from pathlib import Path
from mathutils import Vector
obj=bpy.data.objects['Butterfly'];arm=bpy.data.objects['Armature'];arm.animation_data.action=bpy.data.actions['Flying'];frames=[];uvs=[];indices=[];mapping={}
for step in range(20):
 bpy.context.scene.frame_set(step//2,subframe=(step%2)*.5);deps=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();matrix=evaluated.matrix_world
 if step==0:
  for tri in mesh.loop_triangles:
   for li in tri.loops:
    loop=mesh.loops[li];uv=mesh.uv_layers.active.data[li].uv;key=(loop.vertex_index,round(uv.x,6),round(uv.y,6))
    if key not in mapping:mapping[key]=len(mapping);uvs.extend([uv.x,uv.y])
    indices.append(mapping[key])
 pts=[]
 for key in mapping:
  v=matrix@mesh.vertices[key[0]].co;pts.append([v.x,v.z,-v.y])
 frames.append(pts);evaluated.to_mesh_clear()
span=max(v[0] for frame in frames for v in frame)-min(v[0] for frame in frames for v in frame);scale=.24/span
from array import array
packed=array('h',(round(x*scale*10000) for frame in frames for vertex in frame for x in vertex))
out={'author':'Čestmír Dammer (CDmir), TinyWorlds; UV photographs by Rick Hoppmann','license':'CC0-1.0','parts':[{'indices':indices,'uv':[round(v,6) for v in uvs],'vertexCount':len(mapping),'frameCount':len(frames),'packed':base64.b64encode(packed.tobytes()).decode()}]}
Path(bpy.path.abspath('//butterfly-baked.json')).write_text(json.dumps(out,separators=(',',':')));print('BAKED',len(mapping),'vertices',len(indices)//3,'triangles')
