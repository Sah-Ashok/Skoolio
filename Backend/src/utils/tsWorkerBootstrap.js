// ── utils/tsWorkerBootstrap.js ────────────────────────────────────────────────
// Plain JS bootstrap that registers ts-node so Worker threads can run .ts files.
// All worker workerData must include __workerFile pointing to the real .ts file.
// ─────────────────────────────────────────────────────────────────────────────
const { workerData } = require('worker_threads');

require('ts-node').register({
  transpileOnly: true,     // skip type checking in workers for speed
  compilerOptions: {
    module:    'commonjs',
    esModuleInterop: true,
  },
});

// Hand off to the actual TypeScript worker file
require(workerData.__workerFile);
