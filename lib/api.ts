// lib/api.ts

// Permette di passare direttamente un token o una funzione che lo ritorna
export type GetIdToken =
  | (() => Promise<string | undefined> | string | undefined)
  | undefined;

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function buildAuthHeader(getIdToken?: GetIdToken) {
  if (!getIdToken) return {};
  const token =
    typeof getIdToken === 'function' ? await getIdToken() : getIdToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Prova a restituire qualcosa di sensato anche se non è JSON
    return { ok: res.ok, error: text || `HTTP_${res.status}` };
  }
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  getIdToken?: GetIdToken
): Promise<T> {
  const auth = await buildAuthHeader(getIdToken);
  const headers = {
    ...(init.headers || {}),
    ...auth,
  } as Record<string, string>;

  const res = await fetch(url, { ...init, headers });
  const data: any = await parseResponse(res);

  // Considera errore sia HTTP !ok che payload { ok:false }
  if (!res.ok || (data && typeof data === 'object' && 'ok' in data && data.ok === false)) {
    const code = data?.error as string | undefined;
    const msg =
      (data?.message as string | undefined) ||
      (data?.error as string | undefined) ||
      `HTTP_${res.status}`;
    throw new ApiError(msg, code, res.status);
  }

  return data as T;
}

// ---------- Tipi di comodo ----------
export interface SpedizioneResponse {
  ok: boolean;
  id: string;
  displayId: string;
}

// ---------- API: Spedizioni ----------
export async function postSpedizione(
  payload: any,
  getIdToken?: GetIdToken
): Promise<{ id: string; idSped?: string; idSpedizione?: string }> {
  const data = await request<{
    ok: true;
    id: string;
    idSped?: string;
    idSpedizione?: string;
  }>(
    '/api/spedizioni',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    getIdToken
  );

  // compat: mappa idSpedizione -> idSped se necessario
  return {
    id: (data as any).id,
    idSped: (data as any).idSped ?? (data as any).idSpedizione,
    idSpedizione: (data as any).idSpedizione,
  };
}

/** Restituisce SEMPRE un array normalizzato (usa { ok, rows } della route) */
export async function getSpedizioni(
  getIdToken?: GetIdToken,
  params?: { email?: string }
): Promise<any[]> {
  const headers: Record<string, string> = {};
  if (params?.email) headers["x-user-email"] = params.email;

  const res = await fetch("/api/my-shipments", { headers });
  const json = await res.json();
  return Array.isArray(json?.rows) ? json.rows : [];
}

export function postSpedizioneAttachments(
  id: string,
  payload: {
    fattura?: { url: string; filename?: string }[];
    packing?: { url: string; filename?: string }[];
  },
  getIdToken?: GetIdToken
): Promise<{ ok: true }> {
  return request(
    `/api/spedizioni/${encodeURIComponent(id)}/attachments`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    getIdToken
  );
}

export async function postSpedizioneNotify(
  id: string,
  getIdToken?: GetIdToken
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/spedizioni/${encodeURIComponent(id)}/notify`,
    { method: 'POST' },
    getIdToken
  );
}

// ---------- API: Profilo / UTENTI ----------
export async function getUserProfile(
  getIdToken?: GetIdToken
): Promise<{ ok: boolean; email?: string; party?: any }> {
  return request('/api/profile', { method: 'GET', credentials: 'include' }, getIdToken);
}

export async function saveUserProfile(
  party: any,
  getIdToken?: GetIdToken
): Promise<{ ok: boolean; id?: string }> {
  return request(
    '/api/profile',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ party }),
    },
    getIdToken
  );
}

/*
Uso (esempio gestione errori lato UI):

try {
  await postSpedizione(payload, getIdToken);
} catch (e) {
  const err = e as ApiError;
  if (err.code === 'DEST_PIVA_REQUIRED') {
    // mostra messaggio specifico e focus sul campo
  } else {
    // fallback: err.message
  }
}
*/

// ---- QUOTES (portale) ------------------------------------------------------

export type QuoteParty = {
  ragioneSociale: string;
  paese: string;
  citta: string;
  cap: string;
  indirizzo: string;
  telefono?: string;
  taxId?: string;
};

export type QuoteCollo = {
  quantita?: number;
  lunghezza_cm?: number | null;
  larghezza_cm?: number | null;
  altezza_cm?: number | null;
  peso_kg?: number | null;
};

export type QuoteCreatePayload = {
  mittente: QuoteParty;
  destinatario: QuoteParty;
  colli: QuoteCollo[];
  valuta: 'EUR' | 'USD' | 'GBP';
  noteGeneriche?: string;   // (ex "note")
  ritiroData?: string;      // ISO (yyyy-mm-dd)
  tipoSped?: 'B2B' | 'B2C' | 'Sample';
  incoterm?: 'DAP' | 'DDP' | 'EXW';
  // 👇 NUOVO
  contenutoColli?: string;
  // server può valorizzare createdByEmail/customerEmail da auth
  createdByEmail?: string;
  customerEmail?: string;
  valoreAssicurato?: number | null;
};


export async function postPreventivo(
  payload: QuoteCreatePayload,
  getIdToken?: GetIdToken
): Promise<{ ok: true; id: string; displayId?: string }> {
  return request(
    '/api/quotazioni',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    getIdToken
  );
}

/** Lista preventivi (ritorna sempre [] in fallback) */
export async function getPreventivi(getIdToken?: GetIdToken): Promise<any[]> {
  const json = await request<{ ok: boolean; rows: any[] }>(
    '/api/quotazioni',
    { method: 'GET' },
    getIdToken
  );
  return Array.isArray(json?.rows) ? json.rows : [];
}

/** Dettaglio preventivo per recordId OPPURE ID_Preventivo (es. Q-2025-00078) */
export async function getPreventivo(
  idOrDisplayId: string,
  getIdToken?: GetIdToken
): Promise<any | null> {
  const data = await request<any>(
    `/api/quotazioni/${encodeURIComponent(idOrDisplayId)}`,
    { method: 'GET' },
    getIdToken
  );
  // La route restituisce di norma { ok:true, row }
  if (data?.ok && data?.row) return data.row;
  // In altri casi potrebbe restituire direttamente l'oggetto
  return data ?? null;
}


// ---- SPEDIZIONI: lista "Le mie spedizioni" -------------------------------

/**
 * Carica la lista delle spedizioni passando dall'API Next /api/my-shipments.
 * Restituisce sempre un array in rows, anche in caso di errore.
 */
export async function getMyShipments(): Promise<{
  ok: boolean;
  rows: any[];
  error?: string;
  details?: string;
}> {
  try {
    const res = await fetch('/api/my-shipments', {
      method: 'GET',
      cache: 'no-store',
    });

    const json = (await res.json().catch(() => null)) as
      | { ok: boolean; rows: any[]; error?: string; details?: string }
      | null;

    if (!res.ok || !json) {
      return {
        ok: false,
        rows: [],
        error: 'HTTP_ERROR',
        details: `status ${res.status}`,
      };
    }

    return {
      ok: json.ok,
      rows: Array.isArray(json.rows) ? json.rows : [],
      error: json.error,
      details: json.details,
    };
  } catch (e: any) {
    console.error('[getMyShipments] fetch error:', e);
    return {
      ok: false,
      rows: [],
      error: 'NETWORK_ERROR',
      details: e?.message ?? String(e),
    };
  }
}
