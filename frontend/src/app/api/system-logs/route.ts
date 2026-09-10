import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Location of logs:
// 1. In Docker container: /app/logs
// 2. In local dev: d:/skoolio/logs or ./logs
const getLogDir = (): string => {
  const containerLogs = '/app/logs';
  if (fs.existsSync(containerLogs)) return containerLogs;

  const localLogs = path.resolve(process.cwd(), '../logs');
  if (fs.existsSync(localLogs)) return localLogs;

  const directLogs = path.resolve(process.cwd(), 'logs');
  return directLogs;
};

const resolveLogFile = (logDir: string, type: string = 'error'): string => {
  switch (type) {
    case 'crash':    return path.join(logDir, 'crash.log');
    case 'combined': return path.join(logDir, 'combined.log');
    default:         return path.join(logDir, 'error.log');
  }
};

/**
 * GET /api/system-logs?type=error|crash|combined&lines=100
 * Served directly by the Next.js Node.js server from disk.
 * Completely independent of Express backend status!
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'error';
  const linesCount = Math.min(Math.max(Number(searchParams.get('lines')) || 100, 10), 1000);

  const logDir = getLogDir();
  const filePath = resolveLogFile(logDir, type);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({
      success: true,
      message: 'Log file not yet created or empty.',
      data: {
        type,
        lines: [],
        totalLines: 0,
        sizeBytes: 0,
        source: 'nextjs-direct-disk',
      },
    });
  }

  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n').filter((l) => l.trim().length > 0);
    const tail = allLines.slice(-linesCount);

    return NextResponse.json({
      success: true,
      data: {
        type,
        lines: tail,
        totalLines: allLines.length,
        sizeBytes: stat.size,
        lastModified: stat.mtime,
        source: 'nextjs-direct-disk',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to read log file: ' + err.message },
      { status: 500 }
    );
  }
}
