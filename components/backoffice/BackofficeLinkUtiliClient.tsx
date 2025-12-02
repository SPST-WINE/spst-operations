// components/backoffice/BackofficeLinkUtiliClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  UploadCloud,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

type Category = "internal_pricelist" | "external_pricelist" | "tutorial";

type BackofficeLink = {
  id: string;
  category: Category;
  label: string;
  description: string | null;
  url: string;
  sort_order: number;
  is_active: boolean;
};

type FormState = {
  label: string;
  url: string;
  description: string;
  sort_order: string;
};

const emptyForm: FormState = {
  label: "",
  url: "",
  description: "",
  sort_order: "",
};

const SUPABASE_BUCKET = "backoffice-docs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const folderByCategory: Record<Category, string> = {
  internal_pricelist: "internal",
  external_pricelist: "external",
  tutorial: "tutorials",
};

export default function BackofficeLinkUtiliClient() {
  const [rows, setRows] = useState<BackofficeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<Category | null>(
    null
  );

  const [selectedCategory, setSelectedCategory] =
    useState<Category>("internal_pricelist");

  const [formByCategory, setFormByCategory] = useState<
    Record<Category, FormState>
  >({
    internal_pricelist: { ...emptyForm },
    external_pricelist: { ...emptyForm },
    tutorial: { ...emptyForm },
  });

  const [editForm, setEditForm] = useState<FormState>({ ...emptyForm });

  // ----------- LOAD ------------------------------------------------------

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/backoffice/links", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (res.ok && json?.ok && Array.isArray(json.rows)) {
          setRows(json.rows as BackofficeLink[]);
        } else {
          setError(json?.error || "Errore nel caricamento dei link");
        }
      } catch (e: any) {
        if (!active) return;
        console.error("[BackofficeLinkUtiliClient] load error:", e);
        setError(e?.message || "Errore sconosciuto");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // ----------- DERIVATI PER CATEGORIA -----------------------------------

  const internalLinks = useMemo(
    () => rows.filter((r) => r.category === "internal_pricelist"),
    [rows]
  );
  const externalLinks = useMemo(
    () => rows.filter((r) => r.category === "external_pricelist"),
    [rows]
  );
  const tutorialLinks = useMemo(
    () => rows.filter((r) => r.category === "tutorial"),
    [rows]
  );

  // ----------- HELPERS --------------------------------------------------

  function handleChangeForm(
    category: Category,
    field: keyof FormState,
    value: string
  ) {
    setFormByCategory((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  }

  async function handleAdd(category: Category) {
    const form = formByCategory[category];
    if (!form.label.trim() || !form.url.trim()) {
      alert("Nome e URL sono obbligatori.");
      return;
    }

    const payload = {
      category,
      label: form.label.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      sort_order: form.sort_order ? Number(form.sort_order) : 100,
    };

    try {
      const res = await fetch("/api/backoffice/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !json.row) {
        throw new Error(json?.error || "Errore nel salvataggio");
      }

      setRows((prev) => [...prev, json.row as BackofficeLink]);
      setFormByCategory((prev) => ({
        ...prev,
        [category]: { ...emptyForm },
      }));
    } catch (e: any) {
      console.error("[BackofficeLinkUtiliClient] add error:", e);
      alert(e?.message || "Errore durante l'aggiunta del link");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sei sicuro di voler rimuovere questo link?")) return;

    try {
      const res = await fetch(`/api/backoffice/links/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Errore nella rimozione");
      }

      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      console.error("[BackofficeLinkUtiliClient] delete error:", e);
      alert(e?.message || "Errore durante la rimozione del link");
    }
  }

  async function handleCopy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyingId(id);
      setTimeout(() => setCopyingId((prev) => (prev === id ? null : prev)), 1500);
    } catch (e) {
      console.error("[BackofficeLinkUtiliClient] copy error:", e);
      alert("Impossibile copiare il link. Copialo manualmente.");
    }
  }

  function startEdit(row: BackofficeLink) {
    setEditingId(row.id);
    setEditForm({
      label: row.label,
      url: row.url,
      description: row.description || "",
      sort_order: row.sort_order?.toString() ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ ...emptyForm });
  }

  async function saveEdit(id: string) {
    if (!editForm.label.trim() || !editForm.url.trim()) {
      alert("Nome e URL sono obbligatori.");
      return;
    }

    const payload: any = {
      label: editForm.label.trim(),
      url: editForm.url.trim(),
      description: editForm.description.trim() || null,
    };

    if (editForm.sort_order) {
      payload.sort_order = Number(editForm.sort_order);
    }

    try {
      const res = await fetch(`/api/backoffice/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json.row) {
        throw new Error(json?.error || "Errore nel salvataggio");
      }

      setRows((prev) =>
        prev.map((r) => (r.id === id ? (json.row as BackofficeLink) : r))
      );
      cancelEdit();
    } catch (e: any) {
      console.error("[BackofficeLinkUtiliClient] edit error:", e);
      alert(e?.message || "Errore durante l'aggiornamento del link");
    }
  }

  // ----------- UPLOAD SU SUPABASE STORAGE -------------------------------

  async function handleFileChange(category: Category, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    try {
      setUploadingCategory(category);

      const folder = folderByCategory[category];
      const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
      const path = `${folder}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(path, file);

      if (uploadError) {
        console.error("[BackofficeLinkUtiliClient] upload error:", uploadError);
        alert("Errore nel caricamento del file su Supabase Storage.");
        return;
      }

      const { data: publicData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        alert("Impossibile ottenere la URL pubblica del file.");
        return;
      }

      // Precompiliamo URL e, se vuota, anche la label
      setFormByCategory((prev) => {
        const current = prev[category];
        const labelFromFile = file.name.replace(/\.[^/.]+$/, "");
        return {
          ...prev,
          [category]: {
            ...current,
            url: publicUrl,
            label: current.label || labelFromFile,
          },
        };
      });
    } catch (e: any) {
      console.error("[BackofficeLinkUtiliClient] upload unexpected:", e);
      alert(e?.message || "Errore imprevisto durante l'upload del file.");
    } finally {
      setUploadingCategory((prev) => (prev === category ? null : prev));
    }
  }

  // ----------- RENDER ---------------------------------------------------

  function renderSection(
    title: string,
    description: string,
    category: Category,
    items: BackofficeLink[]
  ) {
    const form = formByCategory[category];
    const isUploading = uploadingCategory === category;

    return (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-400" />
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
        </div>

        {/* Lista link */}
        <div className="mt-4 space-y-2">
          {items.length === 0 && (
            <p className="text-xs text-slate-400">
              Nessun link ancora presente.
            </p>
          )}

          {items.map((row) => {
            const isEditing = editingId === row.id;
            const shortUrl =
              row.url.length > 80 ? row.url.slice(0, 77) + "..." : row.url;

            if (isEditing) {
              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Nome documento"
                        value={editForm.label}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            label: e.target.value,
                          }))
                        }
                      />
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        placeholder="URL completo"
                        value={editForm.url}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            url: e.target.value,
                          }))
                        }
                      />
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Descrizione (opzionale)"
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2 md:w-40">
                      <input
                        type="number"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Ordine"
                        value={editForm.sort_order}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            sort_order: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(row.id)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white"
                        >
                          <Check className="h-3 w-3" />
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs shadow-sm md:flex-row md:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-slate-800">
                      {row.label}
                    </span>
                  </div>
                  {row.description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {row.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="truncate">{shortUrl}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end md:pl-3">
                  <a
                    href={row.url}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Apri
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(row.url, row.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    {copyingId === row.id ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copyingId === row.id ? "Copiato" : "Copia link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3 w-3" />
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Rimuovi
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form aggiunta rapida + upload */}
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Aggiungi nuovo link
          </h3>
          <div className="mt-2 flex flex-col gap-2 md:flex-row">
            <div className="flex-1 space-y-1">
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                placeholder="Nome documento (es. Listino Europa pallet)"
                value={form.label}
                onChange={(e) =>
                  handleChangeForm(category, "label", e.target.value)
                }
              />
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  placeholder="URL completo del PDF o del link (YouTube, ecc.)"
                  value={form.url}
                  onChange={(e) =>
                    handleChangeForm(category, "url", e.target.value)
                  }
                />
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 hover:bg-slate-50 cursor-pointer">
                      <UploadCloud className="h-3 w-3" />
                      <span>
                        {isUploading ? "Caricamento..." : "Carica file su Storage"}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) =>
                          handleFileChange(category, e.target.files)
                        }
                      />
                    </span>
                  </label>
                  {form.url && (
                    <span className="text-[10px] text-emerald-600">
                      URL compilato dal file o da input.
                    </span>
                  )}
                </div>
              </div>
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                placeholder="Descrizione (opzionale)"
                value={form.description}
                onChange={(e) =>
                  handleChangeForm(category, "description", e.target.value)
                }
              />
            </div>
            <div className="md:w-40 space-y-1">
              <input
                type="number"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                placeholder="Ordine (default 100)"
                value={form.sort_order}
                onChange={(e) =>
                  handleChangeForm(category, "sort_order", e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => handleAdd(category)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                disabled={isUploading}
              >
                <Plus className="h-3 w-3" />
                Aggiungi link
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        Caricamento link utili…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Errore: {error}
      </div>
    );
  }

  // Config per il menu/tab
  let currentTitle = "";
  let currentDescription = "";
  let currentItems: BackofficeLink[] = [];

  if (selectedCategory === "internal_pricelist") {
    currentTitle = "Listini interni";
    currentDescription =
      "Listini e documenti ad uso interno SPST (non condividere con i clienti).";
    currentItems = internalLinks;
  } else if (selectedCategory === "external_pricelist") {
    currentTitle = "Listini standard / esterni";
    currentDescription =
      "Listini di riferimento con prezzi standard validi per tutti i clienti.";
    currentItems = externalLinks;
  } else {
    currentTitle = "Tutorial & guide operative";
    currentDescription =
      "PDF interni e link esterni (YouTube, Loom, ecc.) per usare SPST e preparare pacchi/pallet.";
    currentItems = tutorialLinks;
  }

  return (
    <div className="space-y-4">
      {/* Menu a tab */}
      <div className="inline-flex rounded-full border bg-slate-50 p-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory("internal_pricelist")}
          className={`px-3 py-1.5 rounded-full transition ${
            selectedCategory === "internal_pricelist"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-white"
          }`}
        >
          Listini interni
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("external_pricelist")}
          className={`px-3 py-1.5 rounded-full transition ${
            selectedCategory === "external_pricelist"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-white"
          }`}
        >
          Listini standard / esterni
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("tutorial")}
          className={`px-3 py-1.5 rounded-full transition ${
            selectedCategory === "tutorial"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-700 hover:bg-white"
          }`}
        >
          Tutorial & guide
        </button>
      </div>

      {/* Sezione selezionata a tutta larghezza */}
      {renderSection(
        currentTitle,
        currentDescription,
        selectedCategory,
        currentItems
      )}
    </div>
  );
}
