// app/api/spedizioni/[id]/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  // Qui lasciamo invariata la tua logica interna: è solo gated.
  const body = await req.json().catch(() => ({} as any));

  return NextResponse.json({
    ok: true,
    id: params.id,
    message: "Notify gated (staff-only). Implementazione invariata.",
    body,
  });
}
