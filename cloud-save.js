import {toPlayerRow} from './player-save.js?v=release-20261107-trapdoor138';
// Serializes writes so a slower older request cannot overwrite a newer snapshot.
// Pending snapshots are isolated by authenticated account and survive reloads.
export function createSaveCoordinator({storage,getUser,readSave,writeRow,onStatus=()=>{}}){
 let queue=Promise.resolve();
 const key=id=>'eldervale-pending-save:'+id;
 function pending(id){try{const raw=storage.getItem(key(id));return raw?JSON.parse(raw):null}catch{return null}}
 function stash(){const user=getUser(),raw=readSave();if(!user?.id||!raw)return null;try{JSON.parse(raw);storage.setItem(key(user.id),raw);return {user,raw}}catch(error){onStatus('Unable to preserve local progress',true);throw error}}
 function flush(){
  let snapshot;try{snapshot=stash()}catch{return Promise.resolve(false)}
  if(!snapshot)return Promise.resolve(false);
  const {user,raw}=snapshot;let row;try{row=toPlayerRow(JSON.parse(raw),user)}catch{onStatus('Unable to save character',true);return Promise.resolve(false)}
  const operation=async()=>{try{
   await writeRow(row);
   if(storage.getItem(key(user.id))===raw)storage.removeItem(key(user.id));
   if(getUser()?.id===user.id)onStatus('Saved to cloud',false);
   return true;
  }catch(error){if(getUser()?.id===user.id)onStatus('Save failed — progress retained on this device',true);return false}};
  const result=queue.then(operation,operation);queue=result.then(()=>{});return result;
 }
 return {flush,stash,pending};
}
