// FILE: app/dashboard/nuova/altro/_places/places.api.ts
import { GMAPS_LANG, GMAPS_REGION } from "../_logic/constants";
import type { Suggestion } from "../_logic/types";

export async function fetchSuggestions(
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
  if (!res.ok || (j as any)?.error) return [];

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

export async function fetchPlaceDetails(placeId: string, sessionToken?: string) {
  const params = new URLSearchParams({
    placeId,
    languageCode: GMAPS_LANG,
    regionCode: GMAPS_REGION,
  });
  if (sessionToken) params.set("sessionToken", sessionToken);

  const res = await fetch(`/api/places/details?${params.toString()}`);
  const j = await res.json().catch(() => null);

  if (!res.ok || (j as any)?.error) return null;
  return j;
}

export async function fetchPostalCodeByLatLng(
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

export function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
