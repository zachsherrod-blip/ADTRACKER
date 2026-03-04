import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const csvPath = body.csv ?? process.env.CSV_PATH ?? './seed.csv';

    // Spawn scraper as child process (non-blocking for long runs)
    const child = spawn(
      'npx',
      ['tsx', path.join(process.cwd(), 'src/cli/run.ts'), '--csv', csvPath],
      {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      }
    );
    child.unref();

    return NextResponse.json({
      ok: true,
      message: `Scrape started for CSV: ${csvPath}`,
      pid: child.pid,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to /api/run to start a scrape' });
}
