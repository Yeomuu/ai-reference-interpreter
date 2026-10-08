// Read only: connect to the user-supplied desktop MCP and persist design evidence.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const url = 'http://127.0.0.1:3845/mcp';
const out = 'qa-screens/alignment-20261008/figma';
await mkdir(out, { recursive: true });
let session, nextId = 1;
async function call(method, params) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }) });
  session ||= response.headers.get('mcp-session-id');
  const raw = await response.text();
  const payload = raw.startsWith('event:') || raw.startsWith('data:') ? JSON.parse(raw.split('\n').find(line => line.startsWith('data:')).slice(5)) : JSON.parse(raw);
  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload.result;
}
await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ReSpace-alignment-audit', version: '1.0' } });
const list = await call('tools/list', {});
await writeFile(`${out}/tools.json`, JSON.stringify(list, null, 2));
console.log('Connected tools:', list.tools.map(t => t.name).join(', '));
for (const [name, nodeId] of [['home', '175:272'], ['step1', '173:118'], ['progress', '164:653'], ['progress-variants', '164:702']]) {
  const result = await call('tools/call', { name: 'get_design_context', arguments: { nodeId, clientFrameworks: 'react', clientLanguages: 'typescript,css' } });
  await writeFile(`${out}/${name}-context.txt`, result.content.filter(c => c.type === 'text').map(c => c.text).join('\n'));
  const shot = await call('tools/call', { name: 'get_screenshot', arguments: { nodeId, clientFrameworks: 'react', clientLanguages: 'typescript,css' } });
  for (const c of shot.content) if (c.type === 'image') await writeFile(`${out}/${name}.png`, Buffer.from(c.data, 'base64'));
  console.log(`${name}: saved context and screenshot`);
}
for (const [name, nodeId] of [['progress', '164:653'], ['progress-variants', '164:702'], ['home', '175:272'], ['step1', '173:118']]) {
  const result = await call('tools/call', { name: 'get_metadata', arguments: { nodeId } });
  await writeFile(`${out}/${name}-metadata.txt`, result.content.filter(c => c.type === 'text').map(c => c.text).join('\n'));
}
const context = await readFile(`${out}/home-context.txt`, 'utf8');
const source = context.match(/const imgReferencePreview = "([^"]+)"/)[1];
const sourceBytes = Buffer.from(await (await fetch(source)).arrayBuffer());
const localBytes = await readFile('public/brand/home-spatial-collage.png');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const match = { sourceNode: '175:294', localPath: 'public/brand/home-spatial-collage.png', sourceSha256: sha(sourceBytes), localSha256: sha(localBytes), identical: sha(sourceBytes) === sha(localBytes) };
await writeFile(`${out}/asset-comparison.json`, JSON.stringify(match, null, 2));
console.log(match);
