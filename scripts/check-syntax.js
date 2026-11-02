import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=[...readdirSync('.').filter(path=>path.endsWith('.js')),...readdirSync('scripts').filter(path=>/\.c?js$/.test(path)).map(path=>'scripts/'+path)];
for(const path of files){
 const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
