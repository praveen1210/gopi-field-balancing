// Serves website/ locally: http://localhost:8120
// The form saves requests to the Supabase project in .env (EXPO_PUBLIC_SUPABASE_URL /
// EXPO_PUBLIC_SUPABASE_ANON_KEY), so the same backend the app uses gets them.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'website');
const port = Number(process.env.PORT || process.env.WEBSITE_PORT || 8120);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readEnv() {
  const file = join(import.meta.dirname, '..', '.env');
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, key, val]) => [key, val.replace(/^["']|["']$/g, '')]),
  );
}

const env = readEnv();
const backendOverride = env.EXPO_PUBLIC_SUPABASE_URL
  ? `\nwindow.BACKEND = ${JSON.stringify({
      supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    })};\n`
  : '';

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  const file = join(root, path || 'index.html');
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    let body = await readFile(file);
    if (path === 'config.js') body = Buffer.concat([body, Buffer.from(backendOverride)]);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  console.log(`Website: http://localhost:${port}  (backend: ${env.EXPO_PUBLIC_SUPABASE_URL || 'none, WhatsApp only'})`);
});
