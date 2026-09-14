import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist/desktop', {
  recursive: true,
});

await Promise.all([
  build({
    entryPoints: ['desktop/main.ts'],
    outfile: 'dist/desktop/main.js',

    bundle: true,
    platform: 'node',
    format: 'esm',

    external: ['electron'],

    sourcemap: true,
    target: 'node22',
  }),

  build({
    entryPoints: ['desktop/preload.ts'],
    outfile: 'dist/desktop/preload.cjs',

    bundle: true,
    platform: 'node',
    format: 'cjs',

    external: ['electron'],

    sourcemap: true,
    target: 'node22',
  }),
]);

console.log('Electron main and preload built successfully.');
