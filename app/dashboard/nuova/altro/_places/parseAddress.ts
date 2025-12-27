// FILE: app/dashboard/nuova/altro/_places/parseAddress.ts
import type { AddressParts } from "../_logic/types";

export function parseAddressFromDetails(d: any): AddressParts {
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
