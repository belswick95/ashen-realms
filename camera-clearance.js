// Sample more densely than one terrain cell so narrow ridges cannot hide the player.
export function terrainCameraClearance(heightAt,focus,camera,margin=2){
 const distance=Math.hypot(camera.x-focus.x,camera.z-focus.z),samples=Math.max(12,Math.ceil(distance/.7));let lift=0;
 for(let i=1;i<=samples;i++){const t=i/samples,x=focus.x+(camera.x-focus.x)*t,z=focus.z+(camera.z-focus.z)*t,rayY=focus.y+1.35+(camera.y-focus.y-1.35)*t;lift=Math.max(lift,(heightAt(x,z)+margin-rayY)/t)}return Math.max(0,lift);
}
