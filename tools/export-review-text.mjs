import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = process.cwd();
const versionsSource = fs.readFileSync('functions/src/legal.ts', 'utf8');
const versions = versionsSource.match(/export const legalVersions = (\{[\s\S]*?\}) as const;/)[1];
const consent = JSON.parse(versionsSource.match(/export const consentWording = ("[^\n]*");/)[1]);
let source = fs.readFileSync('src/ui/pages/legal/documents.ts', 'utf8');
source = source.replace(/^import .*;\r?\n/gm, '').replace(/^export type .*;\r?\n/gm, '')
  .replace(/export const (\w+): LegalDocument/g, 'const $1');
const result = vm.runInNewContext(`const legalVersions = ${versions};\n${source}\nJSON.stringify({hostTerms, guestTerms, privacyPolicy})`);
const output = JSON.parse(result);
output.consent = consent;
output.versions = vm.runInNewContext(`(${versions})`);
fs.mkdirSync(path.join(root, 'docs/legal-review/reviewer-pack-2026-10-02'), { recursive: true });
fs.writeFileSync('docs/legal-review/reviewer-pack-2026-10-02/legal-text.json', JSON.stringify(output, null, 2));
console.log('Exported all three complete legal documents and exact consent wording.');
