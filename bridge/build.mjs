// Builds dist/broasted-printer.exe: one Windows file (Node single executable) with the renderer and fonts inside.
// Usage: node build.mjs [--linux]   (--linux builds a local copy for testing on this machine)
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';

const linux = process.argv.includes('--linux');
const NODE = process.version; // the blob must match the node binary it goes into
mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/main.mjs'], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: 'dist/bridge.cjs', logLevel: 'warning' });
writeFileSync('dist/sea-config.json', JSON.stringify({
  main: 'dist/bridge.cjs', output: 'dist/sea-prep.blob', disableExperimentalSEAWarning: true, useCodeCache: false,
  assets: { 'resvg.wasm': 'node_modules/@resvg/resvg-wasm/index_bg.wasm', 'readex.ttf': 'assets/readex-700.ttf', 'lalezar.ttf': 'assets/lalezar.ttf', 'logo.png': 'assets/logo.png',
    'inter-black.otf': 'assets/inter-display-black.otf', 'inter-medium.otf': 'assets/inter-display-medium.otf' },
}));
execFileSync(process.execPath, ['--experimental-sea-config', 'dist/sea-config.json'], { stdio: 'inherit' });

let base;
if (linux) base = process.execPath;
else {
  base = `dist/node-${NODE}-win-x64.exe`;
  if (!existsSync(base)) {
    const res = await fetch(`https://nodejs.org/dist/${NODE}/win-x64/node.exe`);
    if (!res.ok) throw new Error('download node.exe ' + res.status);
    writeFileSync(base, Buffer.from(await res.arrayBuffer()));
  }
}
const out = linux ? 'dist/broasted-printer' : 'dist/broasted-printer.exe';
copyFileSync(base, out);
if (linux) chmodSync(out, 0o755);
execFileSync('npx', ['postject', out, 'NODE_SEA_BLOB', 'dist/sea-prep.blob', '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--overwrite'], { stdio: 'inherit' });
console.log('built', out);
