// app/dashboard/quotazioni/nuova/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import { createClient } from "@supabase/supabase-js";
import { Select } from "@/components/nuova/Field";
import { postPreventivo } from "@/lib/api";
import { getIdToken } from "@/lib/firebase-client-auth";

// ------------------------------------------------------------
// Supabase client (riusiamo sempre lo stesso) — come /nuova/vino
// ------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type Suggestion = { id: string; main: string; secondary?: string };

// ------------------------------------------------------------
// Costanti Google
// ------------------------------------------------------------
const GMAPS_LANG = process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE || "it";
const GMAPS_REGION = process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION || "IT";

// ------------------------------------------------------------
// Blank
// ------------------------------------------------------------
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

const log = {
  info: (...a: any[]) => console.log("%c[AC]", "color:#1c3e5e", ...a),
  warn: (...a: any[]) => console.warn("[AC]", ...a),
  error: (...a: any[]) => console.error("[AC]", ...a),
};

// ------------------------------------------------------------
// Places proxy calls (identici a /nuova/vino)
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

function parseAddressFromDetails(d: any) {
  const comps: any[] = d?.addressComponents || [];
  const get = (type: string) =>
    comps.find((c) => Array.isArray(c.types) && c.types.includes(type)) || null;

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
// Helpers UI/validation
// ------------------------------------------------------------
function isPhoneValid(raw?: string) {
  if (!raw) return false;
  const v = raw.replace(/\s+/g, "");
  return /^\+?[1-9]\d{6,14}$/.test(v);
}

function setPartyFieldErrorBorder(el: HTMLElement | null, on: boolean) {
  if (!el) return;
  if (on) {
    el.classList.add("ring-2", "ring-rose-300", "border-rose-300");
  } else {
    el.classList.remove("ring-2", "ring-rose-300", "border-rose-300");
  }
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------
export default function NuovaQuotazionePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedEmail = searchParams.get("for"); // compat: come /nuova/vino

  const topRef = useRef<HTMLDivElement>(null);

  // Parti
  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Colli / dettagli merce
  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState<string>("");

  // Assicurazione (Pallet)
  const [assicurazioneAttiva, setAssicurazioneAttiva] = useState<boolean>(false);
  const [valoreAssicurato, setValoreAssicurato] = useState<number | null>(null);

  // Auto-reset se torno a Pacco
  useEffect(() => {
    if (formato !== "Pallet") {
      if (assicurazioneAttiva) setAssicurazioneAttiva(false);
      if (valoreAssicurato != null) setValoreAssicurato(null);
    }
  }, [formato, assicurazioneAttiva, valoreAssicurato]);

  // Dettagli spedizione
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2C");
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");

  // Ritiro
  const [ritiroData, setRitiroData] = useState<Date | undefined>(undefined);
  const [ritiroNote, setRitiroNote] = useState("");

  // Note generiche
  const [note, setNote] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<{ id: string; displayId?: string } | null>(null);

  // ------------------------------------------------------------
  // Prefill MITTENTE da /api/impostazioni (come /nuova/vino)
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const effectiveEmail =
          forcedEmail?.toLowerCase().trim() ||
          user?.email?.toLowerCase().trim() ||
          "info@spst.it";

        if (!effectiveEmail) return;

        const res = await fetch(
          `/api/impostazioni?email=${encodeURIComponent(effectiveEmail)}`,
          {
            headers: { "x-spst-email": effectiveEmail },
            cache: "no-store",
          }
        );

        const json = await res.json().catch(() => null);
        log.info("SPST[quotazioni/nuova] impostazioni:", json);

        if (!json?.ok || !json?.mittente || cancelled) return;

        const m = json.mittente;

        setMittente((prev) => ({
          ...prev,
          ragioneSociale: m.mittente || prev.ragioneSociale || "",
          indirizzo: m.indirizzo || prev.indirizzo || "",
          cap: m.cap || prev.cap || "",
          citta: m.citta || prev.citta || "",
          paese: m.paese || prev.paese || "",
          telefono: m.telefono || prev.telefono || "",
          piva: m.piva || prev.piva || "",
        }));
      } catch (e) {
        console.error("[quotazioni/nuova] errore prefill mittente", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedEmail]);

  // ------------------------------------------------------------
  // Autocomplete (stessa logica /nuova/vino) — si aggancia ai data attr
  // PartyCard deve rendere l'input indirizzo con:
  //  - data-gmaps="indirizzo-mittente"
  //  - data-gmaps="indirizzo-destinatario"
  // oppure via prop gmapsTag="mittente"/"destinatario"
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

        // non forziamo value qui: PartyCard è controlled,
        // ma mettiamo un hint nell'input (UX) e poi settiamo i campi con setParty.
        input.value = sel.main + (sel.secondary ? `, ${sel.secondary}` : "");

        const details = await fetchPlaceDetails(sel.id, session);
        session = newSessionToken();
        if (!details) return;

        const addr = parseAddressFromDetails(details);

        const lat = (details as any)?.location?.latitude;
        const lng = (details as any)?.location?.longitude;
        if (!addr.cap && typeof lat === "number" && typeof lng === "number") {
          try {
            const cap = await fetchPostalCodeByLatLng(lat, lng, GMAPS_LANG);
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
        items = await fetchSuggestions(q, session);
        render();
        openMenu();
      };

      const onKey = (e: KeyboardEvent) => {
        if (!open) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, Math.max(items.length - 1, 0));
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
    },
    []
  );

  useEffect(() => {
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
  // Validazione con “campi obbligatori più stretti + alert”
  // (non modifichiamo PartyCard internamente: evidenziamo card + lista errori)
  // ------------------------------------------------------------
  function validate(): string[] {
    const errs: string[] = [];

    // Mittente
    if (!mittente.ragioneSociale?.trim()) errs.push("Mittente: ragione sociale obbligatoria.");
    if (!mittente.indirizzo?.trim()) errs.push("Mittente: indirizzo obbligatorio.");
    if (!mittente.cap?.trim()) errs.push("Mittente: CAP obbligatorio.");
    if (!mittente.citta?.trim()) errs.push("Mittente: città obbligatoria.");
    if (!mittente.paese?.trim()) errs.push("Mittente: paese obbligatorio.");
    if (!mittente.piva?.trim()) errs.push("Mittente: P.IVA/CF obbligatoria.");
    if (!isPhoneValid(mittente.telefono))
      errs.push("Mittente: telefono obbligatorio in formato internazionale (es. +393201441789).");

    // Destinatario
    if (!destinatario.ragioneSociale?.trim())
      errs.push("Destinatario: ragione sociale obbligatoria.");
    if (!destinatario.indirizzo?.trim()) errs.push("Destinatario: indirizzo obbligatorio.");
    if (!destinatario.cap?.trim()) errs.push("Destinatario: CAP obbligatorio.");
    if (!destinatario.citta?.trim()) errs.push("Destinatario: città obbligatoria.");
    if (!destinatario.paese?.trim()) errs.push("Destinatario: paese obbligatorio.");
    if (!isPhoneValid(destinatario.telefono))
      errs.push("Destinatario: telefono obbligatorio in formato internazionale.");

    // Colli
    const invalidColli = colli.some(
      (c) =>
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null ||
        (c.lunghezza_cm ?? 0) <= 0 ||
        (c.larghezza_cm ?? 0) <= 0 ||
        (c.altezza_cm ?? 0) <= 0 ||
        (c.peso_kg ?? 0) <= 0
    );
    if (invalidColli) errs.push("Colli: inserisci misure e pesi > 0 per ogni collo.");

    // Ritiro
    if (!ritiroData) errs.push("Ritiro: seleziona il giorno di ritiro.");

    // Pallet + assicurazione => valore
    if (formato === "Pallet" && assicurazioneAttiva) {
      if (valoreAssicurato == null || valoreAssicurato <= 0) {
        errs.push("Assicurazione: valore assicurato mancante/non valido (assicurazione attiva).");
      }
    }

    return errs;
  }

  // Evidenzia card obbligatorie
  useEffect(() => {
    const has = (prefix: string) => errors.some((e) => e.startsWith(prefix));
    const mittCard = document.querySelector<HTMLElement>('[data-card="mittente"]');
    const destCard = document.querySelector<HTMLElement>('[data-card="destinatario"]');
    const colliCard = document.querySelector<HTMLElement>('[data-card="colli"]');
    const ritiroCard = document.querySelector<HTMLElement>('[data-card="ritiro"]');

    setPartyFieldErrorBorder(mittCard, has("Mittente:"));
    setPartyFieldErrorBorder(destCard, has("Destinatario:"));
    setPartyFieldErrorBorder(colliCard, has("Colli:"));
    setPartyFieldErrorBorder(ritiroCard, has("Ritiro:"));
  }, [errors]);

  async function salva() {
    if (saving) return;

    const v = validate();
    if (v.length) {
      setErrors(v);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setErrors([]);

    setSaving(true);
    try {
      // Manteniamo payload compat con postPreventivo “vecchio”,
      // senza cambiare il tipo: aggiungiamo SOLO ciò che già accetta.
      const res: any = await postPreventivo(
        {
          mittente: {
            ragioneSociale: mittente.ragioneSociale,
            paese: mittente.paese,
            citta: mittente.citta,
            cap: mittente.cap,
            indirizzo: mittente.indirizzo,
            telefono: mittente.telefono || undefined,
            taxId: mittente.piva || undefined,
          },
          destinatario: {
            ragioneSociale: destinatario.ragioneSociale,
            paese: destinatario.paese,
            citta: destinatario.citta,
            cap: destinatario.cap,
            indirizzo: destinatario.indirizzo,
            telefono: destinatario.telefono || undefined,
            taxId: destinatario.piva || undefined,
          },
          colli: (colli || []).map((c) => ({
            quantita: 1,
            lunghezza_cm: c.lunghezza_cm ?? null,
            larghezza_cm: c.larghezza_cm ?? null,
            altezza_cm: c.altezza_cm ?? null,
            peso_kg: c.peso_kg ?? null,
          })),
          valuta,
          noteGeneriche: note,
          ritiroData: ritiroData ? ritiroData.toISOString() : undefined,
          tipoSped,
          incoterm,

          // NOTA: formato/contenuto/assicurazione/valore NON li aggiungo qui
          // finché non estendi QuoteCreatePayload + backend, come nel commento originale.
          // Quando lo estendi, li puoi aggiungere in modo identico a /nuova/vino.
        },
        getIdToken
      );

      setOk({ id: res?.id, displayId: res?.displayId });
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      console.error("Errore creazione preventivo", e);
      setErrors(["Errore durante la creazione della quotazione. Riprova."]);
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // Success UI
  // ------------------------------------------------------------
  if (ok?.id) {
    return (
      <div ref={topRef} className="space-y-4">
        <h2 className="text-lg font-semibold">Quotazione inviata</h2>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm">
            ID preventivo:{" "}
            <span className="font-mono">{ok.displayId || ok.id}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/quotazioni"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Le mie quotazioni
            </Link>
            <button
              onClick={() => router.refresh()}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Nuova quotazione
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Form UI
  // ------------------------------------------------------------
  return (
    <div ref={topRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Nuova quotazione</h1>
        <Link
          href="/dashboard/quotazioni"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Le mie quotazioni
        </Link>
      </div>

      {!!errors.length && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="font-medium mb-1">Controlla questi campi:</div>
          <ul className="list-disc ml-5 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tipo spedizione con definizione chiara */}
      <div className="rounded-2xl border bg-white p-4">
        <Select
          label="Tipo spedizione"
          value={tipoSped}
          onChange={(v) => setTipoSped(v as "B2B" | "B2C" | "Sample")}
          options={[
            { label: "B2C — Spedizione a cliente finale", value: "B2C" },
            { label: "B2B — Sto spedendo ad una azienda", value: "B2B" },
            { label: "Sample — Sto inviando della campionatura", value: "Sample" },
          ]}
        />
      </div>

      {/* Mittente / Destinatario (con gmapsTag + data-card per highlight) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div data-card="mittente" className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Mittente"
            value={mittente}
            onChange={setMittente}
            gmapsTag="mittente"
          />
        </div>
        <div data-card="destinatario" className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Destinatario"
            value={destinatario}
            onChange={setDestinatario}
            gmapsTag="destinatario"
          />
        </div>
      </div>

      {/* Colli / Contenuto */}
      <div data-card="colli" className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Colli e contenuto</h2>
        <ColliCard
          colli={colli}
          onChange={setColli}
          formato={formato}
          setFormato={setFormato}
          contenuto={contenuto}
          setContenuto={setContenuto}
          assicurazioneAttiva={assicurazioneAttiva}
          setAssicurazioneAttiva={setAssicurazioneAttiva}
          valoreAssicurato={valoreAssicurato}
          setValoreAssicurato={setValoreAssicurato}
        />
      </div>

      {/* Dettagli spedizione */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Dettagli spedizione</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Select
              label="Incoterm"
              value={incoterm}
              onChange={(v) => setIncoterm(v as "DAP" | "DDP" | "EXW")}
              options={[
                {
                  label:
                    "DAP — Spedizione a carico del mittente, dazi e oneri doganali a carico del destinatario",
                  value: "DAP",
                },
                { label: "DDP — Tutto a carico del mittente", value: "DDP" },
                { label: "EXW — Tutto a carico del destinatario", value: "EXW" },
              ]}
            />
          </div>

          <div>
            <Select
              label="Valuta"
              value={valuta}
              onChange={(v) => setValuta(v as "EUR" | "USD" | "GBP")}
              options={[
                { label: "EUR", value: "EUR" },
                { label: "USD", value: "USD" },
                { label: "GBP", value: "GBP" },
              ]}
            />
          </div>

          <div>
            {/* Placeholder “spazio” per future campi */}
            <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-500 flex items-center">
              (Spazio per campi extra)
            </div>
          </div>
        </div>
      </div>

      {/* Ritiro */}
      <div data-card="ritiro" className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Ritiro</h2>
        <RitiroCard
          date={ritiroData}
          setDate={setRitiroData}
          note={ritiroNote}
          setNote={setRitiroNote}
        />
      </div>

      {/* Note */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Note</h2>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Note generiche sulla spedizione
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spst-blue/20"
          placeholder="Es. orari preferiti, vincoli, dettagli utili…"
        />
      </div>

      {/* CTA */}
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
          {saving ? "Invio…" : "Invia richiesta"}
        </button>
      </div>
    </div>
  );
}
