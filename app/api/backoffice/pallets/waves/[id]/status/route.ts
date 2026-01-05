// app/api/backoffice/pallets/waves/[id]/status/route.ts
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { createClient } from "@supabase/supabase-js";
import { sendEmailResend } from "@/lib/email/sendResend";
import { buildWaveAssignedCarrierHtml } from "@/lib/email/templates/waveAssignedCarrier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const staffRes: any = await requireStaff();
  if ("response" in staffRes) return staffRes.response;

  if (!staffRes || staffRes.ok !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let admin;
  try {
    admin = getAdminSupabase();
  } catch (e: any) {
    console.error(
      "[PATCH /api/backoffice/pallets/waves/:id/status] admin init error:",
      e
    );
    return NextResponse.json(
      { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || "");

  // Carica stato corrente (serve per gestire transizioni + email)
  const { data: beforeWave, error: beforeErr } = await admin
    .schema("spst")
    .from("pallet_waves")
    .select("id,code,status,carrier_id,planned_pickup_date,pickup_window")
    .eq("id", params.id)
    .maybeSingle();

  if (beforeErr || !beforeWave) {
    console.error(
      "[PATCH /api/backoffice/pallets/waves/:id/status] wave fetch error:",
      beforeErr
    );
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const fromStatus = String(beforeWave.status || "").toLowerCase();
  const toStatus = String(status || "").toLowerCase();

  const { error } = await admin
    .schema("spst")
    .from("pallet_waves")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    console.error(
      "[PATCH /api/backoffice/pallets/waves/:id/status] DB error:",
      error
    );
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  // ✅ Best-effort email al trasportatore quando BOZZA -> INVIATA
  if (fromStatus === "bozza" && toStatus === "inviata") {
    try {
      const carrierId = (beforeWave as any).carrier_id as string | null;
      if (carrierId) {
        // destinatari = tutti i carrier_users abilitati
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
          // counts
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

          const { subject, html } = buildWaveAssignedCarrierHtml({
            waveCode: String((beforeWave as any).code || beforeWave.id),
            waveId: String(beforeWave.id),
            plannedPickupDate: (beforeWave as any).planned_pickup_date ?? null,
            pickupWindow: (beforeWave as any).pickup_window ?? null,
            shipmentsCount,
            palletsCount,
          });

          await sendEmailResend({ to: emails, subject, html });
        }
      }
    } catch (e) {
      console.error(
        "[PATCH /api/backoffice/pallets/waves/:id/status] wave assigned email failed (non-blocking)",
        e
      );
    }
  }

  return NextResponse.json({ ok: true });
}
