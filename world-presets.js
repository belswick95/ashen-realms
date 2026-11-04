import {entityDefaults} from './world-templates.js?v=release-20261104-jog41';
export const worldPresets={
 timber_home:{label:'Timber cottage · furnished home',template:'cottage',name:'Timber cottage',room:'home',stone:false,scale:1.2,roof:0x70503c},
 stone_home:{label:'Stone townhouse · furnished home',template:'cottage',name:'Stone townhouse',room:'home',stone:true,scale:1.8,roof:0x515c69},
 timber_inn:{label:'Timber inn · tables and bar',template:'inn',name:'Traveler’s Rest',stone:false,scale:2.1,roof:0x814f34},
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
export function presetEntity(key,x,z){const preset=worldPresets[key];if(!preset)throw Error('Unknown preset');const {label,...data}=preset;return {...entityDefaults(data.template,x,z),...structuredClone(data),furnished:true};}
