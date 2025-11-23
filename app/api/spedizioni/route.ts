/* ───────────── POST /api/spedizioni ───────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).");
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const supabaseSrv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const supaAny = supabaseSrv as any;

    // ── USER / EMAIL ──────────────────────────────────────────────
    const accessToken = getAccessTokenFromRequest();
    const { data: userData } = accessToken
      ? await supabaseAuth.auth.getUser(accessToken)
      : ({ data: { user: null } } as any);

    const hdrs = nextHeaders();
    const emailFromHeaders =
      hdrs.get("x-user-email") ||
      hdrs.get("x-client-email") ||
      hdrs.get("x-auth-email") ||
      null;

    const emailRaw = firstNonEmpty(
      userData?.user?.email || null,
      emailFromHeaders,
      body.email,
      body.email_cliente,
      body?.mittente?.email,
      body?.destinatario?.email,
      body?.fatturazione?.email,
      body?.fields?.fatturazione?.email
    );
    const emailNorm = normalizeEmail(emailRaw);

    // ── PARTY / COLLIS ────────────────────────────────────────────
    const mitt: Party = body.mittente ?? {};
    const dest: Party = body.destinatario ?? {};
    const fatt: Party = body.fatturazione ?? body.fatt ?? {};

    const rawColli: any[] = Array.isArray(body.colli)
      ? body.colli
      : Array.isArray(body.colli_n)
      ? body.colli_n
      : [];
    const colli: Collo[] = rawColli.map((c: any) => ({
      l1: toNum(c.l1 ?? c.lunghezza_cm),
      l2: toNum(c.l2 ?? c.larghezza_cm),
      l3: toNum(c.l3 ?? c.altezza_cm),
      peso: toNum(c.peso ?? c.peso_kg),
      contenuto: c.contenuto ?? c.contenuto_colli ?? null,
      ...c,
    }));

    const colli_n: number | null = Array.isArray(colli) ? colli.length : null;
    const pesoTot = colli.reduce((sum, c) => sum + (toNum(c?.peso) || 0), 0);
    const peso_reale_kg =
      pesoTot > 0 ? Number(pesoTot.toFixed(3)) : toNum(body.peso_reale_kg);

    const giorno_ritiro = toISODate(body.ritiroData ?? body.giorno_ritiro);
    const incoterm =
      firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;
    const tipo_spedizione =
      firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;
    const dest_abilitato_import =
      typeof body.destAbilitato === "boolean"
        ? body.destAbilitato
        : typeof body.dest_abilitato_import === "boolean"
        ? body.dest_abilitato_import
        : null;
    const note_ritiro = body.ritiroNote ?? body.note_ritiro ?? null;

    // ── Mittente normalizzato ─────────────────────────────────────
    const mittente_paese = mitt.paese ?? body.mittente_paese ?? null;
    const mittente_citta = mitt.citta ?? body.mittente_citta ?? null;
    const mittente_cap = mitt.cap ?? body.mittente_cap ?? null;
    const mittente_indirizzo =
      mitt.indirizzo ?? body.mittente_indirizzo ?? null;

    const mittente_rs =
      mitt.ragioneSociale ??
      (mitt as any).ragione_sociale ??
      body.mittente_rs ??
      body.mittente_ragione ??
      body.mittente_ragione_sociale ??
      null;

    const mittente_telefono =
      mitt.telefono ?? body.mittente_telefono ?? null;

    const mittente_piva = mitt.piva ?? body.mittente_piva ?? null;

    // ── Destinatario normalizzato ─────────────────────────────────
    const dest_paese = dest.paese ?? body.dest_paese ?? null;
    const dest_citta = dest.citta ?? body.dest_citta ?? null;
    const dest_cap = dest.cap ?? body.dest_cap ?? null;

    const dest_rs =
      dest.ragioneSociale ??
      (dest as any).ragione_sociale ??
      body.dest_rs ??
      body.dest_ragione ??
      body.dest_ragione_sociale ??
      null;

    const dest_telefono = dest.telefono ?? body.dest_telefono ?? null;
    const dest_piva = dest.piva ?? body.dest_piva ?? null;

    // ── Fatturazione normalizzata ─────────────────────────────────
    const fatt_rs =
      fatt.ragioneSociale ??
      (fatt as any).ragione_sociale ??
      body.fatt_rs ??
      body.fatt_ragione ??
      body.fatt_ragione_sociale ??
      null;

    const fatt_piva = fatt.piva ?? body.fatt_piva ?? null;
    const fatt_valuta =
      (fatt as any).valuta ?? body.fatt_valuta ?? body.valuta ?? null;

    // ── Attachments (legacy JSON in tabella) ──────────────────────
    const attachments = body.attachments ?? body.allegati ?? {};
    const ldv = att(attachments.ldv ?? body.ldv);
    const fattura_proforma = att(
      attachments.fattura_proforma ?? body.fattura_proforma
    );
    const fattura_commerciale = att(
      attachments.fattura_commerciale ?? body.fattura_commerciale
    );
    const dle = att(attachments.dle ?? body.dle);
    const allegato1 = att(attachments.allegato1 ?? body.allegato1);
    const allegato2 = att(attachments.allegato2 ?? body.allegato2);
    const allegato3 = att(attachments.allegato3 ?? body.allegato3);
    const allegato4 = att(attachments.allegato4 ?? body.allegato4);

    // ── Fields “raw” salvati in JSONB ─────────────────────────────
    const fieldsSafe = (() => {
      const clone: any = JSON.parse(JSON.stringify(body ?? {}));
      const blocklist = [
        "colli_n",
        "colli",
        "peso_reale_kg",
        "giorno_ritiro",
        "incoterm",
        "incoterm_norm",
        "tipoSped",
        "tipo_spedizione",
        "dest_abilitato_import",
        "mittente_paese",
        "mittente_citta",
        "mittente_cap",
        "mittente_indirizzo",
        "dest_paese",
        "dest_citta",
        "dest_cap",
        "email",
        "email_cliente",
        "email_norm",
        "carrier",
        "service_code",
        "pickup_at",
        "tracking_code",
        "declared_value",
        "status",
        "human_id",
        "ldv",
        "fattura_proforma",
        "fattura_commerciale",
        "dle",
        "allegato1",
        "allegato2",
        "allegato3",
        "allegato4",
        "attachments",
        "allegati",
      ];
      for (const k of blocklist) delete clone[k];
      return clone;
    })();

    // ── Row principale per spst.shipments ─────────────────────────
    const baseRow: any = {
      email_cliente: emailRaw || null,
      email_norm: emailNorm,

      mittente_paese,
      mittente_citta,
      mittente_cap,
      mittente_indirizzo,
      mittente_rs,
      mittente_telefono,
      mittente_piva,

      dest_paese,
      dest_citta,
      dest_cap,
      dest_rs,
      dest_telefono,
      dest_piva,

      fatt_rs,
      fatt_piva,
      fatt_valuta,

      tipo_spedizione,
      incoterm,
      incoterm_norm: incoterm,
      dest_abilitato_import,
      note_ritiro,
      giorno_ritiro,
      peso_reale_kg,
      colli_n,

      carrier: body.carrier ?? null,
      service_code: body.service_code ?? null,
      pickup_at: body.pickup_at ?? null,
      tracking_code: body.tracking_code ?? null,
      declared_value: toNum(body.declared_value),
      status: body.status ?? "draft",

      fields: fieldsSafe,

      ldv,
      fattura_proforma,
      fattura_commerciale,
      dle,
      allegato1,
      allegato2,
      allegato3,
      allegato4,
    };

    // ── Genera human_id con retry su unique ───────────────────────
    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(supabaseSrv);
      const insertRow = { ...baseRow, human_id };

      const { data, error } = await supaAny
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select()
        .single();

      if (!error) {
        shipment = data;
        break;
      }
      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      } else {
        lastErr = error;
        break;
      }
    }

    if (!shipment) {
      console.error("[API/spedizioni] insert error:", lastErr);
      return NextResponse.json(
        {
          ok: false,
          error: "INSERT_FAILED",
          details: lastErr?.message || String(lastErr),
        },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── Insert colli in spst.packages ─────────────────────────────
    if (Array.isArray(colli) && colli.length > 0) {
      const pkgs = colli.map((c) => ({
        shipment_id: shipment.id,
        l1: toNum(c.l1 ?? c.lunghezza_cm),
        l2: toNum(c.l2 ?? c.larghezza_cm),
        l3: toNum(c.l3 ?? c.altezza_cm),
        weight_kg: toNum(c.peso ?? c.peso_kg),
        fields: c,
      }));
      const { error: pkgErr } = await supaAny
        .schema("spst")
        .from("packages")
        .insert(pkgs);
      if (pkgErr)
        console.warn(
          "[API/spedizioni] packages insert warning:",
          pkgErr.message
        );
    }

    const res = NextResponse.json({
      ok: true,
      shipment,
      id: shipment.human_id || shipment.id,
    });
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
