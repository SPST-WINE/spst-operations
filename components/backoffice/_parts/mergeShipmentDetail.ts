import type { PackageRow, ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";

/* ───────────────── helpers robusti per fallback da fields ───────────────── */

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

/**
 * Merge “solido”:
 * - usa i campi flat (da DTO normalizzato)
 * - se mancano, prova fallback da `fields` (extras legacy)
 * - calcola peso/colli se assenti ma ci sono packages
 */
export function mergeShipmentDetail(data: ShipmentDetailFlat): ShipmentDetailFlat {
  const fieldsAny: any = (data as any).fields || {};

  const fMitt = mapPartyFromFields(fieldsAny.mittente);
  const fDest = mapPartyFromFields(fieldsAny.destinatario);

  // fatturazione: se toggle fattSameAsDest true, prendi destinatario come fonte
  const fFattRaw =
    fieldsAny.fattSameAsDest === true ? fieldsAny.destinatario : fieldsAny.fatturazione;
  const fFatt = mapPartyFromFields(fFattRaw);

  // packages fallback da fields
  const rawPkgs =
    (Array.isArray(fieldsAny.colli) && fieldsAny.colli) ||
    (Array.isArray(fieldsAny.packages) && fieldsAny.packages) ||
    (Array.isArray(fieldsAny.parcels) && fieldsAny.parcels) ||
    null;

  const pkgsFromFields = rawPkgs ? mapColliToPackages(rawPkgs) : [];
  const effectivePackages =
    Array.isArray(data.packages) && data.packages.length ? data.packages : pkgsFromFields;

  const pesoFromPackages =
    effectivePackages.reduce(
      (sum, p) => sum + (typeof p.weight_kg === "number" ? p.weight_kg : 0),
      0
    ) || null;

  const formato = pickStr(data.formato_sped, fieldsAny.formato) || null;
  const contenuto = pickStr(data.contenuto_generale, fieldsAny.contenuto) || null;

  const giornoRitiro =
    pickStr(data.giorno_ritiro, fieldsAny.ritiroData, fieldsAny.ritiro_data) || null;

  const noteRitiro =
    pickStr(data.note_ritiro, fieldsAny.ritiroNote, fieldsAny.ritiro_note) || null;

  const destAbilitato = pickBool(data.dest_abilitato_import, fieldsAny.destAbilitato) ?? null;

  const declared =
    typeof data.declared_value === "number"
      ? data.declared_value
      : toNum(fieldsAny.insurance_value_eur) ?? toNum(fieldsAny.valoreAssicurato) ?? null;

  return {
    ...data,

    // force “riempiti”
    formato_sped: formato,
    contenuto_generale: contenuto,
    giorno_ritiro: giornoRitiro,
    note_ritiro: noteRitiro,
    dest_abilitato_import: destAbilitato,
    declared_value: declared,
    packages: effectivePackages,

    // mittente fallback
    mittente_rs: pickStr(data.mittente_rs, fMitt?.rs) || data.mittente_rs || null,
    mittente_paese: pickStr(data.mittente_paese, fMitt?.paese) || data.mittente_paese || null,
    mittente_citta: pickStr(data.mittente_citta, fMitt?.citta) || data.mittente_citta || null,
    mittente_cap: pickStr(data.mittente_cap, fMitt?.cap) || data.mittente_cap || null,
    mittente_indirizzo:
      pickStr(data.mittente_indirizzo, fMitt?.indirizzo) || data.mittente_indirizzo || null,
    mittente_telefono:
      pickStr(data.mittente_telefono, fMitt?.telefono) || data.mittente_telefono || null,
    mittente_piva: pickStr(data.mittente_piva, fMitt?.piva) || data.mittente_piva || null,

    // destinatario fallback
    dest_rs: pickStr(data.dest_rs, fDest?.rs) || data.dest_rs || null,
    dest_paese: pickStr(data.dest_paese, fDest?.paese) || data.dest_paese || null,
    dest_citta: pickStr(data.dest_citta, fDest?.citta) || data.dest_citta || null,
    dest_cap: pickStr(data.dest_cap, fDest?.cap) || data.dest_cap || null,
    dest_indirizzo:
      pickStr(data.dest_indirizzo, fDest?.indirizzo) || data.dest_indirizzo || null,
    dest_telefono:
      pickStr(data.dest_telefono, fDest?.telefono) || data.dest_telefono || null,
    dest_piva: pickStr(data.dest_piva, fDest?.piva) || data.dest_piva || null,

    // fatturazione fallback
    fatt_rs: pickStr(data.fatt_rs, fFatt?.rs) || data.fatt_rs || null,
    fatt_paese: pickStr(data.fatt_paese, fFatt?.paese) || data.fatt_paese || null,
    fatt_citta: pickStr(data.fatt_citta, fFatt?.citta) || data.fatt_citta || null,
    fatt_cap: pickStr(data.fatt_cap, fFatt?.cap) || data.fatt_cap || null,
    fatt_indirizzo:
      pickStr(data.fatt_indirizzo, fFatt?.indirizzo) || data.fatt_indirizzo || null,
    fatt_telefono:
      pickStr(data.fatt_telefono, fFatt?.telefono) || data.fatt_telefono || null,
    fatt_piva: pickStr(data.fatt_piva, fFatt?.piva) || data.fatt_piva || null,

    // colli_n fallback
    colli_n:
      typeof data.colli_n === "number"
        ? data.colli_n
        : effectivePackages.length
        ? effectivePackages.length
        : null,

    // peso_reale fallback
    peso_reale_kg:
      typeof data.peso_reale_kg === "number"
        ? data.peso_reale_kg
        : typeof pesoFromPackages === "number"
        ? pesoFromPackages
        : null,
  };
}
