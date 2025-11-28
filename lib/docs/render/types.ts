// lib/docs/render/types.ts

export type DocItem = {
  description: string;
  bottles: number | null;
  volumePerBottleL: number | null;
  totalVolumeL: number | null;
  unitPrice: number | null;
  currency: string | null;
  lineTotal: number | null;
  itemType: string | null;
};

export type DocParty = {
  name: string | null;
  contact: string | null;
  address: {
    line1: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  vatNumber: string | null;
  phone: string | null;
};

export type DocData = {
  meta: {
    docType: string;
    docNumber: string;
    docDate: string;
    humanId: string | null | undefined;
    courier: string;
    trackingCode: string | null;
    incoterm: string | null;
    valuta: string | null;

    // 🔽 campi extra gestiti dall’editor lato client
    note?: string | null;          // note documento
    feePerRowEur?: number | null;  // fee per riga (es. 0.5)
  };
  parties: {
    shipper: DocParty;
    consignee: DocParty;
    billTo: DocParty;
  };
  shipment: {
    totalPackages: number | null;
    totalGrossWeightKg: number | null;
    contentSummary: string | null;
    pickupDate: string | null;
  };
  items: DocItem[];
  totals: {
    totalBottles: number;
    totalVolumeL: number | null;
    totalValue: number | null;
    currency: string | null;
  };
};
