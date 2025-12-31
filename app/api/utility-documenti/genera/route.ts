// app/api/utility-documenti/genera/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";
import { renderDocumentHtml } from "@/lib/docs/render";
import type { DocData } from "@/lib/docs/render/types";

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

function jsonError(status: number, code: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error: code, ...(extra ? { ...extra } : {}) },
    { status }
  );
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function buildCsv(rows: Record<string, any>[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const headers = Object.keys(rows[0] || {});
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    const needs = /[",;\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  return [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(";")),
  ].join("\n");
}

// Helper per mappare dati spedizione a DocData
function buildDocDataFromShipment(
  shipment: any,
  packages: any[],
  packingList: any[],
  docType: string,
  courier: string,
  trackingCode: string | null
): DocData {
  // Mittente (da colonne separate o JSON)
  const mittenteJson = shipment.mittente || {};
  const shipper: DocData["parties"]["shipper"] = {
    name: shipment.mittente_rs || mittenteJson.rs || null,
    contact: shipment.mittente_referente || mittenteJson.referente || null,
    address: {
      line1: shipment.mittente_indirizzo || mittenteJson.indirizzo || null,
      city: shipment.mittente_citta || mittenteJson.citta || null,
      postalCode: shipment.mittente_cap || mittenteJson.cap || null,
      country: shipment.mittente_paese || mittenteJson.paese || null,
    },
    vatNumber: shipment.mittente_piva || mittenteJson.piva || null,
    phone: shipment.mittente_telefono || mittenteJson.telefono || null,
  };

  // Destinatario
  const destinatarioJson = shipment.destinatario || {};
  const consignee: DocData["parties"]["consignee"] = {
    name: shipment.dest_rs || destinatarioJson.rs || null,
    contact: shipment.dest_referente || destinatarioJson.referente || null,
    address: {
      line1: shipment.dest_indirizzo || destinatarioJson.indirizzo || null,
      city: shipment.dest_citta || destinatarioJson.citta || null,
      postalCode: shipment.dest_cap || destinatarioJson.cap || null,
      country: shipment.dest_paese || destinatarioJson.paese || null,
    },
    vatNumber: shipment.dest_piva || destinatarioJson.piva || null,
    phone: shipment.dest_telefono || destinatarioJson.telefono || null,
  };

  // Fatturazione (con fallback a destinatario se dati mancanti)
  const fatturazioneJson = shipment.fatturazione || {};
  const billTo: DocData["parties"]["billTo"] = {
    name: shipment.fatt_rs || fatturazioneJson.rs || consignee.name || null,
    contact: shipment.fatt_referente || fatturazioneJson.referente || consignee.contact || null,
    address: {
      line1: shipment.fatt_indirizzo || fatturazioneJson.indirizzo || consignee.address.line1 || null,
      city: shipment.fatt_citta || fatturazioneJson.citta || consignee.address.city || null,
      postalCode: shipment.fatt_cap || fatturazioneJson.cap || consignee.address.postalCode || null,
      country: shipment.fatt_paese || fatturazioneJson.paese || consignee.address.country || null,
    },
    vatNumber: shipment.fatt_piva || fatturazioneJson.piva || consignee.vatNumber || null,
    phone: shipment.fatt_telefono || fatturazioneJson.telefono || consignee.phone || null,
  };

  // Items da packing list o packages
  const items: DocData["items"] = [];
  
  // Priorità: 1) packingList passato come parametro, 2) shipment.fields (con tutte le varianti), 3) packages
  let plToUse: any[] = [];
  
  if (Array.isArray(packingList) && packingList.length > 0) {
    // Usa packingList passato come parametro (da shipment_pl_lines o fields)
    plToUse = packingList;
    console.log("[buildDocDataFromShipment] using packingList from parameter:", packingList.length, "items");
  } else {
    // Prova da fields seguendo la logica di PackingListSection.tsx
    const fieldsAny: any = shipment.fields || {};
    const rawPL = fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl || null;
    
    // Può essere un oggetto con proprietà rows oppure un array diretto
    if (rawPL) {
      if (Array.isArray(rawPL?.rows)) {
        plToUse = rawPL.rows;
        console.log("[buildDocDataFromShipment] using packingList from fields (object with rows):", plToUse.length, "items");
      } else if (Array.isArray(rawPL)) {
        plToUse = rawPL;
        console.log("[buildDocDataFromShipment] using packingList from fields (direct array):", plToUse.length, "items");
      }
    }
  }
  
  if (plToUse.length > 0) {
    // Usa packing list
    for (const pl of plToUse) {
      const bottles = toNum(pl.bottiglie ?? pl.qty ?? pl.quantita ?? pl.bottles) ?? 0;
      const formatLiters = toNum(pl.formato_litri ?? pl.volume_litri ?? pl.volumePerBottleL) ?? null;
      const totalVolume = bottles && formatLiters ? bottles * formatLiters : null;
      
      items.push({
        description: pl.etichetta || pl.label || pl.nome || pl.description || "Voce packing list",
        bottles,
        volumePerBottleL: formatLiters,
        totalVolumeL: totalVolume,
        unitPrice: toNum(pl.prezzo ?? pl.unit_price ?? pl.unitPrice),
        currency: pl.valuta || pl.currency || shipment.fatt_valuta || "EUR",
        lineTotal: toNum(pl.prezzo ?? pl.unit_price ?? pl.unitPrice) && bottles
          ? round2((toNum(pl.prezzo ?? pl.unit_price ?? pl.unitPrice) ?? 0) * bottles)
          : null,
        itemType: pl.tipologia || pl.item_type || pl.itemType || null,
        alcoholPercent: toNum(pl.gradazione ?? pl.alcol ?? pl.alcohol_percent ?? pl.alcoholPercent),
      });
    }
  } else if (packages.length > 0) {
    // Fallback: usa packages
    console.log("[buildDocDataFromShipment] using packages as fallback:", packages.length, "packages");
    for (const pkg of packages) {
      items.push({
        description: pkg.contenuto || shipment.contenuto_generale || "Collo",
        bottles: null,
        volumePerBottleL: null,
        totalVolumeL: null,
        unitPrice: null,
        currency: shipment.fatt_valuta || "EUR",
        lineTotal: null,
        itemType: null,
        alcoholPercent: null,
      });
    }
  } else {
    // Nessun dato disponibile, crea almeno un item vuoto
    console.warn("[buildDocDataFromShipment] no packing list or packages, creating empty item");
    items.push({
      description: shipment.contenuto_generale || "Merce",
      bottles: null,
      volumePerBottleL: null,
      totalVolumeL: null,
      unitPrice: null,
      currency: shipment.fatt_valuta || "EUR",
      lineTotal: null,
      itemType: null,
      alcoholPercent: null,
    });
  }

  // Totals
  const totalBottles = items.reduce((sum, it) => sum + (it.bottles || 0), 0);
  const totalVolumeL = items.reduce((sum, it) => {
    const vol = it.totalVolumeL ?? (it.bottles && it.volumePerBottleL ? it.bottles * it.volumePerBottleL : null);
    return sum + (vol ?? 0);
  }, 0);
  const totalValue = items.reduce((sum, it) => sum + (it.lineTotal ?? 0), 0);

  // Data documento (oggi se non specificata)
  const today = new Date().toISOString().split("T")[0];
  const docDate = shipment.giorno_ritiro 
    ? new Date(shipment.giorno_ritiro).toISOString().split("T")[0]
    : today;

  // Numero documento (usa human_id come base)
  const docNumber = shipment.human_id || `DOC-${Date.now()}`;

  return {
    meta: {
      docType,
      docNumber,
      docDate,
      humanId: shipment.human_id || null,
      courier: courier || "",
      trackingCode: trackingCode || null,
      incoterm: shipment.incoterm || null,
      valuta: shipment.fatt_valuta || "EUR",
    },
    parties: {
      shipper,
      consignee,
      billTo,
    },
    shipment: {
      totalPackages: shipment.colli_n ?? packages.length,
      totalGrossWeightKg: toNum(shipment.peso_reale_kg),
      contentSummary: shipment.contenuto_generale || null,
      pickupDate: shipment.giorno_ritiro 
        ? new Date(shipment.giorno_ritiro).toISOString().split("T")[0]
        : null,
    },
    items,
    totals: {
      totalBottles,
      totalVolumeL: totalVolumeL > 0 ? round2(totalVolumeL) : null,
      totalValue: totalValue > 0 ? round2(totalValue) : null,
      currency: shipment.fatt_valuta || "EUR",
    },
  };
}

export async function POST(req: Request) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  try {
    const body = await req.json().catch(() => ({}));
    
    // Se viene passato doc_data, usalo direttamente per il rendering
    if (body.doc_data) {
      const docData = body.doc_data as DocData;
      const html = renderDocumentHtml(docData);
      return NextResponse.json({
        ok: true,
        doc: docData,
        html,
      });
    }

    // Altrimenti, costruisci DocData dalla spedizione
    const humanId = body?.human_id;
    const shipmentId = body?.shipment_id || body?.shipmentId || body?.id;
    const docType = body?.doc_type || body?.docType || "fattura_proforma";
    const courier = body?.courier || "";
    const trackingCode = body?.tracking_code || body?.trackingCode || null;
    const format = (body?.format || body?.type || "JSON").toString().toUpperCase();

    if (!shipmentId && !humanId) {
      return jsonError(400, "VALIDATION_ERROR", {
        details: "shipment_id or human_id required",
      });
    }

    const supabase = admin();

    // Cerca spedizione per ID o human_id
    // Usa select("*") per evitare errori su campi che potrebbero non esistere
    let query = supabase.schema("spst").from("shipments").select("*");

    if (humanId) {
      query = query.eq("human_id", humanId);
    } else {
      query = query.eq("id", shipmentId);
    }

    const { data: shipment, error: shipErr } = await query.single();

    if (shipErr) {
      if ((shipErr as any).code === "PGRST116") return jsonError(404, "NOT_FOUND");
      console.error("[utility-documenti/genera] shipment DB_ERROR", shipErr);
      console.error("[utility-documenti/genera] error details:", JSON.stringify(shipErr, null, 2));
      return jsonError(500, "DB_ERROR", { 
        details: shipErr.message,
        code: (shipErr as any).code,
        hint: (shipErr as any).hint,
      });
    }
    if (!shipment) return jsonError(404, "NOT_FOUND");

    const actualShipmentId = shipment.id as string;

    // Leggi packages
    const { data: packages, error: pkgErr } = await supabase
      .schema("spst")
      .from("packages")
      .select("id,shipment_id,contenuto,weight_kg,length_cm,width_cm,height_cm,created_at")
      .eq("shipment_id", actualShipmentId)
      .order("created_at", { ascending: true });

    if (pkgErr) {
      console.error("[utility-documenti/genera] packages DB_ERROR", pkgErr);
      // Non bloccante, continua senza packages
    }

    const pkgs = Array.isArray(packages) ? packages : [];

    // Packing list da shipment_pl_lines o fields (seguendo logica PackingListSection.tsx)
    let packingList: any[] = [];
    
    // Prova da shipment_pl_lines (tabella potrebbe non esistere, quindi gestiamo l'errore)
    try {
      const { data: plLines, error: plErr } = await supabase
        .schema("spst")
        .from("shipment_pl_lines")
        .select("*")
        .eq("shipment_id", actualShipmentId);

      if (!plErr && Array.isArray(plLines) && plLines.length > 0) {
        packingList = plLines;
        console.log("[utility-documenti/genera] found packing list from shipment_pl_lines:", plLines.length, "items");
      }
    } catch (e) {
      console.warn("[utility-documenti/genera] shipment_pl_lines not available");
    }
    
    // Se non trovato in shipment_pl_lines, prova da fields (come PackingListSection.tsx)
    if (packingList.length === 0 && shipment.fields) {
      const fieldsAny: any = shipment.fields;
      const rawPL = fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl || null;
      
      if (rawPL) {
        // Può essere un oggetto con proprietà rows oppure un array diretto
        if (Array.isArray(rawPL?.rows)) {
          packingList = rawPL.rows;
          console.log("[utility-documenti/genera] found packing list from fields (object with rows):", packingList.length, "items");
        } else if (Array.isArray(rawPL)) {
          packingList = rawPL;
          console.log("[utility-documenti/genera] found packing list from fields (direct array):", packingList.length, "items");
        } else {
          console.log("[utility-documenti/genera] fields packing list found but not in expected format:", typeof rawPL);
        }
      }
    }
    
    if (packingList.length === 0) {
      console.log("[utility-documenti/genera] no packing list found, will use packages or create empty item");
      // Debug: log struttura fields se presente
      if (shipment.fields) {
        console.log("[utility-documenti/genera] shipment.fields keys:", Object.keys(shipment.fields));
        const fieldsAny: any = shipment.fields;
        if (fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl) {
          console.log("[utility-documenti/genera] raw packing list structure:", JSON.stringify(fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl, null, 2));
        }
      }
    }

    // Costruisci DocData
    const docData = buildDocDataFromShipment(
      shipment,
      pkgs,
      packingList,
      docType,
      courier,
      trackingCode
    );

    // Genera HTML
    const html = renderDocumentHtml(docData);

    // Se richiesto CSV, restituisci packing list come CSV
    if (format === "CSV") {
      const rows = pkgs.map((p: any, idx: number) => ({
        n: idx + 1,
        package_id: p.id,
        descrizione: p.contenuto || shipment.contenuto_generale || "Collo",
        qta: 1,
        peso_reale_kg: toNum(p.weight_kg) || 0,
        lato1_cm: toNum(p.length_cm) || 0,
        lato2_cm: toNum(p.width_cm) || 0,
        lato3_cm: toNum(p.height_cm) || 0,
      }));
      const csv = buildCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="packing-list-${shipment.human_id || actualShipmentId}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      doc: docData,
      html,
    });
  } catch (e: any) {
    console.error("[utility-documenti/genera] UNEXPECTED", e);
    return jsonError(500, "UNEXPECTED", { details: String(e?.message || e) });
  }
}
