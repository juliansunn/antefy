// Antefy for macOS. Runs the bundled Next.js standalone server on a fixed
// loopback port (Spotify only accepts 127.0.0.1 redirect URIs) and shows it
// in a window. Config (Spotify client id/secret) lives in
// ~/Library/Application Support/Antefy/antefy.env.
const { app, BrowserWindow, dialog, shell, utilityProcess } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.ANTEFY_PORT) || 43117;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// Set ANTEFY_URL (e.g. http://127.0.0.1:3000) to point the shell at `npm run dev` instead.
const DEV_URL = process.env.ANTEFY_URL;

const CONFIG_TEMPLATE = `# Antefy desktop config. Fill in from https://developer.spotify.com/dashboard
# and add this redirect URI to your Spotify app:
#   ${ORIGIN}/api/auth/callback/spotify
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
`;

let server = null;
let win = null;

function parseEnv(text) {
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!m) continue;
		env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return env;
}

function loadConfig() {
	const dir = app.getPath('userData');
	const configFile = path.join(dir, 'antefy.env');
	const env = {};
	// When run from the repo, reuse the web app's local config.
	const sources = app.isPackaged ? [configFile] : [path.join(__dirname, '../frontend/.env.local'), configFile];
	for (const f of sources) if (fs.existsSync(f)) Object.assign(env, parseEnv(fs.readFileSync(f, 'utf8')));

	if (!env.NEXTAUTH_SECRET) {
		const secretFile = path.join(dir, 'nextauth-secret');
		if (!fs.existsSync(secretFile)) {
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
		}
		env.NEXTAUTH_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
	}
	return { env, configFile };
}

async function promptForConfig(configFile) {
	if (!fs.existsSync(configFile)) {
		fs.mkdirSync(path.dirname(configFile), { recursive: true });
		fs.writeFileSync(configFile, CONFIG_TEMPLATE, { mode: 0o600 });
	}
	const { response } = await dialog.showMessageBox({
		type: 'info',
		message: 'Antefy needs your Spotify app credentials',
		detail: `Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to:\n${configFile}\n\nThen register this redirect URI in your Spotify app:\n${ORIGIN}/api/auth/callback/spotify\n\nRestart Antefy afterwards.`,
		buttons: ['Open config file', 'Quit'],
		defaultId: 0
	});
	if (response === 0) await shell.openPath(configFile);
	app.quit();
}

function startServer(env) {
	const dir = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, 'server');
	const entry = path.join(dir, 'server.js');
	if (!fs.existsSync(entry)) throw new Error(`Missing ${entry}. Run "npm run prepare-server" first.`);

	server = utilityProcess.fork(entry, [], {
		cwd: dir,
		stdio: 'pipe',
		serviceName: 'Antefy server',
		env: { ...process.env, ...env, NODE_ENV: 'production', PORT: String(PORT), HOSTNAME: '127.0.0.1', NEXTAUTH_URL: ORIGIN }
	});
	const log = [];
	const keep = (chunk) => {
		const text = chunk.toString();
		process.stdout.write(text);
		log.push(text);
		if (log.length > 50) log.shift();
	};
	server.stdout?.on('data', keep);
	server.stderr?.on('data', keep);

	return new Promise((resolve, reject) => {
		const deadline = Date.now() + 30000;
		let exited = false;
		server.once('exit', (code) => {
			exited = true;
			server = null;
			reject(new Error(`The server stopped (code ${code}). Is port ${PORT} already in use?\n\n${log.join('').slice(-1500)}`));
		});
		const poll = async () => {
			if (exited) return;
			try {
				const res = await fetch(`${ORIGIN}/api/auth/providers`);
				if (res.ok) return resolve();
			} catch {
				/* not up yet */
			}
			if (Date.now() > deadline) return reject(new Error('The server did not start within 30 seconds.'));
			setTimeout(poll, 250);
		};
		poll();
	});
}

function createWindow(url) {
	win = new BrowserWindow({
		width: 1320,
		height: 860,
		minWidth: 900,
		minHeight: 600,
		title: 'Antefy',
		backgroundColor: '#09090b',
		webPreferences: { contextIsolation: true, sandbox: true }
	});
	// Popups and target=_blank links (Spotify pages, docs) open in the default browser.
	win.webContents.setWindowOpenHandler(({ url: target }) => {
		shell.openExternal(target);
		return { action: 'deny' };
	});
	win.on('closed', () => {
		win = null;
	});
	win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', () => {
		if (win) {
			if (win.isMinimized()) win.restore();
			win.focus();
		}
	});

	app.whenReady().then(async () => {
		if (DEV_URL) return createWindow(DEV_URL);

		const { env, configFile } = loadConfig();
		if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return promptForConfig(configFile);
		try {
			await startServer(env);
			createWindow(ORIGIN);
		} catch (e) {
			dialog.showErrorBox('Antefy couldn’t start', e.message);
			app.quit();
		}
	});

	// macOS convention: closing the window keeps the app (and server) running.
	app.on('activate', () => {
		if (!win && (server || DEV_URL)) createWindow(DEV_URL || ORIGIN);
	});
	app.on('before-quit', () => {
		server?.kill();
	});
}
