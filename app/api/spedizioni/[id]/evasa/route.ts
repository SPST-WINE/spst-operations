// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  return NextResponse.json({
    ok: true,
    id: params.id,
    message: "Evasa gated (staff-only). Implementazione invariata.",
  });
}
