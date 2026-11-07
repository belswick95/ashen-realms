import {skillLevel,hitpointsLevel,combatLevel,crossedSwords} from './combat-level.js?v=release-20261107-music156';
import {professionSkills} from './profession-data.js?v=release-20261107-music156';
import {skillFamily} from './jingles.js?v=release-20261107-music156';
const combatIcons={attack:'⚔',strength:'💪',defence:'🛡',hitpoints:'❤️',ranged:'🏹',magic:'✨',prayer:'🙏'};
export const levelSkills=[...['attack','strength','defence','hitpoints','ranged','magic','prayer'].map(id=>({name:id==='hitpoints'?'Hitpoints':id[0].toUpperCase()+id.slice(1),key:id+'XP',icon:combatIcons[id]})),...Object.values(professionSkills)];
// Notices in RuneScape order: every skill that advanced, then the combat level.
export function createLevelTracker(){let previous=null;return {update(state){const next=Object.fromEntries(levelSkills.map(s=>[s.key,(s.key==='hitpointsXP'?hitpointsLevel:skillLevel)(state[s.key])])),combat=combatLevel(state),notices=[];if(previous){for(const s of levelSkills)if(next[s.key]>previous[s.key])notices.push({type:'skill',name:s.name,key:s.key,icon:s.icon,level:next[s.key],from:previous[s.key]});if(combat>previous.combat)notices.push({type:'combat',name:'Combat',key:'combat',level:combat,from:previous.combat})}previous={...next,combat};return notices},reset(){previous=null}}}
// The chatbox lines, worded as in RuneScape.
export function levelUpText(notice){
 if(notice.type==='combat')return {title:'Congratulations, you just advanced a combat level.',body:'Your combat level is now '+notice.level+'.'};
 const a=/^[AEIOU]/.test(notice.name)?'an':'a';
 return {title:'Congratulations, you just advanced '+a+' '+notice.name+' level.',body:'Your '+notice.name+' level is now '+notice.level+'.'+(notice.name==='Hitpoints'?' Your maximum HP is now '+notice.level*10+'.':'')};
}
export const jingleFor=notice=>notice.type==='combat'?'combatLevel':skillFamily(notice.key);
// RuneScape-style level-up box over the chat area. It never blocks play: you
// can keep walking and fighting; "Click here to continue", Space, or a click on
// the world dismisses it and shows the next notice (each skill, then combat).
export function createLevelUpPanel({play=()=>{},onShow=()=>{},canShow=()=>true}={}){
 const tracker=createLevelTracker(),queue=[];let showing=null,account=null,shownAt=0;
 const css=document.createElement('link');css.rel='stylesheet';css.href='./level-up.css?v=release-20261107-music156';document.head.append(css);
 const panel=document.createElement('section');panel.id='level-up-panel';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
 panel.innerHTML='<div class="level-up-icon" aria-hidden="true"></div><div class="level-up-words"><strong class="level-up-title"></strong><p class="level-up-body"></p><button type="button" class="level-up-continue">Click here to continue</button></div>';document.body.append(panel);
 function next(){if(showing||!queue.length||!canShow()||document.hidden)return;showing=queue.shift();const combat=showing.type==='combat',text=levelUpText(showing);
  panel.querySelector('.level-up-icon').innerHTML=combat?crossedSwords:'';if(!combat)panel.querySelector('.level-up-icon').textContent=showing.icon||'★';
  panel.querySelector('.level-up-title').textContent=text.title;panel.querySelector('.level-up-body').textContent=text.body;panel.classList.toggle('combat',combat);panel.hidden=false;shownAt=performance.now();
  if(!showing.played){showing.played=true;play(jingleFor(showing),showing);onShow(showing)}}
 function continueNotice(){if(!showing)return;panel.hidden=true;showing=null;setTimeout(next,180)}
 panel.querySelector('button').addEventListener('click',e=>{e.stopPropagation();continueNotice()});
 // Space continues; a click/tap on the game world dismisses it (after a short
 // grace period so the click that earned the level does not close it).
 const key=e=>{if(showing&&e.code==='Space'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();continueNotice()}};
 const world=e=>{if(showing&&e.target?.tagName==='CANVAS'&&performance.now()-shownAt>700)continueNotice()};
 addEventListener('keydown',key);addEventListener('pointerdown',world,true);
 const timer=setInterval(next,400);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 return {sync(state,userId){if(account!==null&&account!==userId){tracker.reset();queue.length=0;showing=null;panel.hidden=true}account=userId;queue.push(...tracker.update(state));next()},continue:continueNotice,get showing(){return showing},get pending(){return queue.length+(showing?1:0)}};
}
