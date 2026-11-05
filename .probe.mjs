import fs from 'node:fs';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const b=fs.readFileSync('assets/weapons/weapons.glb');const t0=Date.now();
const g=await new Promise((res,rej)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',res,rej));
console.log('parsed in',Date.now()-t0,'ms');for(const n of g.scene.children){n.updateMatrixWorld(true);const bx=new T.Box3().setFromObject(n);console.log(n.name.padEnd(16),bx.min.toArray().map(v=>v.toFixed(2)).join(','),'|',bx.max.toArray().map(v=>v.toFixed(2)).join(','))}
