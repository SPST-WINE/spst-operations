// app/api/backoffice/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/backoffice/impostazioni] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function getEmailNorm(req: NextRequest): string | null {
  const url = new URL(req.url);
  const qEmail = url.searchParams.get("email");
  if (qEmail && qEmail.trim()) return qEmail.trim().toLowerCase();
  return null;
}

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company_name: string | null;
  vat_number: string | null;
};

type AddressRow = {
  country: string | null;
  company: string | null;
  full_name: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  tax_id: string | null;
};

function mapToMittente(addr: AddressRow | null, cust: CustomerRow | null) {
  const paese = addr?.country ?? "";
  const mittente = addr?.company || addr?.full_name || cust?.company_name || cust?.name || "";
  const citta = addr?.city ?? "";
  const cap = addr?.postal_code ?? "";
  const indirizzo = addr?.street ?? "";
  const telefono = addr?.phone || cust?.phone || "";
  const piva = addr?.tax_id || cust?.vat_number || "";
  return { paese, mittente, citta, cap, indirizzo, telefono, piva };
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message: "Variabili Supabase mancanti (URL / SERVICE_ROLE).",
    });
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, email, name, phone, company_name, vat_number")
    .eq("email", emailNorm)
    .maybeSingle();

  if (custErr) return jsonError(500, "DB_ERROR", { message: custErr.message });

  if (!customer) {
    return NextResponse.json({
      ok: true,
      email: emailNorm,
      mittente: mapToMittente(null, null),
    });
  }

  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("country, company, full_name, phone, street, city, postal_code, tax_id")
    .eq("customer_id", customer.id)
    .eq("kind", "shipper")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (addrErr) return jsonError(500, "DB_ERROR", { message: addrErr.message });

  return NextResponse.json({
    ok: true,
    email: emailNorm,
    mittente: mapToMittente((address as any) ?? null, customer as any),
  });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message: "Variabili Supabase mancanti (URL / SERVICE_ROLE).",
    });
  }

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {}

  const m = body?.mittente ?? body ?? {};
  const mittentePayload = {
    paese: (m.paese || "").trim() || null,
    mittente: (m.mittente || "").trim() || null,
    citta: (m.citta || "").trim() || null,
    cap: (m.cap || "").trim() || null,
    indirizzo: (m.indirizzo || "").trim() || null,
    telefono: (m.telefono || "").trim() || null,
    piva: (m.piva || "").trim() || null,
  };

  const { data: existingCust, error: custErr } = await supabase
    .from("customers")
    .select("id, email, name, phone, company_name, vat_number")
    .eq("email", emailNorm)
    .maybeSingle();

  if (custErr) return jsonError(500, "DB_ERROR", { message: custErr.message });

  let customer: CustomerRow;

  if (!existingCust) {
    const { data: insertedCust, error: insErr } = await supabase
      .from("customers")
      .insert({
        email: emailNorm,
        name: mittentePayload.mittente,
        company_name: mittentePayload.mittente,
        phone: mittentePayload.telefono,
        vat_number: mittentePayload.piva,
        fields: {},
      })
      .select("id, email, name, phone, company_name, vat_number")
      .single();

    if (insErr) return jsonError(500, "DB_ERROR", { message: insErr.message });
    customer = insertedCust as any;
  } else {
    customer = existingCust as any;
    await supabase
      .from("customers")
      .update({
        name: mittentePayload.mittente,
        company_name: mittentePayload.mittente,
        phone: mittentePayload.telefono,
        vat_number: mittentePayload.piva,
      })
      .eq("id", customer.id);
  }

  const { data: existingAddr, error: addrSelErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("kind", "shipper")
    .maybeSingle();

  if (addrSelErr) return jsonError(500, "DB_ERROR", { message: addrSelErr.message });

  const addrBase = {
    customer_id: customer.id,
    kind: "shipper",
    country: mittentePayload.paese,
    company: mittentePayload.mittente,
    full_name: mittentePayload.mittente,
    phone: mittentePayload.telefono,
    street: mittentePayload.indirizzo,
    city: mittentePayload.citta,
    postal_code: mittentePayload.cap,
    tax_id: mittentePayload.piva,
  };

  if (!existingAddr?.id) {
    const { error: insAddrErr } = await supabase.from("addresses").insert(addrBase);
    if (insAddrErr) return jsonError(500, "DB_ERROR", { message: insAddrErr.message });
  } else {
    const { error: updAddrErr } = await supabase
      .from("addresses")
      .update(addrBase)
      .eq("id", existingAddr.id);
    if (updAddrErr) return jsonError(500, "DB_ERROR", { message: updAddrErr.message });
  }

  return NextResponse.json({
    ok: true,
    email: emailNorm,
    mittente: mapToMittente(null, customer),
  });
}
