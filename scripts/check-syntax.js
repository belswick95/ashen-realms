import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const path of readdirSync('.').filter(path=>path.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
