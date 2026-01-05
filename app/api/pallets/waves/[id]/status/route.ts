import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailResend } from "@/lib/email/sendResend";
import { buildWaveAcceptedCarrierHtml } from "@/lib/email/templates/waveAcceptedCarrier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const service =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !service) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY) and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json();

  const sessionSupabase = supabaseServerSpst();

  // Verifica se è staff
  const staffRes = await requireStaff();
  const isStaff = !("response" in staffRes) && staffRes?.ok === true;

  // Usa service role per tutti gli update (bypass RLS)
  const admin = getAdminSupabase();

  if (isStaff) {
    // Staff può aggiornare qualsiasi status
    const { error } = await admin
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
  const { data: currentWave, error: fetchError } = await admin
    .schema("spst")
    .from("pallet_waves")
    .select("status, carrier_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !currentWave) {
    console.error(
      "[PATCH /api/pallets/waves/:id/status] Wave not found:",
      fetchError
    );
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const currentStatus = (currentWave.status || "").toLowerCase();
  const newStatus = (status || "").toLowerCase();

  if (currentStatus !== "inviata" || newStatus !== "in_corso") {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Carrier can only update INVIATA -> IN CORSO" },
      { status: 403 }
    );
  }

  // Verifica sessione carrier
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: carrierUser } = await sessionSupabase
    .schema("spst")
    .from("carrier_users")
    .select("carrier_id")
    .eq("user_id", user.id)
    .single();

  if (!carrierUser || carrierUser.carrier_id !== currentWave.carrier_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Update status (service role)
  const { error } = await admin
    .schema("spst")
    .from("pallet_waves")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    console.error("[PATCH /api/pallets/waves/:id/status] DB error:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  // ✅ Best-effort email al trasportatore quando INVIATA -> IN_CORSO (wave accettata)
  try {
    const carrierId = String(currentWave.carrier_id || "");
    if (carrierId) {
      const { data: waveRow } = await admin
        .schema("spst")
        .from("pallet_waves")
        .select("id,code,planned_pickup_date,pickup_window")
        .eq("id", params.id)
        .maybeSingle();

      const { data: carrierUsers } = await admin
        .schema("spst")
        .from("carrier_users")
        .select("user_id")
        .eq("carrier_id", carrierId)
        .eq("enabled", true);

      const userIds = (carrierUsers || [])
        .map((x: any) => String(x.user_id || "").trim())
        .filter(Boolean);

      const emails: string[] = [];
      for (const uid of userIds) {
        const u = await (admin as any).auth.admin
          .getUserById(uid)
          .catch(() => null);
        const email = u?.data?.user?.email ? String(u.data.user.email) : "";
        if (email) emails.push(email);
      }

      if (emails.length > 0) {
        const { data: items } = await admin
          .schema("spst")
          .from("pallet_wave_items")
          .select("shipment_id")
          .eq("wave_id", params.id);

        const shipmentIds = (items || [])
          .map((x: any) => String(x.shipment_id || "").trim())
          .filter(Boolean);

        const shipmentsCount = shipmentIds.length;

        let palletsCount = 0;
        if (shipmentIds.length > 0) {
          const { data: shRows } = await admin
            .schema("spst")
            .from("shipments")
            .select("id,colli_n")
            .in("id", shipmentIds);

          palletsCount = (shRows || []).reduce((sum: number, r: any) => {
            const n = Number(r?.colli_n ?? 0);
            return sum + (Number.isFinite(n) ? n : 0);
          }, 0);
        }

        const { subject, html } = buildWaveAcceptedCarrierHtml({
          waveCode: String(waveRow?.code || waveRow?.id || params.id),
          waveId: String(waveRow?.id || params.id),
          plannedPickupDate: (waveRow as any)?.planned_pickup_date ?? null,
          pickupWindow: (waveRow as any)?.pickup_window ?? null,
          shipmentsCount,
          palletsCount,
        });

        await sendEmailResend({ to: emails, subject, html });
      }
    }
  } catch (e) {
    console.error(
      "[PATCH /api/pallets/waves/:id/status] wave accepted email failed (non-blocking)",
      e
    );
  }

  return NextResponse.json({ ok: true });
}
