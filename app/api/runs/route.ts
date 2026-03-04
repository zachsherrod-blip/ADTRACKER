import { NextResponse } from 'next/server';
import { getAllRuns } from '@/src/db/queries';

export async function GET() {
  try {
    const runs = await getAllRuns();
    return NextResponse.json({ runs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
