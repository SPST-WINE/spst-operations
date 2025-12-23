⚠️ SPST OPERATIONS — BACKEND CONTRACT (FREEZE)

IMPORTANTE
Questo documento definisce il comportamento definitivo del dominio api/spedizioni.
Qualsiasi modifica che contraddice quanto scritto qui è da considerarsi BREAKING CHANGE
e NON VA INTRODOTTA senza versioning esplicito.

Questo README va considerato vincolante, non descrittivo.

🎯 OBIETTIVO

Garantire che:

il backend api/spedizioni sia stabile, prevedibile e congelato

il frontend possa evolvere liberamente senza rompere il core

DB, API e contratti abbiano responsabilità chiare

non esistano fallback, ambiguità o “magie”

🧠 PRINCIPIO FONDAMENTALE (DA MEMORIZZARE)

DATABASE = UNICA SOURCE OF TRUTH
API = ADAPTER
ZOD = CONTRATTO
FRONTEND = CONSUMATORE

Se una modifica viola questo principio, è sbagliata.

1️⃣ SOURCE OF TRUTH (ASSOLUTA)
📦 SPEDIZIONI

Fonte: spst.shipments

Contiene:

dati anagrafici spedizione

mittente / destinatario / fatturazione

stato, carrier, tracking

aggregati (colli_n, peso_reale_kg)

allegati

extras legacy (fields)

❌ NON è consentito:

ricostruire dati da frontend

usare fields come fallback per dati strutturati

📦 COLLI

Fonte: spst.packages (UNICA)

Colonne DB reali:

packages:
- id
- shipment_id
- contenuto
- weight_kg
- length_cm
- width_cm
- height_cm
- created_at


❌ NON ESISTONO nel DB:

peso_reale_kg

lato1_cm / lato2_cm / lato3_cm

👉 Questi nomi esistono SOLO a livello API/DTO.

⚖️ AGGREGATI

shipments.colli_n

shipments.peso_reale_kg

✔️ Aggiornati ESCLUSIVAMENTE da trigger DB
❌ Mai calcolati in API o frontend

📎 ALLEGATI

Fonte: colonne dedicate su spst.shipments

Esempio:

ldv

fattura_proforma

fattura_commerciale

dle

allegato1..4

❌ Nessun JSON dinamico
❌ Nessun fallback
✔️ Colonne esplicite

🧺 EXTRAS (LEGACY)

Fonte: shipments.fields
Esposto come: extras

✔️ Ammesso solo per:

packing list vino

metadata UI

dati documentali non normalizzati

❌ MAI:

colli

peso

dimensioni

dati core

2️⃣ RLS & OWNERSHIP
RLS ATTIVA SU:

spst.shipments

spst.packages

Ownership model
shipments.email_norm = lower(trim(email_cliente))

Client

✅ SELECT via RLS

✅ INSERT (solo via API, email forzata da sessione)

❌ UPDATE

❌ DELETE

Staff / Backoffice

sempre via service role

bypass RLS

protetto da requireStaff()

3️⃣ AUTENTICAZIONE

Supabase Auth

Cookie / session-based

Nessun header custom richiesto

❌ Non autenticato → 401 UNAUTHENTICATED

4️⃣ CONTRATTI (OBBLIGATORI)
📄 File
lib/contracts/shipment.ts

ShipmentInputZ

Contratto di ingresso

Descrive cosa il mondo esterno PUÒ inviare

❌ NON descrive il DB

❌ NON è source of truth

👉 Può avere nomi semantici (lato1_cm)
👉 L’API deve adattarli al DB

ShipmentDTO

UNICO output canonico

Regole:

packages → sempre array

attachments → shape fissa

extras → alias di fields

mai null dove è previsto array/oggetto

⚠️ REGOLA D’ORO SUI NOMI

MAI fare SELECT usando nomi DTO.
Le SELECT usano SOLO nomi DB.
La rimappatura avviene DOPO, in API.

5️⃣ ENDPOINTS CONGELATI
GET /api/spedizioni

Lista spedizioni

DTO-safe subset

packages: []

attachments vuoto

extras: null

POST /api/spedizioni

Crea spedizione

Input: ShipmentInputZ

Email cliente forzata da sessione

Inserisce:

shipments

packages (se presenti)

Trigger DB aggiorna aggregati

GET /api/spedizioni/:id

Dettaglio spedizione

Ritorna ShipmentDTO completo

packages popolato

extras popolato

PATCH /api/spedizioni/:id

Staff only

Update backoffice

❌ Nessun fallback legacy

GET /api/spedizioni/:id/colli

Source of truth: spst.packages

SELECT usa colonne DB

Output rimappato:

weight_kg → peso_reale_kg

length_cm → lato1_cm ecc.

PUT /api/spedizioni/:id/colli

Staff only

Replace totale:

delete

insert

Trigger DB aggiorna aggregati

GET /api/spedizioni/:id/attachments

Staff only

Ritorna colonne dedicate

PATCH /api/spedizioni/:id/attachments

Staff only

Whitelist rigida

❌ Nessun payload libero

6️⃣ COSA SI PUÒ TOCCARE (SICURO)

✅ Frontend (tutto):

pagine

UX

component

validazioni UI

adapter frontend → ShipmentInputZ

✅ API:

solo implementazione interna

mapping DB ↔ DTO

refactor codice

performance

✅ Extras:

aggiungere chiavi in extras

evolvere packing list

7️⃣ COSA NON SI PUÒ TOCCARE (VIETATO)

❌ Endpoint api/spedizioni (firma, comportamento)
❌ Shape di ShipmentDTO
❌ Source of truth
❌ RLS
❌ Ownership model
❌ Uso di fields come fallback
❌ Calcoli fuori dal DB

8️⃣ CHECKLIST PRIMA DI OGNI MODIFICA

 Sto usando il DB come unica verità?

 Sto usando nomi DB nelle SELECT?

 Sto rimappando i nomi solo in output?

 Sto rispettando ShipmentDTO?

 Sto evitando fallback legacy?

 Sto rispettando questo README?

Se anche una sola risposta è NO → fermati.

🧊 CONCLUSIONE

Questo documento è il Padre Nostro di SPST Operations.

Va letto

Va rispettato

Va incollato in ogni nuova chat

Va usato come filtro decisionale

Se una modifica “sembra comoda” ma viola questo README,
è sbagliata anche se funziona.
