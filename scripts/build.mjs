import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';
import { parse, serialize } from 'parse5';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
// Only the generated directory inside this project may be replaced.
if (path.dirname(dist) !== path.resolve(root) || path.basename(dist) !== 'dist') throw new Error('Invalid build directory');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });
await mkdir(path.join(dist, 'vendor'), { recursive: true });
await mkdir(path.join(dist, 'posts'), { recursive: true });
await mkdir(path.join(dist, 'data'), { recursive: true });

await build({ stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: root }, bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2020', outfile: path.join(dist, 'vendor/supabase.js') });
await copyFile(path.join(root, 'node_modules/html2canvas/dist/html2canvas.min.js'), path.join(dist, 'vendor/html2canvas.js'));
await copyFile(path.join(root, 'data/employees_raw_data.csv'), path.join(dist, 'data/employees_raw_data.csv'));

const files = (await readdir(root)).filter(name => /\.(html|js|css|svg|png)$/.test(name));
files.push('manifest.json', ...(await readdir(path.join(root, 'posts'))).filter(name => name.endsWith('.html')).map(name => `posts/${name}`));
const versions = new Map();
let sourceBytes = 0;
let outputBytes = 0;
for (const file of files.filter(name => !name.endsWith('.html') && name !== 'sw.js')) {
  const source = await readFile(path.join(root, file));
  let output = source;
  if (/\.(js|css)$/.test(file)) {
    output = Buffer.from((await transform(source.toString(), { loader: file.endsWith('.css') ? 'css' : 'js', minify: true, target: 'es2020', legalComments: 'none' })).code);
  }
  await writeFile(path.join(dist, file), output);
  versions.set(file, hash(output));
  sourceBytes += source.length;
  outputBytes += output.length;
}
const stamp = 'ASG Tech Stamp without background.png';
await sharp(path.join(root, stamp)).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(dist, 'assets/stamp.webp'));

function visit(node, fn) {
  fn(node);
  for (const child of node.childNodes || []) visit(child, fn);
}
const attr = (node, name) => node.attrs?.find(item => item.name === name);
const setAttr = (node, name, value) => {
  const existing = attr(node, name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
};

for (const file of files.filter(name => name.endsWith('.html'))) {
  const source = await readFile(path.join(root, file), 'utf8');
  const document = parse(source);
  const prefix = file.startsWith('posts/') ? '../' : '';
  const scripts = [];
  visit(document, node => { if (node.tagName === 'script' && (!attr(node, 'type') || /javascript/.test(attr(node, 'type').value))) scripts.push(node); });
  let index = 0;
  for (const script of scripts) {
    let src = attr(script, 'src');
    if (!src) {
      const code = script.childNodes.map(node => node.value || '').join('')
        .replaceAll('ASG%20Tech%20Stamp%20without%20background.png', `${prefix}assets/stamp.webp`);
      if (!code.trim()) continue;
      const output = (await transform(code, { loader: 'js', minify: true, target: 'es2020', legalComments: 'none' })).code;
      const name = `assets/${path.basename(file, '.html')}-${index++}.${hash(output)}.js`;
      await writeFile(path.join(dist, name), output);
      script.childNodes = [];
      setAttr(script, 'src', `${prefix}${name}`);
    } else if (src.value.includes('cdnjs.cloudflare.com/ajax/libs/html2canvas/')) {
      src.value = `${prefix}vendor/html2canvas.js`;
    }
    // Defer every classic script, including extracted inline scripts, in document order.
    setAttr(script, 'defer', '');
  }
  visit(document, node => {
    for (const name of ['src', 'href']) {
      const item = attr(node, name);
      if (!item || /^(https?:|data:|#|mailto:)/i.test(item.value)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(item.value.split('?')[0])));
      if (resolved === stamp) item.value = `${prefix}assets/stamp.webp`;
      else if (/\.(css|js)$/.test(resolved) && versions.has(resolved)) item.value += `?v=${versions.get(resolved)}`;
    }
    if (node.tagName === 'img') setAttr(node, 'decoding', 'async');
    if (node.tagName === 'iframe') setAttr(node, 'loading', 'lazy');
  });
  await writeFile(path.join(dist, file), serialize(document));
}
// Update the worker's cache whenever any deployed page or asset changes.
const release = createHash('sha256');
async function addReleaseFiles(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) await addReleaseFiles(name);
    else release.update(await readFile(name));
  }
}
await addReleaseFiles(dist);
await writeFile(path.join(dist, 'sw.js'), (await readFile(path.join(root, 'sw.js'), 'utf8')).replace('__BUILD_VERSION__', release.digest('hex').slice(0, 12)));
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built ${files.filter(name => name.endsWith('.html')).length} pages. Shared source assets: ${sourceBytes} -> ${outputBytes} bytes.`);
await import('./check.mjs');
