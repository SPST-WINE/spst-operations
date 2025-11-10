import { NextResponse } from "next/server";

// Stub temporaneo per /api/check-user
// Non usa più Firebase, non tocca Supabase, non fa controlli reali.

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
