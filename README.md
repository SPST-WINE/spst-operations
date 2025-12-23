⚠️ IMPORTANT
Questo documento definisce il comportamento definitivo delle API `api/spedizioni`.
Qualsiasi modifica che lo contraddice è da considerarsi un breaking change
e NON va introdotta senza versioning esplicito.

SPST Operations — API (Backend Freeze)

Versione: spst-freeze-backend-v1
Obiettivo: API stabili e prevedibili, con DB come source of truth e DTO unico come output.

Principi non negoziabili
Source of Truth

Spedizione: spst.shipments

Colli: spst.packages (unica fonte primaria)

Peso totale / numero colli: aggiornati da trigger DB su packages

Allegati: colonne dedicate su shipments (es: ldv, fattura_proforma, ecc.)

Legacy extras: shipments.fields → esposto come extras (solo alias, mai fallback)

RLS + Ownership

RLS attiva su:

spst.shipments

spst.packages

Owner model (client): email

shipments.email_norm = lower(trim(email_cliente))

policy client read: email_norm = lower(auth.jwt()->>'email')

Client:

✅ SELECT consentito via RLS

✅ INSERT consentito (ma via API forziamo email dalla sessione)

❌ UPDATE/DELETE non consentiti

Staff/backoffice:

Sempre tramite service role (bypass RLS) + guard requireStaff()

Autenticazione

Le API usano Supabase Auth via cookie/sessione.

Non autenticato → 401.

Contratti e DTO

File contratti:

lib/contracts/shipment.ts

ShipmentDTO (output canonico)

Tutte le GET di dettaglio devono tornare un ShipmentDTO completo.

Regole:

packages è sempre un array (mai null)

attachments ha sempre lo stesso shape (chiavi fisse, valori string/null)

extras è fields (alias), ma non viene usato come fallback

Nota: la lista ritorna un “subset DTO-safe”: stesso schema di chiavi principali ma packages: [], attachments vuoto (shape standard), extras: null.

Endpoints
1) GET /api/spedizioni

Lista spedizioni.

Accesso

Client: via RLS (vede solo le proprie)

Staff: vede tutto (service role)

Query params

q (string): ricerca su search_text (ilike trigram)

page (number, default 1)

limit (number, default 20, max 100)

sort = created_desc (default) | created_asc

email (staff only, opzionale): filtra per email_norm

Response (200)
{
  "ok": true,
  "page": 1,
  "limit": 20,
  "total": 123,
  "scope": "client",
  "rows": [
    {
      "id": "uuid",
      "human_id": "SP-2025-...",
      "created_at": "2025-12-23T...",
      "customer_id": null,
      "email_cliente": "buyer@email.com",
      "status": "draft",
      "carrier": null,
      "service_code": null,
      "tracking_code": null,
      "tipo_spedizione": "B2B",
      "incoterm": null,
      "declared_value": null,
      "fatt_valuta": "EUR",
      "giorno_ritiro": "2025-12-24",
      "pickup_at": null,
      "note_ritiro": null,
      "formato_sped": "PALLET",
      "contenuto_generale": null,
      "mittente": { "...": null },
      "destinatario": null,
      "fatturazione": null,
      "colli_n": 0,
      "peso_reale_kg": 0,
      "packages": [],
      "attachments": {
        "ldv": null,
        "fattura_proforma": null,
        "fattura_commerciale": null,
        "dle": null,
        "allegato1": null,
        "allegato2": null,
        "allegato3": null,
        "allegato4": null
      },
      "extras": null
    }
  ]
}

Errori

401 UNAUTHENTICATED

500 error DB/unexpected

2) POST /api/spedizioni

Crea una spedizione (bozza o completa).

Accesso

Client: consentito (email forzata da sessione)

Staff: consentito (può specificare email nel body; fallback su sessione)

Body (ShipmentInputZ)

email_cliente: NON required per client (viene forzata da sessione)

colli: può essere [] (bozza)

no fallback: fields.colli non esiste più come logica

Behavior

Inserisce spst.shipments

Inserisce spst.packages se colli.length > 0

Trigger DB aggiorna colli_n, peso_reale_kg su shipments

Response (201)
{ "ok": true, "shipment_id": "uuid" }

Errori

401 UNAUTHENTICATED

400 VALIDATION_ERROR

500 INSERT_FAILED

500 PACKAGES_INSERT_FAILED (shipment creato ma colli non inseriti)

3) GET /api/spedizioni/:id

Dettaglio spedizione.

Accesso

Client: via RLS (solo owner)

Staff: service role

Response (200)

Ritorna ShipmentDTO completo.

include packages popolato (source of truth)

include attachments shape standard

extras = alias di fields

Errori

401 UNAUTHENTICATED

404 NOT_FOUND (o “invisibile” via RLS)

500

4) PATCH /api/spedizioni/:id

Aggiornamento spedizione.

Accesso

Staff only

Client non può modificare (by design)

Note

Usato per backoffice (status, carrier, ecc).
Non deve introdurre fallback legacy.

5) GET /api/spedizioni/:id/colli

Legge i colli della spedizione.

Accesso

Client: via RLS (owner della shipment)

Staff: service role

Response (200)
{
  "ok": true,
  "shipment_id": "uuid",
  "packages": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "contenuto": "Vino",
      "peso_reale_kg": 10,
      "lato1_cm": 40,
      "lato2_cm": 30,
      "lato3_cm": 20,
      "created_at": "..."
    }
  ]
}

6) PUT /api/spedizioni/:id/colli

Sostituisce i colli (delete + insert).

Accesso

Staff only

Behavior

cancella tutti i packages per shipment

inserisce nuovi packages

trigger DB aggiorna colli_n / peso_reale_kg

7) GET /api/spedizioni/:id/attachments

Legge allegati.

Accesso

Staff only (freeze rule)

Response (200)
{
  "ok": true,
  "shipment_id": "uuid",
  "scope": "staff",
  "attachments": {
    "id": "uuid",
    "ldv": "https://...",
    "fattura_proforma": null,
    "fattura_commerciale": null,
    "dle": null,
    "allegato1": null,
    "allegato2": null,
    "allegato3": null,
    "allegato4": null
  }
}

8) PATCH /api/spedizioni/:id/attachments

Aggiorna SOLO colonne allegati (whitelist).

Accesso

Staff only

Body

Qualsiasi subset di:

ldv

fattura_proforma

fattura_commerciale

dle

allegato1..4

Errori

400 NO_ALLOWED_FIELDS

500 UPDATE_FAILED

Convenzioni di output
Lista vs dettaglio

Lista (GET /api/spedizioni): “DTO-safe subset”

packages: []

attachments presente con chiavi fisse

extras: null

Dettaglio (GET /api/spedizioni/:id): ShipmentDTO completo

packages popolato

extras popolato (alias di fields, se presente)

Env vars

Minime:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE (o SUPABASE_SERVICE_ROLE_KEY)

SUPABASE_URL (opzionale se già usi NEXT_PUBLIC_SUPABASE_URL)
