// Equipment — Grouped by category with condition tracking & AI upgrade suggestions.
// Rackets also carry their stringing: what is in the frame now (kg, with pounds
// beside it), a Restring action, and the history — see components/equipment.
// Each item can carry the few category-specific facts a coach asks about
// (lib/equipment/specs), the date it was acquired, and one photo that only
// the player sees. A STRING is a set or a reel (lib/equipment/bag): reels
// show what is left on them, and anything used up drops into a collapsed
// group at the bottom of the Strings section.
import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import {
  useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, useStringSetups,
  useUploadEquipmentPhoto, useRemoveEquipmentPhoto,
} from "@/hooks/api/queries";
import { tList, useT } from "@/lib/i18n";
import { ErrorState, EmptyState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/responsive-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Package, Pencil, Plus, Trash2, ChevronDown, Lightbulb,
} from "lucide-react";
import type { EquipmentCategory, EquipmentItem, ShoeSurface, StringForm } from "@/types";
import { CATEGORY_CONFIG, CATEGORY_ORDER, CONDITION_DOT, CONDITION_STYLES, categoryLabel, categoryPlural, conditionLabel, getConditionLevel } from "@/components/equipment/categories";
import { RacketStringing } from "@/components/equipment/RacketStringing";
import { EquipmentPhoto } from "@/components/equipment/EquipmentPhoto";
import { EquipmentPhotoField } from "@/components/equipment/EquipmentPhotoField";
import { StringFormPill, StringItemRow } from "@/components/equipment/StringItemRow";
import { SPEC_FIELDS, SURFACES, formToSpecs, specChips, specsToForm, type SpecsForm } from "@/lib/equipment/specs";
import { DEFAULT_LENGTH_M, isUsedUp } from "@/lib/equipment/bag";

const STRING_FORMS: StringForm[] = ["set", "reel"];
/** Metres on a new set or reel; the same bound the server enforces. */
const STRING_LENGTH_MAX_M = 300;

/** "12" / "200" → metres, null when empty, NaN when unusable. */
function parseStringLength(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > STRING_LENGTH_MAX_M) return Number.NaN;
  return n;
}

interface FormState {
  name: string;
  category: EquipmentCategory;
  brand: string;
  model: string;
  condition: string;
  acquiredDate: string;
  notes: string;
  specs: SpecsForm;
  /** Strings only: set or reel, and the metres on it. */
  stringForm: StringForm;
  stringLength: string;
}

const EMPTY_FORM: FormState = { name: "", category: "racket", brand: "", model: "", condition: "", acquiredDate: "", notes: "", specs: {}, stringForm: "set", stringLength: String(DEFAULT_LENGTH_M.set) };

// ─── AI Upgrade Suggestions ───

function getUpgradeSuggestions(items: EquipmentItem[]): { category: EquipmentCategory; itemName: string; suggestions: string[] }[] {
  const results: { category: EquipmentCategory; itemName: string; suggestions: string[] }[] = [];
  for (const item of items) {
    const level = getConditionLevel(item.category, item.condition);
    if (level === "poor" || level === "fair") {
      results.push({
        category: item.category,
        itemName: item.name,
        suggestions: tList(`equipment.upgrade.${item.category}`),
      });
    }
  }
  return results;
}

// ─── Main Page ───

export default function EquipmentPage() {
  const { t, locale, formatDate, formatNumber } = useT();
  const { user } = useAuth();
  const playerId = user?.id ?? "";
  const { data: items = [], isLoading, error, refetch } = useEquipment(playerId);
  const { data: setups = [] } = useStringSetups(playerId);
  const createMut = useCreateEquipment();
  const updateMut = useUpdateEquipment();
  const deleteMut = useDeleteEquipment();
  const uploadPhoto = useUploadEquipmentPhoto();
  const removePhoto = useRemoveEquipmentPhoto();
  const [addOpen, setAddOpen] = useState(false);
  /** The item being edited, or null when the dialog is adding a new one. */
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<EquipmentCategory>>(new Set(CATEGORY_ORDER));
  const [usedOpen, setUsedOpen] = useState(false);
  const [lengthError, setLengthError] = useState<string | null>(null);

  // Group items by category
  const grouped = useMemo(() => {
    const map: Record<EquipmentCategory, EquipmentItem[]> = { racket: [], string: [], shoes: [], balls: [], accessories: [] };
    items.forEach((item) => map[item.category]?.push(item));
    return map;
  }, [items]);

  // AI suggestions for items in poor/fair condition
  const aiSuggestions = useMemo(() => {
    // The suggestion text itself is translated inside the helper.
    void locale;
    return getUpgradeSuggestions(items);
  }, [items, locale]);

  const toggleGroup = (cat: EquipmentCategory) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const closeDialog = () => {
    setAddOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setPendingPhoto(null);
    setUploadPercent(null);
    setLengthError(null);
  };

  const handleSave = async () => {
    // A string is a set or a reel with a length; the server refuses these
    // fields on any other category, so they are only sent for strings.
    let stringFields: { stringForm: StringForm; stringLengthM: number } | undefined;
    if (form.category === "string") {
      const m = parseStringLength(form.stringLength);
      if (m === null || Number.isNaN(m)) {
        setLengthError(t("equipment.bag.lengthError", { max: STRING_LENGTH_MAX_M }));
        return;
      }
      stringFields = { stringForm: form.stringForm, stringLengthM: m };
    }
    setLengthError(null);
    const data = {
      name: form.name.trim(), category: form.category,
      brand: form.brand.trim() || undefined, model: form.model.trim() || undefined,
      condition: form.condition || undefined, notes: form.notes.trim() || undefined,
      acquiredDate: form.acquiredDate || undefined,
      // null clears what an earlier edit set; the server drops it from the row.
      specs: formToSpecs(form.category, form.specs),
      ...stringFields,
    };
    try {
      let id = editing?.id;
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, playerId, data });
      } else {
        const created = await createMut.mutateAsync({ playerId, ...data });
        id = created.data.id;
      }
      // The photo goes up after the row exists, so a new item has an id to hang it on.
      if (pendingPhoto && id) {
        setUploadPercent(0);
        await uploadPhoto.mutateAsync({ id, playerId, file: pendingPhoto, onProgress: (f) => setUploadPercent(Math.round(f * 100)) });
      }
      closeDialog();
    } catch {
      // The hooks already showed the error toast; keep what was typed.
      setUploadPercent(null);
    }
  };

  const openAddDialog = (category?: EquipmentCategory) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: category ?? "racket" });
    setPendingPhoto(null);
    setAddOpen(true);
  };

  const openEditDialog = (item: EquipmentItem) => {
    setEditing(item);
    // A legacy string row (no form yet) opens as a set of the length its old
    // spec recorded, so saving it once brings it into the bag.
    const stringForm: StringForm = item.stringForm ?? "set";
    const legacyLength = item.specs?.setLengthM;
    setForm({
      name: item.name, category: item.category, brand: item.brand ?? "", model: item.model ?? "",
      condition: item.condition ?? "", acquiredDate: item.acquiredDate ?? "", notes: item.notes ?? "",
      specs: specsToForm(item.specs ?? undefined),
      stringForm,
      stringLength: String(item.stringLengthM ?? legacyLength ?? DEFAULT_LENGTH_M[stringForm]),
    });
    setPendingPhoto(null);
    setAddOpen(true);
  };

  /** Name from brand and model when the player has not typed one — one less field to fill. */
  const suggestName = () => {
    setForm((f) => (f.name.trim() ? f : { ...f, name: [f.brand.trim(), f.model.trim()].filter(Boolean).join(" ") }));
  };

  const saving = createMut.isPending || updateMut.isPending || uploadPhoto.isPending;

  if (!user || isLoading) return <PageSkeleton variant="cards" />;
  if (error) return <ErrorState error={error} message={t("states.load.equipment")} onRetry={() => void refetch()} />;

  const currentConditions = CATEGORY_CONFIG[form.category].conditions;
  const specFields = SPEC_FIELDS[form.category];
  // The edited item, refreshed from the list so a removed or replaced photo shows at once.
  const editingLive = editing ? items.find((i) => i.id === editing.id) ?? editing : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("equipment.title")}</h1>
          <p className="text-muted-foreground">{t("equipment.subtitle")}</p>
        </div>
        <Button className="gap-2 self-start" onClick={() => openAddDialog()}>
          <Plus className="h-4 w-4" /> {t("equipment.addItem")}
        </Button>
      </div>

      {/* AI Upgrade Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary dark:text-primary">
            <Lightbulb className="h-4 w-4" />
            {t("equipment.recommendations")}
          </div>
          <div className="space-y-3">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">
                  <Badge variant="outline" className={`mr-2 text-[10px] ${CONDITION_STYLES[getConditionLevel(s.category, undefined)]}`}>
                    {categoryLabel(s.category)}
                  </Badge>
                  {s.itemName}
                  <span className={`ml-2 inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${CONDITION_STYLES.poor}`}>{t("equipment.needsAttention")}</span>
                </p>
                <ul className="space-y-1 pl-4">
                  {s.suggestions.slice(0, 2).map((tip, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped equipment */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6 text-muted-foreground" />}
          title={t("empty.equipment.title")}
          description={t("empty.equipment.description")}
          action={<Button onClick={() => openAddDialog()} className="gap-1.5"><Plus className="h-4 w-4" /> {t("empty.equipment.action")}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {CATEGORY_ORDER.map((cat) => {
            const catItems = grouped[cat];
            const cfg = CATEGORY_CONFIG[cat];
            if (catItems.length === 0) return null;
            const isOpen = openGroups.has(cat);
            // A used-up set or reel leaves the working list but stays reachable.
            const usedItems = cat === "string" ? catItems.filter(isUsedUp) : [];
            const activeItems = cat === "string" ? catItems.filter((i) => !isUsedUp(i)) : catItems;

            return (
              <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleGroup(cat)}>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-accent/10">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{cfg.icon}</div>
                        <span className="text-sm font-semibold text-foreground">{categoryPlural(cat)}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{activeItems.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={(e) => { e.stopPropagation(); openAddDialog(cat); }}>
                          <Plus className="h-3 w-3" /> {t("equipment.add2")}
                        </Button>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border divide-y divide-border">
                      {activeItems.map((item) => {
                        const level = getConditionLevel(item.category, item.condition);
                        const chips = specChips(item.category, item.specs ?? undefined, t, formatNumber);
                        return (
                          <div key={item.id} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/5">
                            <EquipmentPhoto item={item} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-medium text-foreground truncate">{item.name}</h3>
                                {item.category === "string" && <StringFormPill item={item} />}
                                {item.condition && (
                                  <span className={`inline-flex rounded-full border px-2 py-0 text-[10px] font-medium ${CONDITION_STYLES[level]}`}>
                                    {conditionLabel(item.category, item.condition)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {item.brand && <span>{item.brand}</span>}
                                {item.brand && item.model && <span>·</span>}
                                {item.model && <span>{item.model}</span>}
                                {item.acquiredDate && <span>· {t("equipment.row.since", { date: formatDate(new Date(`${item.acquiredDate}T00:00:00`), { month: "short", year: "numeric" }) })}</span>}
                                {item.notes && <span className="text-muted-foreground/60">— {item.notes}</span>}
                              </div>
                              {chips.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {chips.map((chip) => (
                                    <Badge key={chip} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{chip}</Badge>
                                  ))}
                                </div>
                              )}
                              {item.category === "string" && <StringItemRow item={item} setups={setups} className="mt-2" />}
                              {item.category === "racket" && (
                                <RacketStringing racket={item} setups={setups} canEdit className="mt-2" />
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("equipment.editAria", { name: item.name })} onClick={() => openEditDialog(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={t("equipment.deleteAria", { name: item.name })} onClick={() => deleteMut.mutate({ id: item.id, playerId })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {usedItems.length > 0 && (
                        <div>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between bg-muted/40 px-5 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
                            aria-expanded={usedOpen}
                            onClick={() => setUsedOpen((o) => !o)}
                          >
                            <span>{t("equipment.bag.usedGroup", { count: usedItems.length })}</span>
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${usedOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                          </button>
                          {usedOpen && (
                            <div className="divide-y divide-border bg-muted/20">
                              {usedItems.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 px-5 py-2.5 text-muted-foreground">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="truncate text-sm">{item.name}</h3>
                                      <StringFormPill item={item} />
                                    </div>
                                    <StringItemRow item={item} setups={setups} className="mt-1.5" />
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" aria-label={t("equipment.deleteAria", { name: item.name })} onClick={() => deleteMut.mutate({ id: item.id, playerId })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Add / edit Equipment Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setAddOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("equipment.edit.title") : t("equipment.add.title")}</DialogTitle>
            <DialogDescription>{editing ? t("equipment.edit.description") : t("equipment.add.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="equipment-category">{t("equipment.add.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as EquipmentCategory, condition: "", specs: {} }))}>
                <SelectTrigger id="equipment-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">{CATEGORY_CONFIG[c].icon}{categoryLabel(c)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "string" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="equipment-string-form">{t("equipment.bag.formLabel")}</Label>
                  <Select
                    value={form.stringForm}
                    onValueChange={(v) => {
                      const next = v as StringForm;
                      // Swap the default length with the form unless the player typed their own.
                      setForm((f) => ({
                        ...f,
                        stringForm: next,
                        stringLength: f.stringLength === String(DEFAULT_LENGTH_M[f.stringForm]) || !f.stringLength ? String(DEFAULT_LENGTH_M[next]) : f.stringLength,
                      }));
                    }}
                  >
                    <SelectTrigger id="equipment-string-form"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STRING_FORMS.map((f) => (
                        <SelectItem key={f} value={f}>{t(`equipment.bag.form.${f}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="equipment-string-length">{t("equipment.bag.length")}</Label>
                  <Input id="equipment-string-length" inputMode="decimal" value={form.stringLength} onChange={(e) => setForm((f) => ({ ...f, stringLength: e.target.value }))} />
                  {lengthError ? (
                    <p className="text-xs text-destructive">{lengthError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t(`equipment.bag.lengthHint.${form.stringForm}`)}</p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="equipment-brand">{t("equipment.add.brand")}</Label>
                <Input id="equipment-brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} onBlur={suggestName} placeholder={t("equipment.add.brandPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="equipment-model">{t("equipment.add.model")}</Label>
                <Input id="equipment-model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} onBlur={suggestName} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-name">{t("equipment.add.name")}</Label>
              <Input id="equipment-name" aria-required="true" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("equipment.add.namePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="equipment-condition">{t("equipment.add.condition")}</Label>
                <Select value={form.condition} onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}>
                  <SelectTrigger id="equipment-condition"><SelectValue placeholder={t("equipment.add.conditionPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {currentConditions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${CONDITION_DOT[c.level]}`} aria-hidden="true" />
                          {conditionLabel(form.category, c.value)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="equipment-acquired">{t("equipment.add.acquired")}</Label>
                <Input id="equipment-acquired" type="date" value={form.acquiredDate} onChange={(e) => setForm((f) => ({ ...f, acquiredDate: e.target.value }))} />
              </div>
            </div>

            {specFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">{t("equipment.add.details")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {specFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`equipment-spec-${field.key}`}>{t(`equipment.specs.label.${field.key}`)}</Label>
                      {field.kind === "surface" ? (
                        <Select value={form.specs.surface ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, specs: { ...f.specs, surface: v as ShoeSurface } }))}>
                          <SelectTrigger id={`equipment-spec-${field.key}`}><SelectValue placeholder={t("equipment.specs.surfacePlaceholder")} /></SelectTrigger>
                          <SelectContent>
                            {SURFACES.map((s) => (
                              <SelectItem key={s} value={s}>{t(`equipment.surface.${s}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`equipment-spec-${field.key}`}
                          inputMode={field.kind === "number" ? "decimal" : undefined}
                          value={form.specs[field.key] ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, specs: { ...f.specs, [field.key]: e.target.value } }))}
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="equipment-notes">{t("equipment.add.notes")}</Label>
              <Input id="equipment-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("equipment.add.notesPlaceholder")} />
            </div>

            <EquipmentPhotoField
              item={editingLive}
              pending={pendingPhoto}
              onChoose={setPendingPhoto}
              onRemoveExisting={editingLive?.photoId ? () => removePhoto.mutate({ id: editingLive.id, playerId }) : undefined}
              removing={removePhoto.isPending}
              uploadPercent={uploadPercent}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={() => void handleSave()} disabled={!form.name.trim() || saving}>
              {editing
                ? (saving ? t("equipment.edit.saving") : t("equipment.edit.submit"))
                : (saving ? t("equipment.add.adding") : t("equipment.add.submit"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
