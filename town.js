// Oakcross is the central town. Outlying hamlets keep their smaller cottages.
// Width/depth change the world transform, shared by collision and map outlines.
export const oakcrossBuildings=[
 {x:-19,z:-19,color:0xaaa79a,scale:1.8,width:1.55,depth:1.35,type:'bank',name:'Oakcross Bank',stone:true,roof:0x485d68,open:true},
 {x:-5,z:-25,color:0xb8a480,scale:1.65,type:'armory',name:'Starter Armory',stone:true,roof:0x79503b},
 {x:10,z:-29,color:0xb8b4a6,scale:1.85,width:1.6,depth:1.3,type:'hall',name:'Oakcross Town Hall',stone:true,roof:0x485d68,open:true},
 {x:27,z:-12,color:0x8b8d85,scale:1.7,width:1.3,type:'forge',name:'The Ember Forge',stone:true,roof:0x564e48,open:true},
 {x:34,z:3,color:0xc1ad8b,scale:1.6,type:'home',name:'Weaver’s Cottage',roof:0x936339},
 {x:25,z:20,color:0xd0b68e,scale:1.9,width:1.65,depth:1.3,type:'inn',name:'The Stag & Lantern',roof:0x773f31,open:true},
 {x:10,z:32,color:0xb3a58e,scale:1.6,type:'home',name:'Southgate House',roof:0x75614a},
 {x:-3,z:32,color:0xc3b092,scale:1.6,type:'home',name:'Baker’s House',roof:0x994e37},
 {x:-23,z:23,color:0xb1b4ac,scale:1.8,depth:1.6,type:'chapel',name:'Chapel of the Dawn',stone:true,roof:0x4c6067,open:true},
 {x:-32,z:5,color:0xc3b99d,scale:1.65,type:'home',name:'Westgate Cottage',roof:0x775238},
 {x:-34,z:-16,color:0x8f978d,scale:1.65,type:'home',name:'Mason’s House',stone:true,roof:0x535f63},
 {x:30,z:-30,color:0xadad9f,scale:1.65,type:'home',name:'Northgate House',stone:true,roof:0x695c48},
 {x:39,z:30,color:0xc5b99b,scale:1.6,type:'home',name:'Eastfield Cottage',roof:0x8b5739}
];

export function decorateTownBuilding(T,record,{box,material}){
 const {group:g,type,roofParts}=record;
 const b=(w,h,d,color,x,y,z,kind='wood')=>box(w,h,d,color,x,y,z,g,kind);
 const removable=mesh=>{roofParts.push(mesh);return mesh};
 const table=(x,z)=>{b(1.25,.12,.65,0x79583a,x,.85,z);for(const dx of [-.45,.45])b(.12,.7,.48,0x573d2d,x+dx,.44,z)};
 if(type==='bank'){
  // Tellering hall, two service windows, rear vault and deposit chests.
  for(const x of [-1.05,1.05]){
   b(1.35,.85,.42,0x6b4b31,x,.55,-.38);b(1.43,.12,.53,0xb19a65,x,1.03,-.38);
   for(const dx of [-.57,.57])b(.055,.8,.06,0xb49a55,x+dx,1.48,-.38,'stone');
   b(1.25,.07,.07,0xb49a55,x,1.87,-.38,'stone');
   for(let i=0;i<3;i++)b(.12,.05,.12,0xd5af51,x-.25+i*.2,1.13,-.35,'stone');
  }
  b(1.02,1.7,.15,0x4a5151,0,.98,-1.64,'stone');
  for(const dx of [-.37,.37])b(.07,1.45,.04,0xb4a16d,dx,1.0,-1.54,'stone');
  const wheel=new T.Mesh(new T.TorusGeometry(.19,.035,6,16),material(0xc0ac78));wheel.position.set(0,1.1,-1.49);g.add(wheel);
  for(const x of [-1.35,1.35]){b(.58,.5,.5,0x61462f,x,.38,-1.28);b(.62,.08,.54,0xaa925c,x,.67,-1.28,'stone')}
  for(const x of [-.72,.72]){b(.2,2.3,.24,0xd1cbb3,x,1.28,1.97,'masonry');b(.33,.15,.34,0xbcb69e,x,.24,1.97,'masonry')}
  b(1.85,.24,.45,0xc6bda3,0,2.49,1.97,'masonry');
 }else if(type==='hall'){
  b(2.7,.32,1.1,0x777970,0,.28,-.9,'masonry');table(0,-.95);
  for(const x of [-1.25,1.25])for(const z of [-.1,.8])b(.6,.35,.45,0x75583c,x,.3,z);
  for(const x of [-1.2,1.2])b(.3,1.4,.06,0x244c60,x,1.95,1.95,'cloth');
  const tower=removable(b(.95,1.7,1.05,0xa6a699,0,4.45,0,'masonry'));
  removable(b(1.18,.18,1.25,0xddd2af,0,5.3,0,'masonry'));
  const clock=new T.Mesh(new T.CircleGeometry(.27,24),material(0xe4d4a1));clock.position.set(0,4.65,.535);g.add(clock);roofParts.push(clock);
  removable(b(.025,.22,.035,0x3a3c35,0,4.73,.56,'stone'));removable(b(.18,.025,.035,0x3a3c35,.08,4.65,.56,'stone'));
 }else if(type==='inn'){
  for(const x of [-1.1,1.1]){table(x,.2);for(const z of [-.4,.8])b(1,.3,.25,0x6d4b30,x,.35,z)}
  b(2.7,.9,.5,0x68442c,0,.55,-1.25);b(2.85,.12,.62,0x98774b,0,1.06,-1.25);
  for(const x of [-1.1,-.4,.4,1.1])b(.16,.22,.16,0xc7ae73,x,1.23,-1.25,'stone');
  for(const side of [-1,1]){b(.14,2.95,.12,0x59412d,side*1.05,1.55,1.96);b(3.8,.13,.15,0x59412d,0,2.25,1.96)}
 }else if(type==='forge'){
  b(1.1,1.7,.8,0x5e625c,-1,1,-1.1,'masonry');b(.7,.45,.05,0x201e19,-1,.68,-.67,'stone');
  b(.52,.16,.06,0xe7a24f,-1,.5,-.62,'stone');
  b(.7,.55,.5,0x596367,.7,.4,.2,'stone');b(1,.18,.45,0x858c88,.7,.76,.2,'stone');
  removable(b(.6,2.4,.6,0x777b70,-1.1,4.1,-1.05,'masonry'));
 }else if(type==='chapel'){
  for(const x of [-1.05,1.05])for(const z of [-.7,.2,.9]){b(.8,.35,.35,0x725639,x,.35,z);b(.8,.55,.1,0x725639,x,.65,z-.17)}
  b(1.3,.8,.48,0xc7bfa5,0,.55,-1.35,'masonry');
  removable(b(.9,1.5,.85,0xb4b7ae,0,4.4,-.85,'masonry'));
  const bell=new T.Mesh(new T.ConeGeometry(.22,.35,10),material(0xba9950));bell.position.set(0,4.5,-.39);g.add(bell);roofParts.push(bell);
  removable(b(.08,.7,.08,0xd9bb70,0,5.5,-.85,'stone'));removable(b(.45,.08,.08,0xd9bb70,0,5.6,-.85,'stone'));
 }else if(type==='home'){
  table(-.8,-.9);b(.85,.3,1.4,0x6b5038,1,.3,-.7);b(.75,.14,1.2,0x7e8a76,1,.52,-.7,'cloth');
 }
}
