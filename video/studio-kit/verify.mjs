// Checks every tool in the studio kit loads and works. Writes nothing outside a temp dir.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ok = [], bad = [];
const check = async (name, fn) => { try { const v = await fn(); ok.push(`${name}${v ? ' ' + v : ''}`); } catch (e) { bad.push(`${name}: ${String(e.message || e).split('\n')[0]}`); } };
const sh = c => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const tmp = mkdtempSync(join(tmpdir(), 'kit-'));
const PY = process.env.STUDIO_PY || '/root/.studio/bin/python';

const pkgs = ['remotion', '@remotion/cli', '@remotion/renderer', '@remotion/lottie', '@remotion/motion-blur', '@remotion/transitions', '@remotion/noise',
  '@remotion/three', '@remotion/shapes', '@remotion/paths', '@remotion/captions', 'three', '@react-three/fiber', '@react-three/drei', 'gsap', 'motion', 'lottie-web', 'lucide-react', 'svgo', 'opentype.js'];
for (const p of pkgs) await check(p, async () => { await import(p); return JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version; });

await check('sharp (render+resize)', async () => {
  const sharp = (await import('sharp')).default;
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#c00"/></svg>');
  const out = await sharp(svg).resize(100).webp().toBuffer(); return `${sharp.versions.vips} (${out.length}B)`;
});
await check('@napi-rs/canvas', async () => { const { createCanvas } = await import('@napi-rs/canvas'); const c = createCanvas(64, 64); c.getContext('2d').fillRect(0, 0, 9, 9); return `${c.toBuffer('image/png').length}B png`; });
await check('svgo optimize', async () => { const { optimize } = await import('svgo'); return `${optimize('<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="1" height="1"/></g></svg>').data.length}B`; });

await check('ffmpeg encode H.264+AAC', () => { const f = join(tmp, 'a.mp4'); sh(`ffmpeg -v error -f lavfi -i testsrc2=s=320x568:d=1 -f lavfi -i sine=d=1 -c:v libx264 -c:a aac -shortest -y ${f}`); return sh(`ffprobe -v error -show_entries stream=codec_name -of csv=p=0 ${f}`).replace(/\n/g, '+'); });
await check('ffmpeg filters', () => { const need = ['loudnorm', 'afftdn', 'arnndn', 'sidechaincompress', 'vidstabdetect', 'vidstabtransform', 'minterpolate', 'lut3d', 'zscale', 'rubberband']; const have = sh('ffmpeg -hide_banner -filters'); const miss = need.filter(n => !have.includes(' ' + n + ' ')); if (miss.length) throw new Error('missing ' + miss); return need.length + ' ok'; });
await check('imagemagick', () => sh('convert -version').split('\n')[0].split(' ')[2]);
for (const [n, c] of [['sox', 'sox --version'], ['mediainfo', 'mediainfo --version'], ['potrace', 'potrace --version'], ['cwebp', 'cwebp -version'], ['gifsicle', 'gifsicle --version'], ['rsvg-convert', 'rsvg-convert --version']])
  await check(n, () => sh(c).split('\n').pop().slice(0, 40));
await check('python studio libs', () => sh(`${PY} -W ignore -c "import moviepy,cv2,numpy,scipy,pydub,pyloudnorm,noisereduce,librosa,soundfile,pedalboard,PIL,rembg,faster_whisper,piper,scenedetect;print('15 ok')"`));
const BROWSER = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
await check('headless chrome for Remotion', () => sh(`${BROWSER} --version`));
rmSync(tmp, { recursive: true, force: true });
console.log('OK (' + ok.length + ')\n  ' + ok.join('\n  '));
if (bad.length) { console.log('FAILED (' + bad.length + ')\n  ' + bad.join('\n  ')); process.exit(1); }
