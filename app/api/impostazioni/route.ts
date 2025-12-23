// app/api/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(status: number, error: string, message?: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

type CustomerRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  name?: string | null;
  phone?: string | null;
  company_name?: string | null;
  vat_number?: string | null;
};

type AddressRow = {
  id: string;
  customer_id: string;
  kind: "shipper" | "consignee" | string;
  country: string | null;
  company: string | null;
  full_name: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  tax_id: string | null;
};

function mapToMittente(address: AddressRow | null, customer: CustomerRow | null) {
  return {
    paese: address?.country ?? null,
    mittente: customer?.company_name ?? customer?.name ?? null,
    citta: address?.city ?? null,
    cap: address?.postal_code ?? null,
    indirizzo: address?.street ?? null,
    telefono: customer?.phone ?? address?.phone ?? null,
    piva: customer?.vat_number ?? address?.tax_id ?? null,
  };
}

async function getOrClaimCustomerId(userId: string, userEmail: string) {
  const db = admin();

  // A) customer by user_id
  const { data: byUser, error: byUserErr } = await db
    .from("customers")
    .select("id, user_id, email, name, phone, company_name, vat_number")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserErr) throw new Error(byUserErr.message);
  if (byUser?.id) return { customer: byUser as CustomerRow, claimed: false };

  // B) fallback per email (record creato dal backoffice con user_id NULL)
  const { data: byEmail, error: byEmailErr } = await db
    .from("customers")
    .select("id, user_id, email, name, phone, company_name, vat_number")
    .eq("email", userEmail)
    .maybeSingle();

  if (byEmailErr) throw new Error(byEmailErr.message);

  if (byEmail?.id) {
    // se email già associata ad un altro account → blocco
    if (byEmail.user_id && byEmail.user_id !== userId) {
      return { conflict: true as const };
    }

    // se user_id è NULL, aggancialo all'utente loggato
    if (!byEmail.user_id) {
      const { error: linkErr } = await db
        .from("customers")
        .update({ user_id: userId })
        .eq("id", byEmail.id);

      if (linkErr) throw new Error(linkErr.message);
    }

    return {
      customer: { ...(byEmail as any), user_id: userId } as CustomerRow,
      claimed: true,
    };
  }

  return { customer: null as any, claimed: false };
}

export async function GET() {
  const supa = supabaseServerSpst();

  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id || !user?.email) {
    return jsonError(401, "UNAUTHORIZED", "Fai login e riprova.");
  }

  const userEmail = user.email.trim().toLowerCase();

  // ✅ DB via service-role, ma email vincolata alla sessione
  let customer: CustomerRow | null = null;
  try {
    const res = await getOrClaimCustomerId(user.id, userEmail);
    if ((res as any).conflict) {
      return jsonError(
        409,
        "EMAIL_ALREADY_USED",
        "Questa email risulta già associata ad un altro account."
      );
    }
    customer = (res as any).customer ?? null;
  } catch (e: any) {
    return jsonError(500, "DB_ERROR", String(e?.message || e));
  }

  if (!customer?.id) {
    return NextResponse.json({
      ok: true,
      email: user.email,
      mittente: mapToMittente(null, null),
    });
  }

  const db = admin();

  const { data: address, error: addrErr } = await db
    .from("addresses")
    .select(
      "id, customer_id, kind, country, company, full_name, phone, street, city, postal_code, tax_id"
    )
    .eq("customer_id", customer.id)
    .eq("kind", "shipper")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (addrErr) return jsonError(500, "DB_ERROR", addrErr.message);

  return NextResponse.json({
    ok: true,
    email: user.email,
    mittente: mapToMittente((address as any) ?? null, (customer as any) ?? null),
  });
}

export async function POST(req: NextRequest) {
  const supa = supabaseServerSpst();

  const {
    data: { user },
  } = await supa.auth.getUser();

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

  const userEmail = user.email.trim().toLowerCase();
  const db = admin();

  // 1) get-or-create customer (service role) + claim by email se necessario
  let customerId: string | null = null;

  try {
    const res = await getOrClaimCustomerId(user.id, userEmail);
    if ((res as any).conflict) {
      return jsonError(
        409,
        "EMAIL_ALREADY_USED",
        "Questa email risulta già associata ad un altro account."
      );
    }
    const existing = (res as any).customer as CustomerRow | null;

    if (existing?.id) {
      customerId = existing.id;
    } else {
      // C) INSERT (email sempre da sessione)
      const { data: inserted, error: insErr } = await db
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

      if (insErr) {
        // se collisione (race) → rileggo e claim
        if ((insErr as any).code === "23505") {
          const res2 = await getOrClaimCustomerId(user.id, userEmail);
          if ((res2 as any).conflict) {
            return jsonError(
              409,
              "EMAIL_ALREADY_USED",
              "Questa email risulta già associata ad un altro account."
            );
          }
          const c2 = (res2 as any).customer as CustomerRow | null;
          customerId = c2?.id ?? null;
        } else {
          return jsonError(500, "DB_ERROR", insErr.message);
        }
      } else {
        customerId = inserted?.id || null;
      }
    }

    if (!customerId) return jsonError(500, "DB_ERROR", "Customer non creato.");

    // D) update dati base (sempre)
    const { error: updErr } = await db
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
  } catch (e: any) {
    return jsonError(500, "DB_ERROR", String(e?.message || e));
  }

  // 2) upsert address shipper (service role)
  const { data: existingAddr, error: addrErr } = await db
    .from("addresses")
    .select(
      "id, customer_id, kind, country, company, full_name, phone, street, city, postal_code, tax_id"
    )
    .eq("customer_id", customerId)
    .eq("kind", "shipper")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (addrErr) return jsonError(500, "DB_ERROR", addrErr.message);

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
    const { error: insAddrErr } = await db.from("addresses").insert(addrBase);
    if (insAddrErr) return jsonError(500, "DB_ERROR", insAddrErr.message);
  } else {
    const { error: updAddrErr } = await db
      .from("addresses")
      .update(addrBase)
      .eq("id", existingAddr.id);
    if (updAddrErr) return jsonError(500, "DB_ERROR", updAddrErr.message);
  }

  // ritorno una vista coerente
  const { data: customer, error: cErr } = await db
    .from("customers")
    .select("id, user_id, email, name, phone, company_name, vat_number")
    .eq("id", customerId)
    .single();

  if (cErr) return jsonError(500, "DB_ERROR", cErr.message);

  const { data: address, error: aErr } = await db
    .from("addresses")
    .select(
      "id, customer_id, kind, country, company, full_name, phone, street, city, postal_code, tax_id"
    )
    .eq("customer_id", customerId)
    .eq("kind", "shipper")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) return jsonError(500, "DB_ERROR", aErr.message);

  return NextResponse.json({
    ok: true,
    email: user.email,
    mittente: mapToMittente((address as any) ?? null, (customer as any) ?? null),
  });
}
