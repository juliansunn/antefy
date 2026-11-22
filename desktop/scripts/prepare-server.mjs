// Builds the Next.js app as a standalone server and copies it to desktop/server,
// which electron-builder ships inside the app bundle (Contents/Resources/server).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = join(desktop, '..', 'frontend');
const standalone = join(frontend, '.next', 'standalone');
const out = join(desktop, 'server');

execSync('npm run build', { cwd: frontend, stdio: 'inherit', env: { ...process.env, NEXT_OUTPUT: 'standalone' } });
if (!existsSync(join(standalone, 'server.js'))) throw new Error('No standalone server.js; did the build use output: standalone?');

rmSync(out, { recursive: true, force: true });
cpSync(standalone, out, { recursive: true });
// The standalone server doesn't include static assets; it serves them once copied in.
cpSync(join(frontend, '.next', 'static'), join(out, '.next', 'static'), { recursive: true });
cpSync(join(frontend, 'public'), join(out, 'public'), { recursive: true });
// Never ship local secrets: the app reads its config from the user's Application Support folder.
for (const f of readdirSync(out)) if (f.startsWith('.env')) rmSync(join(out, f));
console.log('Server ready at', out);
