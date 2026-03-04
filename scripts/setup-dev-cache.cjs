const fs = require('fs');
const path = require('path');

function ensureFastNextCache() {
  if (process.platform !== 'win32') {
    return;
  }

  const projectRoot = path.resolve(__dirname, '..');
  const sourceNextDir = path.join(projectRoot, '.next');
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return;
  }

  const targetNextDir = path.join(localAppData, 'farm-hands', '.next');
  fs.mkdirSync(path.dirname(targetNextDir), { recursive: true });
  fs.mkdirSync(targetNextDir, { recursive: true });

  if (fs.existsSync(sourceNextDir)) {
    const stat = fs.lstatSync(sourceNextDir);
    if (stat.isSymbolicLink()) {
      return;
    }
    fs.rmSync(sourceNextDir, { recursive: true, force: true });
  }

  fs.symlinkSync(targetNextDir, sourceNextDir, 'junction');
  console.log(`Using local Next.js cache at ${targetNextDir}`);
}

ensureFastNextCache();