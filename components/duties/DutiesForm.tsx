// File: components/duties/DutiesForm.tsx
"use client";

import { useState } from "react";

export default function DutiesForm() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateLink() {
    setLoading(true);
    setLink(null);

    const res = await fetch("/api/usa-shipping-pay/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        customerEmail: email,
        shipmentId,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.url) setLink(data.url);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-sm font-semibold">Customer Email</label>
        <input
          type="email"
          className="w-full p-3 rounded-lg bg-white text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
        />
      </div>

      <div>
        <label className="block mb-1 text-sm font-semibold">Amount (€)</label>
        <input
          type="number"
          className="w-full p-3 rounded-lg bg-white text-black"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 125"
        />
      </div>

      <div>
        <label className="block mb-1 text-sm font-semibold">Shipment ID (optional)</label>
        <input
          className="w-full p-3 rounded-lg bg-white text-black"
          value={shipmentId}
          onChange={(e) => setShipmentId(e.target.value)}
          placeholder="shipment-xyz"
        />
      </div>

      <button
        onClick={generateLink}
        disabled={loading}
        className="w-full bg-spst-orange py-3 rounded-lg text-black font-semibold hover:bg-orange-300"
      >
        {loading ? "Generating..." : "Generate Payment Link"}
      </button>

      {link && (
        <div className="mt-6 p-4 bg-white/10 border border-white/20 rounded-xl">
          <p className="mb-2 text-sm">Payment Link Generated:</p>
          <a href={link} target="_blank" className="underline break-words">
            {link}
          </a>
          <button
            className="mt-3 w-full bg-white/20 py-2 rounded-lg hover:bg-white/30"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}
