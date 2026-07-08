import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'salt-world-architecture-doc',
    version: '1.0.0',
    status: 'ok',
    phase: 1,
  });
}
