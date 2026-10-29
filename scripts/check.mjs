import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const files = ['dist/js/app.js','dist/js/model.js','dist/js/components.js','dist/js/icons.js','scripts/serve.mjs','scripts/check.mjs'];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(file, root))], {encoding:'utf8'});
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${file}`);
}
const html = await fs.readFile(new URL('dist/index.html',root),'utf8');
for (const [, asset] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) await fs.access(new URL(`dist/${asset}`,root));
const manifest = JSON.parse(await fs.readFile(new URL('.openai/hosting.json',root),'utf8'));
if (!manifest.project_id || manifest.static?.directory !== 'dist') throw new Error('Invalid Sites manifest');
console.log('PASS: JavaScript syntax, HTML asset references, Sites static manifest.');
