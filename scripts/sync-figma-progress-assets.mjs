// Read-only Figma MCP evidence: copy returned SVG bytes without editing the file.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const context = await readFile('qa-screens/alignment-20261008/figma/progress-variants-context.txt', 'utf8');
const urls = Object.fromEntries([...context.matchAll(/const (\w+) = "(http:\/\/localhost:3845\/assets\/[^"]+)";/g)].map(m => [m[1], m[2]]));
const assets = [
  ['space-current', 'imgGroup', '275:2141'], ['space-before', 'imgGroup3', '275:2047'],
  ['layout-upcoming', 'imgGroup1', '275:1979'], ['layout-current', 'imgGroup4', '275:2036'], ['layout-before', 'imgGroup5', '275:1968'],
  ['reference-upcoming', 'imgGroup2', '275:2199'], ['reference-current', 'imgGroup6', '275:2281'], ['reference-before', 'imgGroup7', '275:2298'],
  ['image-upcoming', 'imgFrame', 'I222:1283;213:362'], ['image-current', 'imgFrame1', 'I222:1343;213:362'],
];
await mkdir('public/figma/progress', { recursive: true });
const manifest = [];
for (const [name, variable, node] of assets) {
  const response = await fetch(urls[variable]);
  if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.toString('utf8').includes('<svg')) throw new Error('Expected SVG');
  const path = `public/figma/progress/${name}.svg`;
  await writeFile(path, bytes);
  manifest.push({ path, sourceNodeId: node, sourceUrl: urls[variable], sha256: createHash('sha256').update(bytes).digest('hex'), operation: 'Read-only get_design_context asset GET; unchanged SVG bytes' });
}
await writeFile('docs/FIGMA_PROGRESS_ASSETS_20261008.json', JSON.stringify({ fileKey: 'J2ZHftzWmLR7OQhpyMFJQA', componentNode: '164:702', assets: manifest }, null, 2) + '\n');
console.log(`Copied ${manifest.length} original progress SVGs. No Figma writes.`);
