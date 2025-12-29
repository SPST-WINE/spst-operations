// FILE: app/api/spedizioni/[id]/send-evasa-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

function jsonError(status: number, error: string, extra: any = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim().toLowerCase();
  return v || null;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const supabase = makeSupabase();
  if (!supabase) return jsonError(500, "MISSING_SUPABASE_ENV");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return jsonError(500, "MISSING_RESEND_API_KEY");

  const id = ctx.params.id;
  if (!isUuid(id)) return jsonError(400, "INVALID_ID");

  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {}

  try {
    const { data: ship, error } = await supabase
      .from("shipments")
      .select("id,human_id,email_cliente,email_norm,carrier,tracking_code,status")
      .eq("id", id)
      .single();

    if (error) return jsonError(500, "DB_READ_ERROR", { message: error.message });
    if (!ship) return jsonError(404, "NOT_FOUND");

    const toFromDb =
      normalizeEmail(ship.email_cliente) || normalizeEmail(ship.email_norm);

    const toFromBody = normalizeEmail(body?.to);
    const to = toFromBody || toFromDb;

    if (!to) return jsonError(400, "MISSING_RECIPIENT_EMAIL");

    // safety: evita invii a email “random” se l’operatore sbaglia incolla
    // (se vuoi permettere override, rimuovi questo blocco)
    if (toFromDb && toFromBody && toFromBody !== toFromDb) {
      return jsonError(400, "RECIPIENT_MISMATCH", {
        expected: toFromDb,
        got: toFromBody,
      });
    }

    const from = process.env.RESEND_FROM || "SPST <notification@spst.it>";
    const subject = `SPST • Spedizione evasa — ${ship.human_id || ship.id}`;

    const carrier = ship.carrier || "—";
    const tracking = ship.tracking_code || "—";

    const html = `
      <div style="font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Spedizione evasa ✅</h2>
        <p style="margin:0 0 12px">
          La tua spedizione è stata evasa ed è in lavorazione.
        </p>

        <table style="border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:4px 10px 4px 0;color:#64748b">ID</td>
            <td style="padding:4px 0">${ship.human_id || ship.id}</td>
          </tr>
          <tr>
            <td style="padding:4px 10px 4px 0;color:#64748b">Corriere</td>
            <td style="padding:4px 0">${carrier}</td>
          </tr>
          <tr>
            <td style="padding:4px 10px 4px 0;color:#64748b">Tracking</td>
            <td style="padding:4px 0">${tracking}</td>
          </tr>
        </table>

        <p style="margin:14px 0 0;color:#64748b;font-size:12px">
          Per supporto rispondi a questa email.
        </p>
      </div>
    `;

    const resend = new Resend(resendKey);
    const sent = await resend.emails.send({ from, to, subject, html });

    return NextResponse.json({ ok: true, sent, to });
  } catch (e: any) {
    console.error("[api/spedizioni/[id]/send-evasa-email] fatal", {
      id,
      err: e?.message ?? e,
    });
    return jsonError(500, "INTERNAL_ERROR", { message: e?.message ?? String(e) });
  }
}
