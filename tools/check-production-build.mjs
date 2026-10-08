import {readFile} from 'node:fs/promises';
const html = await readFile(process.argv[2] ?? 'dist/index.html','utf8');
if (/name="digistaybook-environment"\s+content="test"/.test(html)) throw new Error('Refusing to deploy a local Test build. Run npm run build for Production.');
