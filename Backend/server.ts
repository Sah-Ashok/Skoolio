// ⚠️  IMPORTANT: Load .env FIRST, before any other module is imported.
// nodemailer (emailService.ts) reads SMTP_USER/PASS at module init time,
// so dotenv must run before any import that transitively touches it.
import 'dotenv/config';

import app from "./src/app";
import './src/workers/feeBilling.worker';
import logger from './src/utils/logger';

// ── Process-Level Crash Protection & File-Based Logging ───────────────────────
process.on('uncaughtException', (err: Error) => {
  logger.crash('UNCAUGHT_EXCEPTION', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.crash('UNHANDLED_REJECTION', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server started successfully on port ${PORT}`);
});
