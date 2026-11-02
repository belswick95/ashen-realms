import * as T from 'three';
export function overlap(a,b){
 if(!new T.Box3().setFromObject(a).intersectsBox(new T.Box3().setFromObject(b)))return false;
 function poly(m){const p=m.geometry.attributes.position,idx=m.geometry.index,vertices=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld)),normals=[],edges=[];for(let i=0;i<(idx?idx.count:p.count);i+=3){const v=[0,1,2].map(j=>vertices[idx?idx.getX(i+j):i+j]),ab=v[1].clone().sub(v[0]),ac=v[2].clone().sub(v[0]);normals.push(new T.Vector3().crossVectors(ab,ac));edges.push(ab,ac,v[2].clone().sub(v[1]))}return {vertices,normals,edges}}
 const A=poly(a),B=poly(b),seen=new Set();
 function separated(n){if(n.lengthSq()<1e-12)return false;n.normalize();if(n.x<0||n.x===0&&n.y<0)n.negate();const key=n.toArray().map(v=>v.toFixed(4)).join(',');if(seen.has(key))return false;seen.add(key);let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const v of A.vertices){const d=v.dot(n);amin=Math.min(amin,d);amax=Math.max(amax,d)}for(const v of B.vertices){const d=v.dot(n);bmin=Math.min(bmin,d);bmax=Math.max(bmax,d)}return amax<bmin+.00001||bmax<amin+.00001}
 for(const n of [...A.normals,...B.normals])if(separated(n))return false;
 for(const e of A.edges)for(const f of B.edges)if(separated(new T.Vector3().crossVectors(e,f)))return false;
 return true;
}
