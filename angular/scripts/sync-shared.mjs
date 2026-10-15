// portfolio-angular — scripts/sync-shared.mjs
// Copies the files this edition shares with the static site at the repository root into public/,
// which the Angular build then copies to the output untouched. The Blazor edition links the same
// files through its project file; Angular refuses asset paths outside the workspace, so a copy
// before every build and serve plays that role here. public/ is generated and stays out of git.
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
  ['assets', 'assets'],
  ['api/seed/positions.json', 'data/positions.json'],
];

/** Files that document the asset folders and never ship. */
const SKIP = new Set(['README.md', '.gitkeep']);

rmSync(target, { recursive: true, force: true });
for (const [from, to] of SHARED) {
  const destination = join(target, to);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(root, from), destination, { recursive: true, filter: (source) => !SKIP.has(basename(source)) });
}
console.log(`Copied ${SHARED.length} shared paths from ${root} into ${target}`);
