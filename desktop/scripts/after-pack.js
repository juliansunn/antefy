// electron-builder strips node_modules from extraResources, but the Next.js
// standalone server needs its traced node_modules. Copy the server in as-is
// after packing (before signing).
const { cpSync } = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack({ appOutDir, packager }) {
	const resources = path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources');
	cpSync(path.join(__dirname, '..', 'server'), path.join(resources, 'server'), { recursive: true, verbatimSymlinks: true });
};
