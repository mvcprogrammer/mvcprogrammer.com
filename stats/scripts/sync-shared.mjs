// portfolio-stats — scripts/sync-shared.mjs
// Copies the files the dashboard shares with the static site at the repository root into public/,
// which Vite then copies to the output untouched: the stylesheet (tokens, fonts, themes), the icons,
// and the font files; plus this workspace's robots.txt, which disallows everything. Only those paths are replaced, so the day files `npm run data` writes under
// public/data/ survive a sync. public/ is generated and stays out of git.
import { basename, dirname, join } from 'node:path';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workspace = dirname(dirname(fileURLToPath(import.meta.url)));
const root = dirname(workspace);
const target = join(workspace, 'public');

/** [source relative to the repository root, destination relative to public/] */
const SHARED = [
  ['styles.css', 'styles.css'],
  ['favicon.svg', 'favicon.svg'],
  ['favicon.ico', 'favicon.ico'],
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['assets/fonts', 'assets/fonts'],
];

/** [source relative to this workspace, destination relative to public/] */
const OWN = [['robots.txt', 'robots.txt']];

/** Files that document the asset folders and never ship. */
const SKIP = new Set(['README.md', '.gitkeep']);

for (const [from, to] of SHARED) {
  const destination = join(target, to);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(root, from), destination, {
    recursive: true,
    filter: (source) => !SKIP.has(basename(source)),
  });
}
for (const [from, to] of OWN) {
  cpSync(join(workspace, from), join(target, to));
}
console.log(`Copied ${SHARED.length} shared paths from ${root} and ${OWN.length} of this workspace's into ${target}`);
