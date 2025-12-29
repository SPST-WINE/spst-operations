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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asDateYYYYMMDD(x: any): string | null {
  if (!x) return null;
  const s = String(x);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10) || null;
}

function buildEmailHtml(opts: {
  title: string;
  preheader: string;
  humanId: string;
  pickupDate: string | null;
  carrier: string | null;
  tracking: string | null;
  areaUrl: string;
  waUrl: string;
  logoUrl: string;
}) {
  const {
    title,
    preheader,
    humanId,
    pickupDate,
    carrier,
    tracking,
    areaUrl,
    waUrl,
    logoUrl,
  } = opts;

  const pickupBlock = pickupDate
    ? `<p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
         <strong>Ritiro previsto:</strong> ${escapeHtml(pickupDate)}
       </p>`
    : "";

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      preheader
    )}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);border:1px solid #e2e8f0;">
            <!-- Header blu -->
            <tr>
              <td style="background:#1c3e5e;padding:18px 24px;">
                <img src="${escapeHtml(
                  logoUrl
                )}" alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Spedizione in transito</h1>

                <!-- ID box -->
                <table role="presentation" style="width:100%;margin:6px 0 18px;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:4px;">ID spedizione</td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#111827;">
                      ${escapeHtml(humanId)}
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Gentile Cliente, la tua spedizione è stata evasa. Trovi i documenti da stampare all'interno della tua
                  <a href="${escapeHtml(
                    areaUrl
                  )}" style="color:#0a58ca;">Area Riservata SPST</a>.
                </p>

                ${pickupBlock}

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Se ci dovessero essere problemi con il ritiro puoi riferirti al nostro
                  <a href="${escapeHtml(
                    waUrl
                  )}" style="color:#0a58ca;">Supporto WhatsApp</a>.
                </p>

                <!-- Info box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 16px;">
                  <tr>
                    <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
                      <div style="margin:0 0 6px 0;"><strong>Corriere:</strong> ${escapeHtml(
                        carrier || "—"
                      )}</div>
                      <div><strong>Tracking:</strong> ${escapeHtml(tracking || "—")}</div>
                    </td>
                  </tr>
                </table>

                <!-- CTAs -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(
                        areaUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Area Riservata
                      </a>
                    </td>
                    <td style="width:10px"></td>
                    <td>
                      <a href="${escapeHtml(
                        waUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#f7911e;color:#111827;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Supporto WhatsApp
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;">Grazie,<br/>Team SPST</p>
              </td>
            </tr>

            <!-- Footer grigio -->
            <tr>
              <td style="padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                <p style="margin:0;">Ricevi questa mail perché hai effettuato una spedizione con SPST.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const supabase = makeSupabase();
  if (!supabase) return jsonError(500, "MISSING_SUPABASE_ENV");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return jsonError(500, "MISSING_RESEND_API_KEY");

  const fromEnv = process.env.RESEND_NOREPLY_FROM; // ✅ richiesta: usare questa env
  if (!fromEnv) return jsonError(500, "MISSING_RESEND_NOREPLY_FROM");

  const id = ctx.params.id;
  if (!isUuid(id)) return jsonError(400, "INVALID_ID");

  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {}

  try {
    const { data: ship, error } = await supabase
  .schema("spst")
  .from("shipments")
  .select("id,human_id,email_cliente,email_norm,carrier,tracking_code,status,giorno_ritiro")
  .eq("id", id)
  .single();

    if (error) return jsonError(500, "DB_READ_ERROR", { message: error.message });
    if (!ship) return jsonError(404, "NOT_FOUND");

    const toFromDb =
      normalizeEmail(ship.email_cliente) || normalizeEmail(ship.email_norm);

    const toFromBody = normalizeEmail(body?.to);
    const to = toFromBody || toFromDb;

    if (!to) return jsonError(400, "MISSING_RECIPIENT_EMAIL");

    // 🔒 safety: evita invii “fuori DB” per errore umano
    if (toFromDb && toFromBody && toFromBody !== toFromDb) {
      return jsonError(400, "RECIPIENT_MISMATCH", {
        expected: toFromDb,
        got: toFromBody,
      });
    }

    const humanId = ship.human_id || ship.id;
    const pickupDate = asDateYYYYMMDD(ship.giorno_ritiro);

    // ✅ richieste “micro-changes”
    const areaUrl = "https://spst-operations.vercel.app/dashboard/spedizioni";
    const waUrl = "https://wa.me/message/CP62RMFFDNZPO1";
    const logoUrl = "https://spst-operations.vercel.app/spst-logo.png"; // file in /public/spst-logo.png

    const subject = `SPST • Spedizione in transito — ${humanId}`;
    const title = subject;
    const preheader = pickupDate
      ? `Spedizione in transito. Ritiro previsto ${pickupDate}.`
      : `Spedizione in transito.`;

    const html = buildEmailHtml({
      title,
      preheader,
      humanId,
      pickupDate,
      carrier: ship.carrier || null,
      tracking: ship.tracking_code || null,
      areaUrl,
      waUrl,
      logoUrl,
    });

    const resend = new Resend(resendKey);

    // ✅ usare l’env RESEND_NOREPLY_FROM (es: "SPST <no-reply@spst.it>")
    const from = fromEnv;

    const sent = await resend.emails.send({ from, to, subject, html });

    return NextResponse.json({ ok: true, to, subject, sent });
  } catch (e: any) {
    console.error("[send-evasa-email] fatal", { id, err: e?.message ?? e });
    return jsonError(500, "INTERNAL_ERROR", { message: e?.message ?? String(e) });
  }
}
