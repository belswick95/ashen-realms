import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('every browser module import uses the entry release version to prevent mixed cached rigs',()=>{
 const root=new URL('../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8'),version=html.match(/src="\/auth\.js\?v=([^"&]+)/)[1];let imports=0;
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(new URL(file,root),'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]((?:\.\/|\/)[A-Za-z0-9_-]+\.js(?:\?[^'"]*)?)['"]/g)){const url=new URL(match[1],'https://eldervale.test/');assert.equal(url.searchParams.get('v'),version,file+' imports '+match[1]);assert.ok(fs.existsSync(new URL(url.pathname.slice(1),root)));imports++}}
 assert.ok(imports>15);assert.ok(html.includes('responsive.css?v='+version));
});
