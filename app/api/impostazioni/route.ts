// app/api/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(status: number, error: string, message?: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

type CustomerRow = {
  id: string;
  user_id: string | null;
  email: string | null;
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

// GET self-service
export async function GET() {
  const supabase = supabaseServerSpst();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user?.email) {
    return jsonError(401, "UNAUTHORIZED", "Fai login e riprova.");
  }

  // customer by user_id (non per email)
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, user_id, email, name, phone, company_name, vat_number")
    .eq("user_id", user.id)
    .maybeSingle();

  if (custErr) return jsonError(500, "DB_ERROR", custErr.message);

  if (!customer?.id) {
    return NextResponse.json({
      ok: true,
      email: user.email,
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

  if (addrErr) return jsonError(500, "DB_ERROR", addrErr.message);

  return NextResponse.json({
    ok: true,
    email: user.email,
    mittente: mapToMittente((address as any) ?? null, customer as any),
  });
}

// POST self-service
export async function POST(req: NextRequest) {
  const supabase = supabaseServerSpst();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user?.email) {
    return jsonError(401, "UNAUTHORIZED", "Fai login e riprova.");
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

   // 1) upsert/claim customer
  const userEmail = user.email.toLowerCase().trim();

  // A) cerco per user_id
  const { data: byUser, error: byUserErr } = await supabase
    .from("customers")
    .select("id, user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (byUserErr) return jsonError(500, "DB_ERROR", byUserErr.message);

  let customerId: string | null = byUser?.id || null;

  // B) se non c'è, cerco per email (record creato dal backoffice)
  if (!customerId) {
    const { data: byEmail, error: byEmailErr } = await supabase
      .from("customers")
      .select("id, user_id, email")
      .eq("email", userEmail)
      .maybeSingle();

    if (byEmailErr) return jsonError(500, "DB_ERROR", byEmailErr.message);

    if (byEmail?.id) {
      // se è "libero" (user_id null) → claim
      if (!byEmail.user_id) {
        const { error: claimErr } = await supabase
          .from("customers")
          .update({ user_id: user.id })
          .eq("id", byEmail.id);

        if (claimErr) return jsonError(500, "DB_ERROR", claimErr.message);

        customerId = byEmail.id;
      } else if (byEmail.user_id !== user.id) {
        // email già associata ad un altro account
        return jsonError(
          409,
          "EMAIL_ALREADY_USED",
          "Questa email risulta già associata ad un altro account."
        );
      } else {
        customerId = byEmail.id;
      }
    }
  }

  // C) se ancora non esiste → INSERT
  if (!customerId) {
    const { data: inserted, error: insErr } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        email: userEmail,
        name: mittentePayload.mittente,
        company_name: mittentePayload.mittente,
        phone: mittentePayload.telefono,
        vat_number: mittentePayload.piva,
        fields: {},
      })
      .select("id")
      .single();

    if (insErr) return jsonError(500, "DB_ERROR", insErr.message);
    customerId = inserted?.id || null;
  } else {
    // D) update dati base (sempre)
    const { error: updErr } = await supabase
      .from("customers")
      .update({
        email: userEmail,
        name: mittentePayload.mittente,
        company_name: mittentePayload.mittente,
        phone: mittentePayload.telefono,
        vat_number: mittentePayload.piva,
      })
      .eq("id", customerId);

    if (updErr) return jsonError(500, "DB_ERROR", updErr.message);
  }

  // 2) upsert address shipper
  const { data: existingAddr, error: addrSelErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("customer_id", customerId)
    .eq("kind", "shipper")
    .maybeSingle();

  if (addrSelErr) return jsonError(500, "DB_ERROR", addrSelErr.message);

  const addrBase = {
    customer_id: customerId,
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
    if (insAddrErr) return jsonError(500, "DB_ERROR", insAddrErr.message);
  } else {
    const { error: updAddrErr } = await supabase
      .from("addresses")
      .update(addrBase)
      .eq("id", existingAddr.id);
    if (updAddrErr) return jsonError(500, "DB_ERROR", updAddrErr.message);
  }

  // ritorno una vista coerente
  const { data: customer } = await supabase
    .from("customers")
    .select("id, user_id, email, name, phone, company_name, vat_number")
    .eq("id", customerId)
    .single();

  const { data: address } = await supabase
    .from("addresses")
    .select("country, company, full_name, phone, street, city, postal_code, tax_id")
    .eq("customer_id", customerId)
    .eq("kind", "shipper")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    email: user.email,
    mittente: mapToMittente((address as any) ?? null, (customer as any) ?? null),
  });
}
