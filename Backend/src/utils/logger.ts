import fs from 'fs';
import path from 'path';

// Path to persistent logs directory (mounted to host via Docker volume)
const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err: any) {
  console.warn('[Logger] Failed to create log directory:', err.message);
}

const formatTimestamp = (): string => new Date().toISOString();

/**
 * Append message to file asynchronously (fire-and-forget for regular requests).
 */
const appendLog = (filename: string, text: string) => {
  const filePath = path.join(LOG_DIR, filename);
  fs.appendFile(filePath, text + '\n', (err) => {
    if (err) console.error(`[Logger Error] Could not write to ${filename}:`, err.message);
  });
};

/**
 * Append message to file synchronously (used for crash handlers so data is written before exit).
 */
const appendLogSync = (filename: string, text: string) => {
  try {
    const filePath = path.join(LOG_DIR, filename);
    fs.appendFileSync(filePath, text + '\n', 'utf8');
  } catch (err: any) {
    console.error(`[Logger Sync Error] Could not write to ${filename}:`, err.message);
  }
};

export const logger = {
  /**
   * Log standard operational info or HTTP requests
   */
  info: (message: string, meta?: any) => {
    const line = `[INFO] [${formatTimestamp()}] ${message} ${meta ? JSON.stringify(meta) : ''}`;
    console.log(line);
    appendLog('combined.log', line);
  },

  /**
   * Log warning events (e.g. rate limits, retries)
   */
  warn: (message: string, meta?: any) => {
    const line = `[WARN] [${formatTimestamp()}] ${message} ${meta ? JSON.stringify(meta) : ''}`;
    console.warn(line);
    appendLog('combined.log', line);
  },

  /**
   * Log errors (5xx server errors, unexpected database issues)
   */
  error: (message: string, err?: any) => {
    const errDetails = err?.stack || err?.message || (err ? JSON.stringify(err) : '');
    const line = `[ERROR] [${formatTimestamp()}] ${message}\n${errDetails}`;
    console.error(line);
    appendLog('error.log', line);
    appendLog('combined.log', `[ERROR] [${formatTimestamp()}] ${message}`);

    // Lazy load email alert to avoid circular dependency
    import('./emailService').then(({ sendCriticalErrorAlert }) => {
      sendCriticalErrorAlert('Server Error (5xx)', err?.message || message, err?.stack, message).catch(() => {});
    }).catch(() => {});
  },

  /**
   * Log fatal crashes synchronously before Node process exits
   */
  crash: (type: string, err: any) => {
    const divider = '='.repeat(70);
    const content = `\n${divider}\n[FATAL CRASH: ${type}] [${formatTimestamp()}]\nMessage: ${err?.message || err}\nStack:\n${err?.stack || 'No stack trace'}\n${divider}\n`;
    console.error(content);
    appendLogSync('crash.log', content);
    appendLogSync('error.log', content);

    // Synchronous-friendly attempt to dispatch alert
    try {
      const { sendCriticalErrorAlert } = require('./emailService');
      sendCriticalErrorAlert(type, err?.message || String(err), err?.stack, 'Process Termination');
    } catch {
      // Avoid masking the crash if mailer fails
    }
  },
};

export default logger;

