// FILE: app/dashboard/nuova/vino/_places/usePlacesAutocomplete.ts
"use client";

import { useCallback, useEffect } from "react";
import type { Suggestion, AddressParts } from "../_logic/types";
import {
  fetchPlaceDetails,
  fetchPostalCodeByLatLng,
  fetchSuggestions,
  newSessionToken,
} from "./places.api";
import { parseAddressFromDetails } from "./parseAddress";
import { GMAPS_LANG } from "../_logic/constants";

type Who = "mittente" | "destinatario";

type Args = {
  selectors?: {
    mittente: string;
    destinatario: string;
  };
  onFill: (who: Who, parts: AddressParts) => void;
};

const DEFAULT_SELECTORS = {
  mittente: 'input[data-gmaps="indirizzo-mittente"]',
  destinatario: 'input[data-gmaps="indirizzo-destinatario"]',
};

export function usePlacesAutocomplete({
  selectors = DEFAULT_SELECTORS,
  onFill,
}: Args) {
  const attachPlacesToInput = useCallback(
    (input: HTMLInputElement, who: Who) => {
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

      const highlight = () => {
        Array.from(ul.children).forEach((el, i) => {
          (el as HTMLElement).style.background =
            i === activeIndex ? "#f1f5f9" : "transparent";
        });
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
          try {
            const cap = await fetchPostalCodeByLatLng(lat, lng, GMAPS_LANG);
            if (cap) addr.cap = cap;
          } catch {
            // ignore
          }
        }

        onFill(who, addr);
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
          void choose(activeIndex);
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
    [onFill]
  );

  useEffect(() => {
    const attachAll = () => {
      const mitt = document.querySelector<HTMLInputElement>(selectors.mittente);
      const dest = document.querySelector<HTMLInputElement>(
        selectors.destinatario
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
          `${selectors.mittente},${selectors.destinatario}`
        )
        .forEach((el) => {
          const d: any = el as any;
          if (d.__acDetach) d.__acDetach();

          // ✅ allow re-attach if the hook re-mounts
          try {
            delete d.__acAttached;
            delete d.__acDetach;
          } catch {
            d.__acAttached = false;
            d.__acDetach = undefined;
          }
        });
    };
  }, [attachPlacesToInput, selectors.destinatario, selectors.mittente]);
}
