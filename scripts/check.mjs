import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
for(const name of await fs.readdir(new URL('public/js/',root))){
  if(!name.endsWith('.js'))continue;
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(`public/js/${name}`,root))],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
}
const manifest=JSON.parse(await fs.readFile(new URL('.openai/hosting.json',root),'utf8'));
if(manifest.project_id!=='appgprj_6ae2c732d5248191b59f80e856446929'||manifest.static||manifest.d1!=='DB')throw new Error('Invalid LifeHub Worker/D1 manifest');
const typecheck=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{cwd:fileURLToPath(root),encoding:'utf8'});
if(typecheck.status!==0)throw new Error(typecheck.stdout+typecheck.stderr);
console.log('PASS: client JavaScript syntax, TypeScript, same Sites identity and D1 Worker manifest.');
