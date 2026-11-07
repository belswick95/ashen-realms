// Rewrites the generated recipe block in db/osrs-skill-parity.sql from profession-data.js
// (which includes food.js cooking recipes). Usage: node scripts/build-osrs-skill-parity.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {professionRecipes} from '../profession-data.js';
// Fish tiers added later (fish-tiers.js) ship their recipes in db/water-1-fishing.sql.
import {extraFishRecipes} from '../fish-tiers.js';

// Fields that carry OSRS levels, XP and success models. Outputs/crops only where the OSRS
// mapping changes the yield (rune multiples, chest coins, harvest XP).
const FIELDS=['level','xp','burnChance','stopBurn','chance','chanceLow','chanceHigh','failText'];
const WITH_OUTPUTS=new Set(['air_runes','fire_runes','pick_training_lock']);
// Recipes added later with their own seed file (not part of this patch set).
const OWN_SEED=new Set(['make_torch']);// db/torch.sql
export function recipePatches(){
 const out={};
 for(const [id,r]of Object.entries(professionRecipes)){if(extraFishRecipes[id]||OWN_SEED.has(id))continue;
  const p={};for(const k of FIELDS)if(r[k]!==undefined)p[k]=r[k];
  if(WITH_OUTPUTS.has(id))p.outputs=r.outputs;
  if(r.kind==='plant')p.crop=r.crop;
  out[id]=p;
 }
 return out;
}
export function recipeBlock(){
 const json=JSON.stringify(recipePatches());if(json.includes('$j$'))throw Error('Unexpected dollar quote');
 return `update eldervale_private.skill_recipes r set data=r.data||v.patch
 from jsonb_each($j$${json}$j$::jsonb) v(id,patch) where r.id=v.id and r.data||v.patch is distinct from r.data;`;
}
const START='-- BEGIN GENERATED RECIPES\n',END='-- END GENERATED RECIPES';
export function build(sql){const a=sql.indexOf(START),b=sql.indexOf(END);if(a<0||b<a)throw Error('Generated recipe markers missing');return sql.slice(0,a+START.length)+recipeBlock()+'\n'+sql.slice(b)}
if(import.meta.url===`file://${process.argv[1]}`){
 const file=new URL('../db/osrs-skill-parity.sql',import.meta.url);
 writeFileSync(file,build(readFileSync(file,'utf8')));
 console.log('db/osrs-skill-parity.sql recipe block rebuilt');
}
