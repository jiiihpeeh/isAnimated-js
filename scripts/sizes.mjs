import { execSync } from 'child_process';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFileSync, unlinkSync } from 'node:fs';

const entries = [
  ['Full library (`is-animated`)', 'index.js'],
  ['`is-animated/gif`', 'detect/gif.js'],
  ['`is-animated/png`', 'detect/png.js'],
  ['`is-animated/webp`', 'detect/webp.js'],
  ['`is-animated/avif`', 'detect/avif.js'],
  ['`is-animated/jxl`', 'detect/jxl.js'],
];

function fmt(bytes) {
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

const rows = [];
for (const [label, entry] of entries) {
  const out = entry.replace(/[\/.]/g, '_') + '.js';
  execSync(`npx esbuild ${entry} --bundle --minify --format=esm --outfile=${out} 2>/dev/null`, { stdio: 'pipe' });
  const raw = readFileSync(out).length;
  const gzip = gzipSync(readFileSync(out)).length;
  const brotli = brotliCompressSync(readFileSync(out)).length;
  unlinkSync(out);
  rows.push({ label, raw: fmt(raw), gzip: fmt(gzip), brotli: fmt(brotli) });
}

const labelPad = Math.max('Entry point'.length, ...rows.map(r => r.label.length));
const rawPad = Math.max('Raw'.length, ...rows.map(r => r.raw.length));
const gzipPad = Math.max('Gzipped'.length, ...rows.map(r => r.gzip.length));
const brPad = Math.max('Brotli'.length, ...rows.map(r => r.brotli.length));

console.log('| ' + 'Entry point'.padEnd(labelPad) + ' | ' + 'Raw'.padStart(rawPad) + ' | ' + 'Gzipped'.padStart(gzipPad) + ' | ' + 'Brotli'.padStart(brPad) + ' |');
console.log('|-' + '-'.repeat(labelPad) + '-|-' + '-'.repeat(rawPad) + '-|-' + '-'.repeat(gzipPad) + '-|-' + '-'.repeat(brPad) + '-|');
for (const r of rows) {
  console.log('| ' + r.label.padEnd(labelPad) + ' | ' + r.raw.padStart(rawPad) + ' | ' + r.gzip.padStart(gzipPad) + ' | ' + r.brotli.padStart(brPad) + ' |');
}
