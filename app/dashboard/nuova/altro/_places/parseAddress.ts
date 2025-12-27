// FILE: app/dashboard/nuova/altro/_places/parseAddress.ts
import type { AddressParts } from "../_logic/types";

function pickRoot(d: any) {
  // supporta diverse shape possibili (dipende da come ritorna /api/places/details)
  return d?.place || d?.result || d?.data || d || {};
}

function pickComps(root: any): any[] {
  return (
    root?.addressComponents ||
    root?.address_components ||
    root?.address?.addressComponents ||
    root?.address?.address_components ||
    []
  );
}

function getText(c: any) {
  return (
    c?.longText ||
    c?.long_name ||
    c?.name ||
    c?.shortText ||
    c?.short_name ||
    ""
  );
}

export function parseAddressFromDetails(d: any): AddressParts {
  const root = pickRoot(d);
  const comps: any[] = pickComps(root);

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

  const line = [getText(route), getText(streetNr), getText(premise)]
    .filter(Boolean)
    .join(" ")
    .trim();

  const formatted = root?.formattedAddress || root?.formatted_address || "";

  return {
    indirizzo: line || formatted || "",
    citta: getText(locality) || getText(admin2) || getText(admin1) || "",
    cap: getText(postal) || "",
    paese: getText(country) || "",
  };
}
