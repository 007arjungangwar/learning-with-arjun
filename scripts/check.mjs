import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const errors = [];
let pages = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await check(file); continue; }
    if (entry.name.endsWith('.js') && !file.includes(`${path.sep}vendor${path.sep}`)) {
      try { new Script(await readFile(file, 'utf8'), { filename: file }); } catch (error) { errors.push(error.message); }
    }
    if (!entry.name.endsWith('.html')) continue;
    pages++;
    const nodes = [parse(await readFile(file, 'utf8'))];
    while (nodes.length) {
      const node = nodes.pop();
      nodes.push(...(node.childNodes || []));
      for (const item of node.attrs || []) {
        if (!['href', 'src'].includes(item.name) || !item.value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(item.value)) continue;
        const url = new URL(item.value, `https://test.local/${path.relative(root, file).replaceAll(path.sep, '/')}`);
        const target = path.join(root, decodeURIComponent(url.pathname));
        try { await access(target); } catch { errors.push(`${path.relative(root, file)}: missing ${item.value}`); }
      }
    }
  }
}
await check(root);
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Checked JavaScript syntax and local links/assets across ${pages} pages.`);
