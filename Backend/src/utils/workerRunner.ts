// ── utils/workerRunner.ts ─────────────────────────────────────────────────────
// Generic helper that runs a TypeScript worker file in a Worker thread and
// returns a typed Promise. Uses ts-node/esm register so workers can stay in TS.
// ─────────────────────────────────────────────────────────────────────────────
import { Worker } from 'worker_threads';
import path from 'path';

export function runInWorker<T = unknown>(
  workerTsFile: string,   // absolute path to the .ts worker file
  workerData:   unknown   // payload serialised via structured clone
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.resolve(__dirname, '../utils/tsWorkerBootstrap.js'),
      {
        workerData: {
          __workerFile: workerTsFile,   // real worker path forwarded by bootstrap
          ...( workerData as object ),
        },
      }
    );

    worker.once('message', (msg: { success: boolean; buffer?: T; error?: string }) => {
      if (msg.success) {
        resolve(msg.buffer as T);
      } else {
        reject(new Error(msg.error ?? 'Worker failed'));
      }
    });

    worker.once('error',  reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
