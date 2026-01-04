import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json();

  const supabase = supabaseServerSpst();

  // Verifica se è staff
  const staffRes = await requireStaff();
  const isStaff = !("response" in staffRes) && staffRes?.ok === true;

  if (isStaff) {
    // Staff può aggiornare qualsiasi status
    const { error } = await supabase
      .schema("spst")
      .from("pallet_waves")
      .update({ status })
      .eq("id", params.id);

    if (error) {
      console.error("[PATCH /api/pallets/waves/:id/status] DB error:", error);
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // Carrier: può solo aggiornare INVIATA -> IN CORSO
  // Verifica che la wave sia INVIATA e che il nuovo status sia IN CORSO
  const { data: currentWave, error: fetchError } = await supabase
    .schema("spst")
    .from("pallet_waves")
    .select("status, carrier_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !currentWave) {
    console.error("[PATCH /api/pallets/waves/:id/status] Wave not found:", fetchError);
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const currentStatus = (currentWave.status || "").toLowerCase();
  const newStatus = (status || "").toLowerCase();

  // Carrier può solo passare da INVIATA a IN CORSO
  if (currentStatus !== "inviata" || newStatus !== "in_corso") {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Carrier can only update INVIATA -> IN CORSO" },
      { status: 403 }
    );
  }

  // Verifica che il carrier abbia accesso a questa wave (via RLS, ma facciamo doppio controllo)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: carrierUser } = await supabase
    .schema("spst")
    .from("carrier_users")
    .select("carrier_id")
    .eq("user_id", user.id)
    .single();

  if (!carrierUser || carrierUser.carrier_id !== currentWave.carrier_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Aggiorna lo status
  const { error } = await supabase
    .schema("spst")
    .from("pallet_waves")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    console.error("[PATCH /api/pallets/waves/:id/status] DB error:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
