// Packs website/ into website-release/ (and gtg-vibral-website.zip on Windows)
// ready to drag onto Netlify: https://app.netlify.com/drop
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'website');
const out = join(root, 'website-release');
const zip = join(root, 'gtg-vibral-website.zip');

const config = readFileSync(join(src, 'config.js'), 'utf8');
if (!/supabaseUrl:\s*"https:\/\//.test(config)) {
  console.warn('Warning: website/config.js has no Supabase URL; the form will only offer WhatsApp.');
}

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
console.log(`Website packed: ${out}`);

if (process.platform === 'win32') {
  rmSync(zip, { force: true });
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${out}\*' -DestinationPath '${zip}'`], { stdio: 'inherit' });
  if (existsSync(zip)) console.log(`Zip: ${zip}`);
}
