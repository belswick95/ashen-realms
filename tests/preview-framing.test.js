import test from 'node:test';import assert from 'node:assert/strict';
import {previewFraming,previewFrame} from '../preview-framing.js';

const fits=({distance,aimY},frame,fov,aspect)=>{const tan=Math.tan(fov*Math.PI/360),halfH=distance*tan,halfW=halfH*aspect;return frame.top<=aimY+halfH+1e-9&&frame.bottom>=aimY-halfH-1e-9&&frame.width/2<=halfW+1e-9};

test('creator camera keeps the whole body (feet to hair) or the head in view at any aspect',()=>{
 const pose={headY:2.53,crownY:2.79};
 for(const mode of ['body','face'])for(const aspect of [.55,.8,1,1.6,2.4]){const frame=previewFrame(mode,pose),view=previewFraming({...frame,fov:30,aspect});assert.ok(fits(view,frame,30,aspect),mode+' '+aspect);if(mode==='body')assert.ok(Math.abs(view.aimY-(frame.top+frame.bottom)/2)<1e-12)}
 // On a tall canvas the close-up keeps the hair near the top edge.
 {const frame=previewFrame('face',pose),v=previewFraming({...frame,fov:30,aspect:.6}),top=v.aimY+v.distance*Math.tan(Math.PI/12);assert.ok(top-frame.top<.1)}
 const body=previewFrame('body',pose),face=previewFrame('face',pose);
 assert.ok(body.bottom<0&&body.top>pose.crownY,'feet and hair inside the body frame');
 assert.ok(face.bottom>1.8&&face.top>pose.crownY,'face frame is a head-and-shoulders close-up');
 // The close-up sits much nearer than the full-body shot.
 assert.ok(previewFraming({...face,fov:30,aspect:.8}).distance<previewFraming({...body,fov:30,aspect:.8}).distance*.6);
 // A narrow (portrait) canvas moves the camera back so the arms are not cut.
 assert.ok(previewFraming({...body,fov:30,aspect:.3}).distance>previewFraming({...body,fov:30,aspect:1}).distance);
});
