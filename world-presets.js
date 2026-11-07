import {adventurePeople,campObjects} from './adventure-catalog.js?v=release-20261107-mixamo129';
import {entityDefaults} from './world-templates.js?v=release-20261107-mixamo129';
export const worldPresets={
 castle_keep:{label:'Castle keep · three stories, hall and bedrooms',template:'cottage',name:'Castle keep',room:'hall',upperRoom:'home',stories:3,stone:true,scale:3.5,roof:0x485d68},
 timber_home:{label:'Timber cottage · furnished home',template:'cottage',name:'Timber cottage',room:'home',stone:false,scale:1.2,roof:0x70503c},
 stone_home:{label:'Stone townhouse · furnished home',template:'cottage',name:'Stone townhouse',room:'home',stone:true,stories:2,upperRoom:'home',scale:1.8,roof:0x515c69},
 timber_inn:{label:'Timber inn · tables and bar',template:'inn',name:'Traveler’s Rest',stone:false,stories:2,upperRoom:'home',scale:2.1,roof:0x814f34},
 stone_bank:{label:'Stone bank · counters and vault',template:'bank',name:'Royal bank',stone:true,scale:2.3,roof:0x485d68},
 stone_smithy:{label:'Stone smithy · forge interior',template:'forge',name:'Ironworker’s smithy',stone:true,scale:2,roof:0x564e48},
 great_hall:{label:'Grand stone hall · furnished',template:'cottage',name:'Great Hall',room:'hall',stone:true,scale:3.3,roof:0x485d68},
 chapel:{label:'Stone chapel · prayer interior',template:'cottage',name:'Chapel of the Dawn',room:'chapel',stone:true,scale:2.2,roof:0x4c6067},
 armory:{label:'Stone armory · equipment displays',template:'cottage',name:'Royal Armory',room:'armory',stone:true,scale:2,roof:0x79503b},
 resident:{label:'NPC · dialogue resident',template:'villager',name:'New resident',role:'resident',roam:0,dialogue:'Welcome, traveler.\nWhat brings you here?'},
 merchant:{label:'NPC · merchant with starter stock',template:'merchant',name:'New merchant',role:'merchant',roam:0,shop:{wood:{buy:6,sell:3,stock:100},bait:{buy:2,sell:1,stock:-1}}},
 banker:{label:'NPC · banker',template:'banker',name:'New banker',role:'banker',roam:0},
 guard:{label:'NPC · stationary guard',template:'guard',name:'Town guard',role:'guard',roam:0}
};
for(const [id,d]of Object.entries(adventurePeople))worldPresets['persona_'+id]={label:'NPC · '+d.name,template:id,name:d.name};
for(const [id,name]of Object.entries(campObjects))worldPresets['prop_'+id]={label:'Camp prop · '+name,template:id,name};
export function presetEntity(key,x,z){const preset=worldPresets[key];if(!preset)throw Error('Unknown preset');const {label,...data}=preset;return structuredClone({...entityDefaults(data.template,x,z),...data,furnished:true});}
