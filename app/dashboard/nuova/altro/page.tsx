// app/dashboard/nuova/altro/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import FatturaCard from "@/components/nuova/FatturaCard";
import { Select } from "@/components/nuova/Field";

import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------
// Costanti / tipi
// ------------------------------------------------------------
type SuccessInfo = {
  recId: string;
  idSped: string;
  tipoSped: "B2B" | "B2C" | "Sample";
  incoterm: "DAP" | "DDP" | "EXW";
  dataRitiro?: string;
  colli: number;
  formato: "Pacco" | "Pallet";
  destinatario: Party;
};

type Suggestion = { id: string; main: string; secondary?: string };

const GMAPS_LANG = process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE || "it";
const GMAPS_REGION = process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION || "IT";

const blankParty: Party = {
  ragioneSociale: "",
  referente: "",
  paese: "",
  citta: "",
  cap: "",
  indirizzo: "",
  telefono: "",
  piva: "",
};

// Logger
const log = {
  info: (...a: any[]) => console.log("%c[AC]", "color:#1c3e5e", ...a),
  warn: (...a: any[]) => console.warn("[AC]", ...a),
  error: (...a: any[]) => console.error("[AC]", ...a),
  group: (label: string) => console.groupCollapsed(`%c${label}`, "color:#555"),
  groupEnd: () => console.groupEnd(),
};

// ------------------------------------------------------------
// Proxy Places autocomplete + parsing
// ------------------------------------------------------------
async function fetchSuggestions(input: string, sessionToken: string) {
  const res = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      languageCode: GMAPS_LANG,
      sessionToken,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) return [];
  const arr = j?.suggestions || [];
  return arr
    .map((s: any) => {
      const pred = s.placePrediction || {};
      const fmt = pred.structuredFormat || {};
      return {
        id: pred.placeId,
        main: fmt?.mainText?.text || "",
        secondary: fmt?.secondaryText?.text || "",
      };
    })
    .filter((s: any) => !!s.id);
}

async function fetchPlaceDetails(placeId: string, sessionToken?: string) {
  const params = new URLSearchParams({
    placeId,
    languageCode: GMAPS_LANG,
    regionCode: GMAPS_REGION,
  });
  if (sessionToken) params.set("sessionToken", sessionToken);
  const res = await fetch(`/api/places/details?${params.toString()}`);
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.error) return null;
  return j;
}

async function fetchPostalCodeByLatLng(lat: number, lng: number, lang = "it") {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    language: lang,
  });
  const res = await fetch(`/api/geo/reverse?${params.toString()}`);
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) return "";
  const search = (arr: any[]) => {
    for (const r of arr || []) {
      const c = (r.address_components || []).find(
        (x: any) => x.types?.includes("postal_code")
      );
      if (c) return c.long_name || c.short_name || "";
    }
    return "";
  };
  return search(j.results) || "";
}

function parseAddressFromDetails(d: any) {
  const comps: any[] = d?.addressComponents || [];
  const get = (type: string) =>
    comps.find((c) => c.types?.includes(type)) || null;

  const country = get("country");
  const locality = get("locality") || get("postal_town");
  const admin2 = get("administrative_area_level_2");
  const admin1 = get("administrative_area_level_1");
  const postal = get("postal_code");
  const route = get("route");
  const streetNr = get("street_number");
  const premise = get("premise");

  const countryName =
    country?.longText ||
    country?.long_name ||
    country?.name ||
    country?.shortText ||
    "";

  const line = [
    route?.shortText || route?.longText || route?.short_name || route?.long_name,
    streetNr?.shortText ||
      streetNr?.longText ||
      streetNr?.short_name ||
      streetNr?.long_name,
    premise?.longText || premise?.long_name,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    indirizzo: line || d?.formattedAddress || "",
    citta:
      locality?.longText ||
      locality?.long_name ||
      admin2?.longText ||
      admin1?.longText ||
      "",
    cap:
      postal?.shortText ||
      postal?.longText ||
      postal?.short_name ||
      postal?.long_name ||
      "",
    paese: countryName || "",
  };
}

function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ------------------------------------------------------------
// Creazione spedizione con Supabase Auth
// ------------------------------------------------------------
async function createShipmentWithAuth(payload: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const email = user?.email ?? null;
  const token = session?.access_token ?? null;

  const res = await fetch("/api/spedizioni", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-user-email": email || "",
    },
    body: JSON.stringify({ ...payload, email }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.ok) {
    throw new Error(body?.details || body?.error || "Errore creazione spedizione");
  }
  return body.shipment;
}

// ------------------------------------------------------------
// UPLOAD UNIVERSALE → fattura commerciale
// ------------------------------------------------------------
async function uploadShipmentDocument(
  shipmentId: string,
  file: File,
  docType: "fattura_commerciale"
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const safeName = file.name.replace(/\s+/g, "-");
  const path = `${shipmentId}/${docType}/${Date.now()}-${safeName}`;

  // Upload
  const { error: uploadErr } = await supabase.storage
    .from("shipment-docs")
    .upload(path, file, { upsert: true });

  if (uploadErr) throw new Error("Errore upload file");

  // Public URL
  const { data: urlData } = await supabase.storage
    .from("shipment-docs")
    .getPublicUrl(path);

  const url = urlData?.publicUrl || null;


  // Insert DB
  const { error: dbErr } = await supabase.from("shipment_documents").insert({
    shipment_id: shipmentId,
    doc_type: docType,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    storage_path: path,
    storage_bucket: "shipment-docs",
    url,
  });

  if (dbErr) throw new Error("Errore salvataggio documento");

  return { url };
}

// ------------------------------------------------------------
// COMPONENTE PAGINA
// ------------------------------------------------------------
export default function NuovaAltroPage() {
  const router = useRouter();

  // Stato base
  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2B");
  const [destAbilitato, setDestAbilitato] = useState(false);

  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // PREFILL MITTENTE — identico alla pagina VINO
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email || "info@spst.it";

        const res = await fetch(
          `/api/impostazioni?email=${encodeURIComponent(email)}`,
          {
            cache: "no-store",
            headers: { "x-spst-email": email },
          }
        );

        const json = await res.json().catch(() => null);
        if (!json?.ok || cancelled) return;

        const m = json.mittente;
        if (!m) return;

        setMittente((prev) => ({
          ...prev,
          ragioneSociale: m.mittente || prev.ragioneSociale,
          indirizzo: m.indirizzo || prev.indirizzo,
          cap: m.cap || prev.cap,
          citta: m.citta || prev.citta,
          paese: m.paese || prev.paese,
          telefono: m.telefono || prev.telefono,
          piva: m.piva || prev.piva,
        }));
      } catch (e) {
        console.error("[nuova/altro] prefill mittente errore", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Colli
  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState("");

  // Ritiro
  const [ritiroData, setRitiroData] = useState<Date | undefined>();
  const [ritiroNote, setRitiroNote] = useState("");

  // Fattura
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [noteFatt, setNoteFatt] = useState("");

  const [delega, setDelega] = useState(false);
  const [fatturazione, setFatturazione] = useState<Party>(blankParty);
  const [sameAsDest, setSameAsDest] = useState(false);

  const [fatturaFile, setFatturaFile] = useState<File | undefined>();

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [errors.length]);

  // ------------------------------------------------------------
  // Validazione
  // ------------------------------------------------------------
  function validate(): string[] {
    const errs: string[] = [];

    if (!mittente.piva?.trim()) errs.push("Partita IVA del mittente mancante.");

    colli.forEach((c, i) => {
      if (
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null ||
        c.lunghezza_cm <= 0 ||
        c.larghezza_cm <= 0 ||
        c.altezza_cm <= 0 ||
        c.peso_kg <= 0
      ) {
        errs.push(`Collo #${i + 1}: misure o peso mancanti/non validi.`);
      }
    });

    if (!ritiroData) errs.push("Giorno ritiro mancante.");

    const fatt = sameAsDest ? destinatario : fatturazione;
    if (!fatturaFile) {
      if (!fatt.ragioneSociale?.trim())
        errs.push("Ragione sociale fattura mancante.");
      if ((tipoSped === "B2B" || tipoSped === "Sample") && !fatt.piva?.trim())
        errs.push("PIVA obbligatoria per B2B/Sample.");
    }

    return errs;
  }

  // ------------------------------------------------------------
  // SALVATAGGIO (identico a pagina vino)
  // ------------------------------------------------------------
  const salva = async () => {
    if (saving) return;

    const v = validate();
    if (v.length) {
      setErrors(v);
      return;
    }
    setErrors([]);

    setSaving(true);

    try {
      const payload = {
        sorgente: "altro" as const,
        tipoSped,
        destAbilitato,
        contenuto,
        formato,
        ritiroData: ritiroData ? ritiroData.toISOString() : null,
        ritiroNote,
        mittente,
        destinatario,
        incoterm,
        valuta,
        noteFatt,
        fatturazione: sameAsDest ? destinatario : fatturazione,
        fattSameAsDest: sameAsDest,
        fattDelega: delega,
        fatturaFileName: fatturaFile?.name || null,
        colli,
      };

      // 1. Creazione spedizione
      const created = await createShipmentWithAuth(payload);
      const shipmentId = created?.id;

      // 2. Upload fattura commerciale
      if (shipmentId && fatturaFile) {
        await uploadShipmentDocument(shipmentId, fatturaFile, "fattura_commerciale");
      }

      // 3. Successo
      const id =
        created?.human_id || created?.id || created?.recId || "SPEDIZIONE";

      setSuccess({
        recId: id,
        idSped: id,
        tipoSped,
        incoterm,
        dataRitiro: ritiroData?.toLocaleDateString(),
        colli: colli.length,
        formato,
        destinatario,
      });

      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } catch (e: any) {
      setErrors([e?.message || "Errore salvataggio."]);
      console.error("Errore salvataggio spedizione (altro)", e);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------
  // Autocomplete agganciato agli input di PartyCard
  // ------------------------------------------------------------
  const attachPlacesToInput = useCallback(
    (input: HTMLInputElement, who: "mittente" | "destinatario") => {
      if (!input || (input as any).__acAttached) return;
      (input as any).__acAttached = true;

      let session = newSessionToken();
      let items: Suggestion[] = [];
      let open = false;
      let activeIndex = -1;

      const dd = document.createElement("div");
      dd.className = "spst-ac-dd";
      dd.style.cssText = [
        "position:absolute",
        "z-index:9999",
        "background:#fff",
        "border:1px solid #e2e8f0",
        "border-radius:10px",
        "box-shadow:0 8px 24px rgba(0,0,0,0.08)",
        "padding:6px",
        "display:none",
      ].join(";");

      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.margin = "0";
      ul.style.padding = "0";
      ul.style.maxHeight = "260px";
      ul.style.overflowY = "auto";

      dd.appendChild(ul);
      document.body.appendChild(dd);

      const positionDD = () => {
        const r = input.getBoundingClientRect();
        dd.style.left = `${r.left + window.scrollX}px`;
        dd.style.top = `${r.bottom + 6 + window.scrollY}px`;
        dd.style.width = `${r.width}px`;
      };

      const close = () => {
        dd.style.display = "none";
        open = false;
        activeIndex = -1;
        ul.innerHTML = "";
      };

      const render = () => {
        ul.innerHTML = "";
        if (!items.length) {
          const li = document.createElement("li");
          li.textContent = "Nessun suggerimento";
          li.style.padding = "8px 10px";
          li.style.color = "#8a8a8a";
          ul.appendChild(li);
          return;
        }
        items.forEach((s, i) => {
          const li = document.createElement("li");
          li.style.padding = "8px 10px";
          li.style.borderRadius = "8px";
          li.style.cursor = "pointer";

          li.onmouseenter = () => {
            activeIndex = i;
            highlight();
          };
          li.onclick = () => choose(i);

          const main = document.createElement("div");
          main.textContent = s.main;
          main.style.fontWeight = "600";
          main.style.fontSize = "13px";

          const sec = document.createElement("div");
          sec.textContent = s.secondary || "";
          sec.style.fontSize = "12px";
          sec.style.color = "#6b7280";

          li.append(main, sec);
          ul.appendChild(li);
        });
      };

      const highlight = () => {
        Array.from(ul.children).forEach((el, i) => {
          (el as HTMLElement).style.background =
            i === activeIndex ? "#f1f5f9" : "transparent";
        });
      };

      const openMenu = () => {
        positionDD();
        dd.style.display = "block";
        open = true;
        highlight();
      };

      const choose = async (idx: number) => {
        const sel = items[idx];
        if (!sel) return;
        close();

        input.value =
          sel.main + (sel.secondary ? `, ${sel.secondary}` : "");

        const details = await fetchPlaceDetails(sel.id, session);
        session = newSessionToken();
        if (!details) return;

        const addr = parseAddressFromDetails(details);
        const lat = (details as any)?.location?.latitude;
        const lng = (details as any)?.location?.longitude;

        if (!addr.cap && typeof lat === "number" && typeof lng === "number") {
          const cap = await fetchPostalCodeByLatLng(lat, lng, GMAPS_LANG);
          if (cap) addr.cap = cap;
        }

        if (who === "mittente") {
          setMittente((prev) => ({ ...prev, ...addr }));
        } else {
          setDestinatario((prev) => ({ ...prev, ...addr }));
        }
      };

      const onInput = async () => {
        const q = input.value.trim();
        if (q.length < 3) {
          close();
          return;
        }
        log.group("Autocomplete → request");
        log.info("query:", q);
        items = await fetchSuggestions(q, session);
        log.groupEnd();
        render();
        openMenu();
      };

      const onKey = (e: KeyboardEvent) => {
        if (!open) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, items.length - 1);
          highlight();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          highlight();
        } else if (e.key === "Enter" && activeIndex >= 0) {
          e.preventDefault();
          choose(activeIndex);
        } else if (e.key === "Escape") {
          close();
        }
      };

      const onBlur = () => {
        setTimeout(() => {
          if (!dd.contains(document.activeElement)) close();
        }, 120);
      };

      const onResizeScroll = () => {
        if (open) positionDD();
      };

      input.addEventListener("input", onInput);
      input.addEventListener("keydown", onKey);
      input.addEventListener("blur", onBlur);
      window.addEventListener("resize", onResizeScroll);
      window.addEventListener("scroll", onResizeScroll, true);

      (input as any).__acDetach = () => {
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKey);
        input.removeEventListener("blur", onBlur);
        window.removeEventListener("resize", onResizeScroll);
        window.removeEventListener("scroll", onResizeScroll, true);
        dd.remove();
      };

      log.info("attach →", who, input);
    },
    []
  );

  useEffect(() => {
    log.info("🧭 Bootstrap autocomplete");

    const attachAll = () => {
      const mitt = document.querySelector<HTMLInputElement>(
        'input[data-gmaps="indirizzo-mittente"]'
      );
      const dest = document.querySelector<HTMLInputElement>(
        'input[data-gmaps="indirizzo-destinatario"]'
      );
      if (mitt) attachPlacesToInput(mitt, "mittente");
      if (dest) attachPlacesToInput(dest, "destinatario");
    };

    attachAll();

    const mo = new MutationObserver(() => attachAll());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      document
        .querySelectorAll<HTMLInputElement>(
          'input[data-gmaps="indirizzo-mittente"],input[data-gmaps="indirizzo-destinatario"]'
        )
        .forEach((el) => {
          const d: any = el as any;
          if (d.__acDetach) d.__acDetach();
        });
    };
  }, [attachPlacesToInput]);

  // ------------------------------------------------------------
  // SUCCESS UI
  // ------------------------------------------------------------
  if (success) {
    const INFO_URL =
      process.env.NEXT_PUBLIC_INFO_URL ||
      "/dashboard/informazioni-utili";

    const WHATSAPP_URL_BASE =
      process.env.NEXT_PUBLIC_WHATSAPP_URL ||
      "https://wa.me/message/CP62RMFFDNZPO1";

    const whatsappHref = `${WHATSAPP_URL_BASE}?text=${encodeURIComponent(
      `Ciao SPST, ho bisogno di supporto sulla spedizione ${success.idSped}`
    )}`;

    return (
      <div className="space-y-4" ref={topRef}>
        <h2 className="text-lg font-semibold">Spedizione creata</h2>

        <div className="rounded-2xl border bg-white p-4">
          <div className="mb-3 text-sm">
            <div className="font-medium">ID Spedizione</div>
            <div className="font-mono">{success.idSped}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <span className="text-slate-500">Tipo:</span> {success.tipoSped}
            </div>
            <div>
              <span className="text-slate-500">Incoterm:</span>{" "}
              {success.incoterm}
            </div>
            <div>
              <span className="text-slate-500">Data ritiro:</span>{" "}
              {success.dataRitiro ?? "—"}
            </div>
            <div>
              <span className="text-slate-500">Colli:</span>{" "}
              {success.colli} ({success.formato})
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-500">Destinatario:</span>{" "}
              {success.destinatario.ragioneSociale || "—"}
              {success.destinatario.citta
                ? ` — ${success.destinatario.citta}`
                : ""}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/spedizioni")}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Le mie spedizioni
            </button>

            <a
              href={INFO_URL}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Documenti & info utili
            </a>

            <a
              href={whatsappHref}
              target="_blank"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              style={{ borderColor: "#f7911e" }}
            >
              Supporto WhatsApp
            </a>

            <span className="text-sm text-green-700">
              Email di conferma inviata ✅
            </span>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Suggerimento: conserva l’ID per future comunicazioni.
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // FORM UI
  // ------------------------------------------------------------
  return (
    <div className="space-y-4" ref={topRef}>
      <h2 className="text-lg font-semibold">Nuova spedizione — altro</h2>

      {!!errors.length && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Controlla questi campi:</div>
          <ul className="list-disc ml-5 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tipo spedizione */}
      <div className="rounded-2xl border bg-white p-4">
        <Select
          label="Stai spedendo ad un privato? O ad una azienda?"
          value={tipoSped}
          onChange={(v) => setTipoSped(v as any)}
          options={[
            { label: "B2C — privato / cliente", value: "B2C" },
            { label: "B2B — azienda", value: "B2B" },
            { label: "Sample — campionatura", value: "Sample" },
          ]}
        />
      </div>

      {/* MITTENTE / DESTINATARIO */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Mittente"
            value={mittente}
            onChange={setMittente}
            gmapsTag="mittente"
          />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Destinatario"
            value={destinatario}
            onChange={setDestinatario}
            gmapsTag="destinatario"
            extraSwitch={{
              label: "Destinatario abilitato all’import",
              checked: destAbilitato,
              onChange: setDestAbilitato,
            }}
          />
        </div>
      </div>

      {/* Nessuna Packing List */}
      <ColliCard
        colli={colli}
        onChange={setColli}
        formato={formato}
        setFormato={setFormato}
        contenuto={contenuto}
        setContenuto={setContenuto}
      />

      <RitiroCard
        date={ritiroData}
        setDate={setRitiroData}
        note={ritiroNote}
        setNote={setRitiroNote}
      />

      <FatturaCard
        incoterm={incoterm}
        setIncoterm={setIncoterm}
        valuta={valuta}
        setValuta={setValuta}
        note={noteFatt}
        setNote={setNoteFatt}
        delega={delega}
        setDelega={setDelega}
        fatturazione={fatturazione}
        setFatturazione={setFatturazione}
        destinatario={destinatario}
        sameAsDest={sameAsDest}
        setSameAsDest={setSameAsDest}
        fatturaFile={fatturaFile}
        setFatturaFile={setFatturaFile}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salva}
          disabled={saving}
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          )}
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}
