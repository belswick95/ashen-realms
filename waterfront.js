// Match the east shoreline's outline, rather than an ellipse approximation.
export function fishingDock(lake,heightAt){
 const shore=lake.x+lake.rx*(1+.085*Math.sin(lake.x*.17)+.055*Math.sin(lake.z*.13));
 const x=shore-.8,z=lake.z,length=5.6,width=2.4,deckY=.32,thickness=.22;
 const posts=[-1,1].flatMap(a=>[-1,1].map(b=>{const px=x+a*(length/2-.35),pz=z+b*(width/2-.15),bottom=Math.min(-.15,heightAt(px,pz)-.12),top=deckY;return {x:px,z:pz,y:(top+bottom)/2,height:top-bottom,bottom,top}}));
 return {x,z,length,width,deckY,thickness,posts,shore};
}
