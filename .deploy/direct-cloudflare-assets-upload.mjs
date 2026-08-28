import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const workerName = process.env.CLOUDFLARE_WORKER_NAME || 'fishwizz2-0';
const assetsDirectory = path.resolve(process.env.ASSETS_DIRECTORY || 'dist');
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

if (!accountId || !apiToken) throw new Error('Missing Cloudflare credentials');

const files = [];
function walk(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const nextRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(absolute, nextRelative);
    else if (entry.isFile()) files.push({ absolute, relative: nextRelative });
  }
}
walk(assetsDirectory);

const manifest = {};
const byHash = new Map();
for (const file of files) {
  const bytes = fs.readFileSync(file.absolute);
  const extension = path.extname(file.relative).slice(1);
  const hash = crypto.createHash('sha256')
    .update(bytes.toString('base64') + extension)
    .digest('hex').slice(0, 32);
  const assetPath = `/${file.relative.replaceAll('\\', '/')}`;
  manifest[assetPath] = { hash, size: bytes.length };
  if (!byHash.has(hash)) byHash.set(hash, { ...file, bytes });
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(`${response.status} ${JSON.stringify(body.errors || body)}`);
  }
  return body.result;
}

console.log(`Registering ${files.length} assets for ${workerName}`);
const session = await jsonRequest(`${apiBase}/workers/scripts/${workerName}/assets-upload-session`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({ manifest }),
});

let completionJwt = session.jwt;
const mime = {
  '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon',
  '.js': 'application/javascript', '.json': 'application/json',
  '.map': 'application/json', '.mjs': 'application/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
};

for (let index = 0; index < session.buckets.length; index += 1) {
  const form = new FormData();
  for (const hash of session.buckets[index]) {
    const file = byHash.get(hash);
    if (!file) throw new Error(`Missing asset for hash ${hash}`);
    const encoded = Buffer.from(file.bytes).toString('base64');
    const contentType = mime[path.extname(file.relative).toLowerCase()] || 'application/octet-stream';
    form.append(hash, new Blob([encoded], { type: contentType }), hash);
  }
  const uploaded = await jsonRequest(`${apiBase}/workers/assets/upload?base64=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.jwt}` }, body: form,
  });
  if (uploaded.jwt) completionJwt = uploaded.jwt;
  console.log(`Uploaded asset bucket ${index + 1}/${session.buckets.length}`);
}

// P1 (release-blocking stabilization, 2026-08-28): this used to be a
// hardcoded literal duplicating fishwizz-static-worker.mjs's own content --
// a second, uncoordinated copy of the exact same file that could silently
// drift from it. Read the one real file instead, so there is exactly one
// place this worker's source is ever written. See that file's own header
// for why its Cache-Control logic exists at all (the actual fix for
// "different tabs load different FishWizz versions").
const workerSource = fs.readFileSync(path.join(__dirname, 'fishwizz-static-worker.mjs'), 'utf8');
const metadata = {
  main_module: 'fishwizz-static-worker.mjs',
  compatibility_date: '2026-08-20',
  assets: {
    jwt: completionJwt,
    config: { html_handling: 'auto-trailing-slash', not_found_handling: 'single-page-application' },
  },
  bindings: [{ type: 'assets', name: 'ASSETS' }],
};
const deployForm = new FormData();
deployForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
deployForm.append('fishwizz-static-worker.mjs', new Blob([workerSource], { type: 'application/javascript+module' }), 'fishwizz-static-worker.mjs');

const deployed = await jsonRequest(`${apiBase}/workers/scripts/${workerName}`, {
  method: 'PUT', headers: { Authorization: `Bearer ${apiToken}` }, body: deployForm,
});
console.log(`Deployment successful: ${deployed.id || workerName}`);
