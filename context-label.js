import {crownSVG,hasStaffCrown} from './chat-feed.js?v=release-20261105-walkanim64';
export function levelRelation(playerLevel,targetLevel){const difference=targetLevel-playerLevel;return difference<0?'lower':difference===0?'equal':difference<=5?'near':'danger';}
export function actorMenuLabel({name,level,playerLevel,prefix='',accountId=null,player=false}){
 const row=document.createElement('span');row.className='actor-menu-label'+(player?' player-menu-heading':'');
 if(prefix)row.append(document.createTextNode(prefix));
 if(hasStaffCrown(accountId)){const crown=document.createElement('span');crown.className='menu-admin-crown';crown.innerHTML=crownSVG;crown.title='Eldervale administrator';row.append(crown)}
 row.append(document.createTextNode(String(name||'Adventurer')));
 const number=Math.max(1,Math.floor(Number(level)||1)),suffix=document.createElement('span');suffix.className='menu-combat-level level-'+levelRelation(playerLevel,number);suffix.textContent=' (level-'+number+')';row.append(suffix);return row;
}
