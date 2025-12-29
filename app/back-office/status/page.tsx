"use client";

import { useMemo, useState } from "react";
import type { ShipmentStatus } from "@/lib/contracts/shipment";

const STATUSES: ShipmentStatus[] = [
  "CREATA",
  "IN RITIRO",
  "IN TRANSITO",
  "CONSEGNATA",
  "ECCEZIONE",
  "ANNULLATA",
];

type Ship = {
  id: string;
  human_id?: string | null;
  status?: ShipmentStatus | null;
  email_cliente?: string | null;
  giorno_ritiro?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;
};

export default function BackofficeStatusPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [ship, setShip] = useState<Ship | null>(null);
  const [status, setStatus] = useState<ShipmentStatus>("IN TRANSITO");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const canUpdate = useMemo(
    () => !!ship?.id && status.length > 0,
    [ship, status]
  );

  async function search() {
    setMsg(null);
    setLoading(true);
    setShip(null);

    try {
      // ⚠️ questa route DEVE essere staff (service role)
      const r = await fetch(
        `/api/backoffice/shipments/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const j = await r.json();

      if (!r.ok || !j.ok) {
        throw new Error(j?.details || j?.error || "Search failed");
      }

      const first = j?.rows?.[0] as Ship | undefined;
      if (!first) {
        setMsg("Nessuna spedizione trovata.");
        return;
      }

      setShip(first);
      setStatus((first.status || "IN TRANSITO") as ShipmentStatus);
    } catch (e: any) {
      setMsg(e?.message || "Errore ricerca.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus() {
    if (!ship?.id) return;
    setMsg(null);
    setLoading(true);

    try {
      const r = await fetch(
        `/api/backoffice/shipments/${ship.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, note }),
        }
      );

      const j = await r.json();
      if (!r.ok || !j.ok) {
        throw new Error(j?.details || j?.error || "Update failed");
      }

      setShip((prev) =>
        prev ? { ...prev, status: j.shipment.status } : prev
      );
      setMsg("✅ Status aggiornato.");
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Errore update."}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>
        Back Office • Update Status
      </h1>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 12,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Human ID, tracking, email cliente…"
          style={{
            flex: 1,
            height: 42,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: "0 12px",
          }}
        />
        <button
          onClick={search}
          disabled={loading || !q.trim()}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
          }}
        >
          Cerca
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#f3f4f6",
          }}
        >
          {msg}
        </div>
      )}

      {ship && (
        <div
          style={{
            marginTop: 20,
            padding: 18,
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {ship.human_id || ship.id}
          </div>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            {ship.email_cliente || "—"} • Ritiro:{" "}
            {ship.giorno_ritiro || "—"}
          </div>

          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
            {ship.carrier || "—"} • {ship.tracking_code || "—"}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, opacity: 0.7 }}>
              Nuovo status
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as ShipmentStatus)
              }
              style={{
                width: "100%",
                height: 42,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                padding: "0 10px",
                marginTop: 6,
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota interna (opzionale)"
              style={{
                width: "100%",
                marginTop: 10,
                minHeight: 90,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                padding: 10,
              }}
            />

            <button
              onClick={updateStatus}
              disabled={loading || !canUpdate}
              style={{
                marginTop: 12,
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "black",
                color: "white",
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Aggiorna status
            </button>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              Status attuale: <b>{ship.status || "—"}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
