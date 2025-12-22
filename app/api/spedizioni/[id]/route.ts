// app/api/spedizioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

async function isStaff(): Promise<boolean> {
  const supa = supabaseServerSpst();
  const { data } = await supa.auth.getUser();
  const user = data?.user;
  if (!user?.id || !user?.email) return false;
  const email = user.email.toLowerCase().trim();
  if (email === "info@spst.it") return true;

  const { data: staff } = await supa
    .from("staff_users")
    .select("role, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const enabled =
    typeof (staff as any)?.enabled === "boolean" ? (staff as any).enabled : true;

  const role = String((staff as any)?.role || "").toLowerCase().trim();
  return enabled && (role === "admin" || role === "staff" || role === "operator");
}

// Normalizza un attachment che può essere string (url puro) o json
function wrapFile(raw: any) {
  if (!raw) return null;
  if (typeof raw === "string") return { url: raw as string };
  if (typeof raw === "object") {
    const obj = raw as any;
    return {
      url: obj.url || obj.path || "",
      file_name: obj.file_name || obj.name || obj.filename || null,
      mime_type: obj.mime_type || obj.content_type || obj.mime || null,
      size: obj.size || null,
      updated_at: obj.updated_at || obj.updatedAt || null,
      ...obj,
    };
  }
  return null;
}

/* ─────────────────────────────
   Helpers fallback + packages
   ───────────────────────────── */

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pickStr = (...vals: any[]): string | null => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
};

const pickBool = (...vals: any[]): boolean | null => {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
  }
  return null;
};

const mapPartyFromFields = (obj: any) => {
  if (!obj || typeof obj !== "object") return null;
  return {
    rs: pickStr(obj.ragioneSociale, obj.rs, obj.nome, obj.company),
    paese: pickStr(obj.paese, obj.country),
    citta: pickStr(obj.citta, obj.city),
    cap: pickStr(obj.cap, obj.zip, obj.postcode),
    indirizzo: pickStr(obj.indirizzo, obj.address, obj.street),
    telefono: pickStr(obj.telefono, obj.phone),
    piva: pickStr(obj.piva, obj.vat, obj.taxid, obj.tax_id),
  };
};

type PackageRow = {
  id?: string;
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  weight_kg?: number | null;
};

const mapColliToPackages = (arr: any[]): PackageRow[] => {
  return arr
    .map((x: any, idx: number) => {
      if (!x || typeof x !== "object") return null;

      const l1 =
        toNum(x.l1) ??
        toNum(x.length_cm) ??
        toNum(x.lunghezza_cm) ??
        toNum(x.lato1) ??
        toNum(x.L1) ??
        null;

      const l2 =
        toNum(x.l2) ??
        toNum(x.width_cm) ??
        toNum(x.larghezza_cm) ??
        toNum(x.lato2) ??
        toNum(x.L2) ??
        null;

      const l3 =
        toNum(x.l3) ??
        toNum(x.height_cm) ??
        toNum(x.altezza_cm) ??
        toNum(x.lato3) ??
        toNum(x.L3) ??
        null;

      const w =
        toNum(x.weight_kg) ??
        toNum(x.peso_kg) ??
        toNum(x.peso) ??
        toNum(x.weight) ??
        null;

      if (l1 === null && l2 === null && l3 === null && w === null) return null;

      return { id: x.id ?? String(idx), l1, l2, l3, weight_kg: w } as PackageRow;
    })
    .filter(Boolean) as PackageRow[];
};

function normalizeShipmentRow(row: any) {
  const fieldsAny: any = row?.fields || {};

  // ✅ attachments: manteniamo anche flat, ma aggiungiamo l'oggetto che il client usa
  const attachments = {
    ldv: wrapFile(row.ldv),
    fattura_proforma: wrapFile(row.fattura_proforma),
    fattura_commerciale: wrapFile(row.fattura_commerciale),
    dle: wrapFile(row.dle),
    allegato1: wrapFile(row.allegato1),
    allegato2: wrapFile(row.allegato2),
    allegato3: wrapFile(row.allegato3),
    allegato4: wrapFile(row.allegato4),
  };

  row.ldv = attachments.ldv;
  row.fattura_proforma = attachments.fattura_proforma;
  row.fattura_commerciale = attachments.fattura_commerciale;
  row.dle = attachments.dle;
  row.allegato1 = attachments.allegato1;
  row.allegato2 = attachments.allegato2;
  row.allegato3 = attachments.allegato3;
  row.allegato4 = attachments.allegato4;

  row.attachments = attachments;

  // parties fallback
  const fMitt = mapPartyFromFields(fieldsAny.mittente);
  const fDest = mapPartyFromFields(fieldsAny.destinatario);
  const fFattRaw =
    fieldsAny.fattSameAsDest === true ? fieldsAny.destinatario : fieldsAny.fatturazione;
  const fFatt = mapPartyFromFields(fFattRaw);

  // packages fallback
  const rawPkgs =
    (Array.isArray(fieldsAny.colli) && fieldsAny.colli) ||
    (Array.isArray(fieldsAny.packages) && fieldsAny.packages) ||
    (Array.isArray(fieldsAny.parcels) && fieldsAny.parcels) ||
    null;

  const pkgsFromFields = rawPkgs ? mapColliToPackages(rawPkgs) : [];
  const effectivePackages =
    Array.isArray(row.packages) && row.packages.length ? row.packages : pkgsFromFields;

  // peso da packages se manca
  const pesoFromPackages =
    effectivePackages.reduce(
      (sum: number, p: any) => sum + (typeof p?.weight_kg === "number" ? p.weight_kg : 0),
      0
    ) || null;

  row.packages = effectivePackages;

  // fallback testo
  row.formato_sped = pickStr(row.formato_sped, fieldsAny.formato) || row.formato_sped || null;
  row.contenuto_generale =
    pickStr(row.contenuto_generale, fieldsAny.contenuto) || row.contenuto_generale || null;

  row.giorno_ritiro =
    pickStr(row.giorno_ritiro, fieldsAny.ritiroData, fieldsAny.ritiro_data) ||
    row.giorno_ritiro ||
    null;

  row.note_ritiro =
    pickStr(row.note_ritiro, fieldsAny.ritiroNote, fieldsAny.ritiro_note) ||
    row.note_ritiro ||
    null;

  row.dest_abilitato_import =
    pickBool(row.dest_abilitato_import, fieldsAny.destAbilitato) ?? row.dest_abilitato_import ?? null;

  // declared value fallback
  row.declared_value =
    typeof row.declared_value === "number"
      ? row.declared_value
      : toNum(fieldsAny.insurance_value_eur) ??
        toNum(fieldsAny.valoreAssicurato) ??
        null;

  // mittente fallback
  row.mittente_rs = pickStr(row.mittente_rs, fMitt?.rs) || row.mittente_rs || null;
  row.mittente_paese = pickStr(row.mittente_paese, fMitt?.paese) || row.mittente_paese || null;
  row.mittente_citta = pickStr(row.mittente_citta, fMitt?.citta) || row.mittente_citta || null;
  row.mittente_cap = pickStr(row.mittente_cap, fMitt?.cap) || row.mittente_cap || null;
  row.mittente_indirizzo =
    pickStr(row.mittente_indirizzo, fMitt?.indirizzo) || row.mittente_indirizzo || null;
  row.mittente_telefono =
    pickStr(row.mittente_telefono, fMitt?.telefono) || row.mittente_telefono || null;
  row.mittente_piva = pickStr(row.mittente_piva, fMitt?.piva) || row.mittente_piva || null;

  // destinatario fallback
  row.dest_rs = pickStr(row.dest_rs, fDest?.rs) || row.dest_rs || null;
  row.dest_paese = pickStr(row.dest_paese, fDest?.paese) || row.dest_paese || null;
  row.dest_citta = pickStr(row.dest_citta, fDest?.citta) || row.dest_citta || null;
  row.dest_cap = pickStr(row.dest_cap, fDest?.cap) || row.dest_cap || null;
  row.dest_indirizzo =
    pickStr(row.dest_indirizzo, fDest?.indirizzo) || row.dest_indirizzo || null;
  row.dest_telefono = pickStr(row.dest_telefono, fDest?.telefono) || row.dest_telefono || null;
  row.dest_piva = pickStr(row.dest_piva, fDest?.piva) || row.dest_piva || null;

  // fatturazione fallback
  row.fatt_rs = pickStr(row.fatt_rs, fFatt?.rs) || row.fatt_rs || null;
  row.fatt_paese = pickStr(row.fatt_paese, fFatt?.paese) || row.fatt_paese || null;
  row.fatt_citta = pickStr(row.fatt_citta, fFatt?.citta) || row.fatt_citta || null;
  row.fatt_cap = pickStr(row.fatt_cap, fFatt?.cap) || row.fatt_cap || null;
  row.fatt_indirizzo =
    pickStr(row.fatt_indirizzo, fFatt?.indirizzo) || row.fatt_indirizzo || null;
  row.fatt_telefono =
    pickStr(row.fatt_telefono, fFatt?.telefono) || row.fatt_telefono || null;
  row.fatt_piva = pickStr(row.fatt_piva, fFatt?.piva) || row.fatt_piva || null;

  // colli & peso fallback
  row.colli_n =
    typeof row.colli_n === "number"
      ? row.colli_n
      : effectivePackages.length
      ? effectivePackages.length
      : null;

  row.peso_reale_kg =
    typeof row.peso_reale_kg === "number"
      ? row.peso_reale_kg
      : typeof pesoFromPackages === "number"
      ? pesoFromPackages
      : null;

  return row;
}

const SHIPMENT_SELECT = `
  id,created_at,human_id,
  email_cliente,email_norm,
  status,carrier,tracking_code,declared_value,
  tipo_spedizione,incoterm,giorno_ritiro,note_ritiro,
  mittente_rs,mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,mittente_telefono,mittente_piva,
  dest_rs,dest_paese,dest_citta,dest_cap,dest_indirizzo,dest_telefono,dest_piva,dest_abilitato_import,
  fatt_rs,fatt_paese,fatt_citta,fatt_cap,fatt_indirizzo,fatt_telefono,fatt_piva,fatt_valuta,
  colli_n,peso_reale_kg,formato_sped,contenuto_generale,
  ldv,fattura_proforma,fattura_commerciale,dle,allegato1,allegato2,allegato3,allegato4,
  fields
`;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID spedizione mancante" }, { status: 400 });
  }

  // deve essere loggato (client o staff)
  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    if (staff) {
      const supaAdmin = admin();
      const { data, error } = await supaAdmin
        .schema("spst")
        .from("shipments")
        .select(SHIPMENT_SELECT)
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const row: any = data || null;
      if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

      const normalized = normalizeShipmentRow(row);
      return NextResponse.json({ ok: true, shipment: normalized, scope: "staff" });
    }

    // client: RLS
    const { data, error } = await supa
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .eq("id", id)
      .single();

    if (error) {
      // se non è owner, RLS spesso produce "no rows"
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const row: any = data || null;
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const normalized = normalizeShipmentRow(row);
    return NextResponse.json({ ok: true, shipment: normalized, scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // staff-only
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID spedizione mancante" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({} as any));

  try {
    const supaAdmin = admin();
    const { data, error } = await supaAdmin
      .schema("spst")
      .from("shipments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // opzionale: normalizza anche la risposta PATCH (così il client è sempre coerente)
    const normalized = normalizeShipmentRow(data);
    return NextResponse.json({ ok: true, shipment: normalized });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
