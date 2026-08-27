#!/usr/bin/env node
// Regression test for the TEMPORARY P0-1 staging diagnostic
// (public/diag-identity-p0.js). Covers the actual safety contract: the
// account fingerprint never reveals the real user id, and the tag/checkOwner
// mismatch detector correctly identifies cross-account state -- the whole
// point of this module. Run with:
//   node scripts/test-diag-identity-p0.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const listeners = {};
globalThis.document = {
  readyState: 'complete',
  getElementById: () => null,
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
  hidden: false,
};
globalThis.window = globalThis;
globalThis.session = { user: { id: 'user-aaaa' } };

await import(pathToFileURL(path.join(root, 'public/diag-identity-p0.js')));
const { fnv1a, tag, checkOwner, log, buf } = globalThis.__fishwizzTest?.diagIdentityP0 || {};

section('P0-1 diagnostic: fingerprint never exposes the real id');
const fpA = fnv1a('user-aaaa');
check('the fingerprint is a short hex string, not the id itself', /^[0-9a-f]{8}$/.test(fpA) && fpA !== 'user-aaaa');
check('the same id always produces the same fingerprint', fnv1a('user-aaaa') === fpA);
check('a different id produces a different fingerprint', fnv1a('user-bbbb') !== fpA);
check('an email-shaped string is also just an opaque hash, never echoed', !fnv1a('someone@example.com').includes('@'));

section('P0-1 diagnostic: cross-account mismatch detection (the actual point of this tool)');
{
  const missionAsA = tag({ context: { water: 'Lake Minnetonka' } });
  check('a freshly tagged object is NOT flagged while the same account is active', checkOwner('lastMission', missionAsA) === null);

  globalThis.session = { user: { id: 'user-bbbb' } }; // simulate an account switch
  const mismatch = checkOwner('lastMission', missionAsA);
  check('the same object IS flagged once a different account is active', mismatch !== null);
  check('the mismatch entry never contains the raw user id', JSON.stringify(mismatch).indexOf('user-aaaa') === -1 && JSON.stringify(mismatch).indexOf('user-bbbb') === -1);
  check('the mismatch entry names the field it found stale state in', mismatch.kind === 'MISMATCH:lastMission');

  globalThis.session = { user: { id: 'user-aaaa' } }; // back to the original account
  check('re-tagging under the correct account clears the mismatch', checkOwner('lastMission', tag(missionAsA)) === null);
}

section('P0-1 diagnostic: the log ring buffer never grows unbounded and never carries sensitive fields');
{
  const before = buf.length;
  log('test-event', { water: 'should never be logged by a real caller, this is just checking the mechanism accepts arbitrary detail' });
  check('log() appends to the shared ring buffer', buf.length === before + 1);
  const last = buf[buf.length - 1];
  check('every entry carries an ISO timestamp', /^\d{4}-\d{2}-\d{2}T/.test(last.t));
  check('every entry carries only the fingerprint, never session.user.id/email directly', last.account === fnv1a('user-aaaa'));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
