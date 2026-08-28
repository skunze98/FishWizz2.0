// Real AJV (Draft 2020-12) compilation check for all 8 schema files -- catches
// $ref resolution errors, invalid keyword usage, and schema-shape mistakes
// that a hand-rolled checker cannot.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';

const dir = new URL('./schemas/', import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.schema.json'));

const ajv = new Ajv2020({ allErrors: true, strict: false, $data: true });
addFormats(ajv);

let failures = 0;
for (const f of files) {
  const schema = JSON.parse(fs.readFileSync(new URL(f, dir)));
  ajv.addSchema(schema, schema.$id);
}
console.log(`Loaded ${files.length} schema files into AJV (Draft 2020-12, formats + $data enabled):`);
files.forEach(f => console.log(`  - ${f}`));

console.log('\nCompiling every schema (resolves all $ref, validates keyword usage)...');
for (const f of files) {
  const schema = JSON.parse(fs.readFileSync(new URL(f, dir)));
  try {
    const validateFn = ajv.getSchema(schema.$id) || ajv.compile(schema);
    console.log(`  ok   ${f} compiles cleanly`);
  } catch (e) {
    console.log(`  FAIL ${f}: ${e.message}`);
    failures++;
  }
}
console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} schema compilation failure(s).`);
if (failures) process.exit(1);

export { ajv };
