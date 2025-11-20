// app/api/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/impostazioni] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" }, // <── usiamo lo schema spst
  });
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, any>
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function getEmailNorm(req: NextRequest): string | null {
  const url = new URL(req.url);
  const qEmail = url.searchParams.get("email");
  if (qEmail && qEmail.trim()) {
    return qEmail.trim().toLowerCase();
  }

  const hdr = req.headers.get("x-spst-email");
  if (hdr && hdr.trim()) {
    return hdr.trim().toLowerCase();
  }

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
  const mittente =
    addr?.company ||
    addr?.full_name ||
    cust?.company_name ||
    cust?.name ||
    "";
  const citta = addr?.city ?? "";
  const cap = addr?.postal_code ?? "";
  const indirizzo = addr?.street ?? "";
  const telefono = addr?.phone || cust?.phone || "";
  const piva = addr?.tax_id || cust?.vat_number || "";

  return { paese, mittente, citta, cap, indirizzo, telefono, piva };
}

/* ------------------------------------------------------------------ */
/* GET: leggi impostazioni                                            */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    console.warn("[API/impostazioni:GET] NO_EMAIL");
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    // 1) Trova il customer per email
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select(
        "id, email, name, phone, company_name, vat_number"
      )
      .eq("email", emailNorm)
      .maybeSingle();

    if (custErr) {
      console.error("[API/impostazioni:GET] customer db error", custErr);
      return jsonError(500, "DB_ERROR", { message: custErr.message });
    }

    if (!customer) {
      // Nessun customer ancora → ritorno ok ma campi vuoti
      return NextResponse.json({
        ok: true,
        email: emailNorm,
        mittente: mapToMittente(null, null),
      });
    }

    // 2) Trova l'indirizzo shipper per quel customer
    const { data: address, error: addrErr } = await supabase
      .from("addresses")
      .select(
        "country, company, full_name, phone, street, city, postal_code, tax_id"
      )
      .eq("customer_id", customer.id)
      .eq("kind", "shipper")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (addrErr) {
      console.error("[API/impostazioni:GET] address db error", addrErr);
      return jsonError(500, "DB_ERROR", { message: addrErr.message });
    }

    const mittente = mapToMittente(
      (address as AddressRow | null) ?? null,
      customer as CustomerRow
    );

    return NextResponse.json({
      ok: true,
      email: emailNorm,
      mittente,
    });
  } catch (err: any) {
    console.error("[API/impostazioni:GET] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}

/* ------------------------------------------------------------------ */
/* POST: salva impostazioni                                           */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    console.warn("[API/impostazioni:POST] NO_EMAIL");
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // body vuoto -> gestiamo comunque
  }

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

  try {
    // 1) Trova o crea il customer
    const { data: existingCust, error: custErr } = await supabase
      .from("customers")
      .select("id, email, name, phone, company_name, vat_number")
      .eq("email", emailNorm)
      .maybeSingle();

    if (custErr) {
      console.error("[API/impostazioni:POST] customer select error", custErr);
      return jsonError(500, "DB_ERROR", { message: custErr.message });
    }

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
        .select(
          "id, email, name, phone, company_name, vat_number"
        )
        .single();

      if (insErr) {
        console.error("[API/impostazioni:POST] customer insert error", insErr);
        return jsonError(500, "DB_ERROR", { message: insErr.message });
      }

      customer = insertedCust as CustomerRow;
    } else {
      customer = existingCust as CustomerRow;

      // Optional: aggiorniamo anche i dati base del customer
      const { error: updCustErr } = await supabase
        .from("customers")
        .update({
          name: mittentePayload.mittente,
          company_name: mittentePayload.mittente,
          phone: mittentePayload.telefono,
          vat_number: mittentePayload.piva,
        })
        .eq("id", customer.id);

      if (updCustErr) {
        console.warn(
          "[API/impostazioni:POST] customer update warn",
          updCustErr
        );
      }
    }

    // 2) Trova o crea l'indirizzo shipper
    const { data: existingAddr, error: addrSelErr } = await supabase
      .from("addresses")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("kind", "shipper")
      .maybeSingle();

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

    let address: AddressRow | null = null;

    if (addrSelErr) {
      console.error(
        "[API/impostazioni:POST] address select error",
        addrSelErr
      );
      return jsonError(500, "DB_ERROR", { message: addrSelErr.message });
    }

    if (!existingAddr) {
      const { data: insAddr, error: insAddrErr } = await supabase
        .from("addresses")
        .insert(addrBase)
        .select(
          "country, company, full_name, phone, street, city, postal_code, tax_id"
        )
        .single();

      if (insAddrErr) {
        console.error(
          "[API/impostazioni:POST] address insert error",
          insAddrErr
        );
        return jsonError(500, "DB_ERROR", { message: insAddrErr.message });
      }

      address = insAddr as AddressRow;
    } else {
      const { data: updAddr, error: updAddrErr } = await supabase
        .from("addresses")
        .update(addrBase)
        .eq("id", existingAddr.id)
        .select(
          "country, company, full_name, phone, street, city, postal_code, tax_id"
        )
        .single();

      if (updAddrErr) {
        console.error(
          "[API/impostazioni:POST] address update error",
          updAddrErr
        );
        return jsonError(500, "DB_ERROR", { message: updAddrErr.message });
      }

      address = updAddr as AddressRow;
    }

    const mittente = mapToMittente(address, customer);

    return NextResponse.json({
      ok: true,
      email: emailNorm,
      mittente,
    });
  } catch (err: any) {
    console.error("[API/impostazioni:POST] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}
