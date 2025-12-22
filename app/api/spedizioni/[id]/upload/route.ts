// app/api/spedizioni/[id]/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const dynamic = "force-dynamic";

// Owner-or-staff gate: se NON staff, deve essere owner (RLS: shipment visibile)
async function requireOwnerOrStaff(shipmentId: string) {
  // prova staff
  const staff = await requireStaff();
  if (!("response" in staff)) return { ok: true, mode: "staff" as const };

  // se non staff, allora serve utente loggato + ownership su shipment
  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) };
  }

  const { data, error } = await supa
    .from("shipments")
    .select("id")
    .eq("id", shipmentId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 }) };
  }

  return { ok: true, mode: "client" as const };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const gate = await requireOwnerOrStaff(id);
  if (!gate.ok) return gate.response;

  // ✅ Da qui in poi: incolla la tua logica esistente di upload (signed url / storage, ecc.)
  // Io non posso ricostruirla senza vedere il contenuto completo attuale del file.
  const body = await req.json().catch(() => ({} as any));
  return NextResponse.json({
    ok: true,
    id,
    mode: gate.mode,
    message: "Upload gated (owner-or-staff). Ora incolla qui la tua logica upload originale.",
    body,
  });
}
