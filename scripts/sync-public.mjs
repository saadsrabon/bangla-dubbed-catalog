import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const candidates = [join(root, 'data', 'catalog.json'), join(root, 'data', 'page-4.json')];
const dest = join(root, 'public', 'catalog.json');

let src = candidates[0];
for (const c of candidates) {
  try {
    await access(c, constants.R_OK);
    src = c;
    break;
  } catch {
    /* try next */
  }
}

await copyFile(src, dest);
console.log(`Copied ${src} → public/catalog.json`);
