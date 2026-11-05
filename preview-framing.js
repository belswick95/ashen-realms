// Camera framing for the creator: the whole body (feet to hair, with a margin)
// or a head-and-shoulders close-up, fitted to the canvas aspect so nothing is
// cut off on wide desktop, tall tablet or short phone-landscape previews.
// `top`/`bottom` are world heights to keep in view, `width` the width needed.
// Returns the camera distance and the height to aim at. Pure (unit tested).
export function previewFraming({top,bottom,width,fov,aspect,margin=1.12,anchor='middle'}){
 const tan=Math.tan(fov*Math.PI/360),height=(top-bottom)*margin,needW=width*margin;
 const distance=Math.max(height/2/tan,needW/2/(tan*Math.max(.1,aspect)));
 // A close-up on a tall canvas keeps the face near the top, not mid-chest.
 const half=distance*tan;return {distance,aimY:anchor==='top'?top+(height-(top-bottom))/2-half:(top+bottom)/2};
}
// Body and face frames, in character heights (head bone ≈ 2.53 for a male).
export function previewFrame(mode,{headY,crownY}){
 return mode==='face'?{top:crownY+.16,bottom:headY-.5,width:1.05,anchor:'top'}:{top:crownY+.12,bottom:-.08,width:1.25};
}
