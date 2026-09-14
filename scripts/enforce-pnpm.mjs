import { rmSync } from 'node:fs';

rmSync('package-lock.json', { force: true });
rmSync('yarn.lock', { force: true });

const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.startsWith('pnpm/')) {
  console.error('This project uses pnpm. Please run commands with pnpm.');
  process.exit(1);
}
