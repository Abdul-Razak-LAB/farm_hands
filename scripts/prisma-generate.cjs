const { spawnSync } = require('node:child_process');

const env = { ...process.env };

if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
  env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/farmops';
  console.warn('⚠️ DATABASE_URL was missing during install; using fallback value for Prisma generate.');
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', 'generate'], {
  stdio: 'inherit',
  env,
  shell: false,
});

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
