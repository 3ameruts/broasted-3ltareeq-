// potrace SVG -> {viewBox, transform, paths[]} so the logo's line art can be drawn on with @remotion/paths
import { readFileSync, writeFileSync } from 'node:fs';
const [, , src, out] = process.argv;
const s = readFileSync(src, 'utf8');
const viewBox = s.match(/viewBox="([^"]+)"/)[1];
const transform = s.match(/<g transform="([^"]+)"/)[1];
const paths = [...s.matchAll(/<path d="([^"]+)"/g)].map(m => m[1].replace(/\s+/g, ' ').trim());
writeFileSync(out, JSON.stringify({ viewBox, transform, paths }));
console.log(out, paths.length, 'paths');
