import {readFile} from 'node:fs/promises';
const files = process.argv[2] ? [process.argv[2]] : ['dist/index.html', 'dist/app.html'];
for (const file of files) {
  const html = await readFile(file,'utf8');
  if (/name="digistaybook-environment"\s+content="test"/.test(html)) throw new Error('Refusing to deploy a local Test build. Run npm run build for Production.');
}
