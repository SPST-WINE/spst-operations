// app/dashboard/nuova/vino/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import FatturaCard from "@/components/nuova/FatturaCard";
import PackingListVino, { RigaPL } from "@/components/nuova/PackingListVino";
import { Select } from "@/components/nuova/Field";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------
// Types & helpers
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

const DEST_PIVA_MSG =
  "Per le spedizioni vino di tipo B2B o Sample è obbligatoria la Partita IVA / Codice Fiscale del destinatario.";

const log = {
  info: (...a: any[]) => console.log("%c[AC]", "color:#1c3e5e", ...a),
  warn: (...a: any[]) => console.warn("[AC]", ...a),
  error: (...a: any[]) => console.error("[AC]", ...a),
  group: (label: string) => console.groupCollapsed(`%c${label}`, "color:#555"),
  groupEnd: () => console.groupEnd(),
};

// ------------------------------------------------------------
// Places proxy calls
// ------------------------------------------------------------
async function fetchSuggestions(
  input: string,
  sessionToken: string
): Promise<Suggestion[]> {
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
  if (!res.ok || (j as any)?.error) {
    console.error("[AC] autocomplete proxy error:", (j as any)?.error || j);
    return [];
  }

  const arr = (j as any)?.suggestions || [];
  return arr
    .map((s: any) => {
      const pred = s.placePrediction || {};
      const fmt = pred.structuredFormat || {};
      return {
        id: pred.placeId,
        main: fmt?.mainText?.text || "",
        secondary: fmt?.secondaryText?.text || "",
      } as Suggestion;
    })
    .filter((s: Suggestion) => !!s.id && (!!s.main || !!s.secondary));
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

  if (!res.ok || (j as any)?.error) {
    console.error("[AC] details proxy error:", (j as any)?.error || j);
    return null;
  }
  return j;
}

async function fetchPostalCodeByLatLng(
  lat: number,
  lng: number,
  lang = "it"
): Promise<string> {
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
        (x: any) => Array.isArray(x.types) && x.types.includes("postal_code")
      );
      if (c) return c.long_name || c.short_name || "";
    }
    return "";
  };

  return search((j as any).results) || "";
}

// ------------------------------------------------------------
// Parsing indirizzo da Place Details
// ------------------------------------------------------------
function parseAddressFromDetails(d: any) {
  const comps: any[] = d?.addressComponents || [];
  const get = (type: string) =>
    comps.find(
      (c) => Array.isArray(c.types) && c.types.includes(type)
    ) || null;

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
// Small API helper (local) - usa Supabase Auth
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
    const details = body?.details || body?.error || `${res.status} ${res.statusText}`;
    throw new Error(details);
  }
  return body.shipment; // { id, ... }
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------
export default function NuovaVinoPage() {
  const router = useRouter();

  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2B");
  const [destAbilitato, setDestAbilitato] = useState(false);

  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Prefill mittente da profilo: TODO (Supabase)
  useEffect(() => {
    // in futuro: supabase.auth.getUser + tabella profilo
  }, []);

  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState<string>("");
  const [ritiroData, setRitiroData] = useState<Date | undefined>(undefined);
  const [ritiroNote, setRitiroNote] = useState("");
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [noteFatt, setNoteFatt] = useState("");
  const [delega, setDelega] = useState(false);
  const [fatturazione, setFatturazione] = useState<Party>(blankParty);
  const [sameAsDest, setSameAsDest] = useState(false);
  const [fatturaFile, setFatturaFile] = useState<File | undefined>(undefined);

  const [pl, setPl] = useState<RigaPL[]>([
    {
      etichetta: "",
      tipologia: "vino fermo",
      bottiglie: 1,
      formato_litri: 0.75,
      gradazione: 12,
      prezzo: 0,
      valuta: "EUR",
      peso_netto_bott: 1.2,
      peso_lordo_bott: 1.5,
    },
  ]);
  const [plFiles, setPlFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [errors.length]);

  useEffect(() => {
    if (tipoSped === "B2C") {
      setErrors((prev) => prev.filter((msg) => msg !== DEST_PIVA_MSG));
    }
  }, [tipoSped, destinatario.piva]);

  function isPhoneValid(raw?: string) {
    if (!raw) return false;
    const v = raw.replace(/\s+/g, "");
    return /^\+?[1-9]\d{6,14}$/.test(v);
  }

  function validatePLConditional(rows: RigaPL[] | undefined): string[] {
    const out: string[] = [];
    if (!rows || rows.length === 0) {
      out.push("Packing list obbligatoria per spedizioni vino.");
      return out;
    }
    rows.forEach((r, i) => {
      const idx = `Riga PL #${i + 1}`;
      if (!r.etichetta?.trim()) out.push(`${idx}: etichetta prodotto mancante.`);
      if (!r["tipologia"])
        out.push(
          `${idx}: seleziona la tipologia (vino fermo/spumante o brochure/depliant).`
        );

      const isBrochure = r["tipologia"] === "brochure/depliant";
      if (isBrochure) {
        if (!r.bottiglie || r.bottiglie <= 0)
          out.push(
            `${idx}: quantità (pezzi) > 0 obbligatoria per brochure/depliant.`
          );
        if (r.peso_netto_bott == null || r.peso_netto_bott <= 0)
          out.push(
            `${idx}: peso netto/pezzo (kg) obbligatorio per brochure/depliant.`
          );
        if (r.peso_lordo_bott == null || r.peso_lordo_bott <= 0)
          out.push(
            `${idx}: peso lordo/pezzo (kg) obbligatorio per brochure/depliant.`
          );
      } else {
        if (!r.bottiglie || r.bottiglie <= 0)
          out.push(`${idx}: numero bottiglie > 0 obbligatorio.`);
        if (r.formato_litri == null || r.formato_litri <= 0)
          out.push(`${idx}: formato bottiglia (L) obbligatorio.`);
        if (r.gradazione == null || Number.isNaN(r.gradazione))
          out.push(`${idx}: gradazione alcolica (% vol) obbligatoria.`);
        else if (r.gradazione < 4 || r.gradazione > 25)
          out.push(
            `${idx}: gradazione fuori range plausibile (4–25% vol).`
          );
        if (r.peso_netto_bott == null || r.peso_netto_bott <= 0)
          out.push(
            `${idx}: peso netto/bottiglia (kg) obbligatorio.`
          );
        if (r.peso_lordo_bott == null || r.peso_lordo_bott <= 0)
          out.push(
            `${idx}: peso lordo/bottiglia (kg) obbligatorio.`
          );
      }
    });
    return out;
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!isPhoneValid(mittente.telefono))
      errs.push(
        "Telefono mittente obbligatorio in formato internazionale (es. +393201441789)."
      );
    if (!isPhoneValid(destinatario.telefono))
      errs.push("Telefono destinatario obbligatorio in formato internazionale.");
    if ((tipoSped === "B2B" || tipoSped === "Sample") && !destinatario.piva?.trim()) {
      errs.push(DEST_PIVA_MSG);
    }
    if (!mittente.piva?.trim())
      errs.push("Partita IVA/Codice Fiscale del mittente mancante.");
    colli.forEach((c, i) => {
      const miss =
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null;
      const nonPos =
        (c.lunghezza_cm ?? 0) <= 0 ||
        (c.larghezza_cm ?? 0) <= 0 ||
        (c.altezza_cm ?? 0) <= 0 ||
        (c.peso_kg ?? 0) <= 0;
      if (miss || nonPos)
        errs.push(`Collo #${i + 1}: inserire tutte le misure e un peso > 0.`);
    });
    if (!ritiroData) errs.push("Seleziona il giorno di ritiro.");
    errs.push(...validatePLConditional(pl));
    if (!fatturaFile) {
      const fatt = sameAsDest ? destinatario : fatturazione;
      if (!fatt.ragioneSociale?.trim())
        errs.push("Dati fattura: ragione sociale mancante.");
      if (
        (tipoSped === "B2B" || tipoSped === "Sample") &&
        !fatt.piva?.trim()
      ) {
        errs.push(
          "Dati fattura: P.IVA/CF obbligatoria per B2B e Campionatura."
        );
      }
    }
    return errs;
  }

  const salva = async () => {
    if (saving) return;
    const v = validate();
    if (v.length) {
      setErrors(v);
      return;
    } else {
      setErrors([]);
    }
    setSaving(true);
    try {
      const payload = {
        sorgente: "vino" as const,
        tipoSped,
        destAbilitato,
        contenuto,
        formato,
        ritiroData: ritiroData ? ritiroData.toISOString() : undefined,
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
        packingList: pl,
      };

      // chiamata API con Supabase Auth (email + bearer)
      const created = await createShipmentWithAuth(payload);

      const id = created?.id || created?.recId || "SPEDIZIONE";
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
        topRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } catch (e: any) {
      const msg =
        e?.message ||
        "Si è verificato un errore durante il salvataggio. Riprova più tardi.";
      setErrors([msg]);
      console.error("Errore salvataggio spedizione", e);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------
  // Autocomplete
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
        dd.style.left = `${Math.round(r.left + window.scrollX)}px`;
        dd.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
        dd.style.width = `${Math.round(r.width)}px`;
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
          try {
            const cap = await fetchPostalCodeByLatLng(
              lat,
              lng,
              GMAPS_LANG
            );
            if (cap) addr.cap = cap;
          } catch {}
        }

        log.info("fill →", who, addr);
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
          activeIndex = Math.min(
            activeIndex + 1,
            Math.max(items.length - 1, 0)
          );
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
      const mitt =
        document.querySelector<HTMLInputElement>(
          'input[data-gmaps="indirizzo-mittente"]'
        );
      const dest =
        document.querySelector<HTMLInputElement>(
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
  // Render
  // ------------------------------------------------------------
  if (success) {
    const INFO_URL =
      process.env.NEXT_PUBLIC_INFO_URL || "/dashboard/informazioni-utili";
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
              <span className="text-slate-500">Colli:</span> {success.colli} (
              {success.formato})
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
              rel="noopener noreferrer"
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
            Suggerimento: conserva l’ID per future comunicazioni. Puoi chiudere
            questa pagina.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={topRef}>
      <h2 className="text-lg font-semibold">Nuova spedizione — vino</h2>

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

      <div className="rounded-2xl border bg-white p-4">
        <Select
          label="Stai spedendo ad un privato? O ad una azienda?"
          value={tipoSped}
          onChange={(v) => setTipoSped(v as "B2B" | "B2C" | "Sample")}
          options={[
            { label: "B2C — privato / cliente", value: "B2C" },
            { label: "B2B — azienda", value: "B2B" },
            { label: "Sample — campionatura", value: "Sample" },
          ]}
        />
      </div>

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

      <PackingListVino
        value={pl}
        onChange={setPl}
        files={plFiles}
        onFiles={setPlFiles}
      />

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
          aria-busy={saving}
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
