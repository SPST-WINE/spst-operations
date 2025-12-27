// FILE: app/dashboard/nuova/altro/_hooks/usePlacesAutocomplete.ts
"use client";

import { useCallback, useEffect } from "react";

type Suggestion = { id: string; main: string; secondary?: string };
type ParsedAddr = { indirizzo: string; citta: string; cap: string; paese: string };

const GMAPS_LANG = process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE || "it";
const GMAPS_REGION = process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION || "IT";

const log = {
  info: (...a: any[]) => console.log("%c[AC]", "color:#1c3e5e", ...a),
  group: (label: string) => console.groupCollapsed(`%c${label}`, "color:#555"),
  groupEnd: () => console.groupEnd(),
};

function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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
      const c = (r.address_components || []).find((x: any) =>
        x.types?.includes("postal_code")
      );
      if (c) return c.long_name || c.short_name || "";
    }
    return "";
  };
  return search(j.results) || "";
}

function parseAddressFromDetails(d: any): ParsedAddr {
  const comps: any[] = d?.addressComponents || [];
  const get = (type: string) => comps.find((c) => c.types?.includes(type)) || null;

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

type Args = {
  selectors: { mittente: string; destinatario: string };
  onApply: {
    mittente: (addr: Partial<ParsedAddr>) => void;
    destinatario: (addr: Partial<ParsedAddr>) => void;
  };
};

export function usePlacesAutocomplete({ selectors, onApply }: Args) {
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

        input.value = sel.main + (sel.secondary ? `, ${sel.secondary}` : "");

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

        if (who === "mittente") onApply.mittente(addr);
        else onApply.destinatario(addr);
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

        // allow re-attach on remount
        try {
          delete (input as any).__acAttached;
          delete (input as any).__acDetach;
        } catch {
          (input as any).__acAttached = false;
          (input as any).__acDetach = undefined;
        }
      };

      log.info("attach →", who, input);
    },
    [onApply.destinatario, onApply.mittente]
  );

  useEffect(() => {
    log.info("🧭 Bootstrap autocomplete");

    const attachAll = () => {
      const mitt = document.querySelector<HTMLInputElement>(selectors.mittente);
      const dest = document.querySelector<HTMLInputElement>(selectors.destinatario);
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
          `${selectors.mittente},${selectors.destinatario}`
        )
        .forEach((el) => {
          const d: any = el as any;
          if (d.__acDetach) d.__acDetach();
        });
    };
  }, [attachPlacesToInput, selectors.destinatario, selectors.mittente]);
}
