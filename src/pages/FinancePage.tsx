// Finance — the family ledger for one player: money in and out, a season
// budget by category, insights, and who else may see or change it.
//
// Who sees what is decided by the SERVER (finance/access.ts) and reported in
// the summary as `access`. This page only chooses which controls to draw:
//   owner     the player — everything, including the Access tab
//   full      a parent the player trusts with the whole ledger and the budget
//   add       a parent who records costs; may correct or remove their own rows
//   view      a parent who reads
//   coach     a connected coach — the Insights tab only, in aggregate scope
//
// MONEY IS NEVER CONVERTED. Every figure is shown in the currency it was
// logged in; the budget compares only with spend in its own currency.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { useT } from "@/lib/i18n";
import {
  useCreateFinanceEntry,
  useDeleteFinanceEntry,
  useFinanceAccess,
  useFinanceEntries,
  useFinanceInsights,
  useFinanceSummary,
  useRemoveFinanceAccess,
  useSaveFinanceBudget,
  useSetFinanceAccess,
  useUpdateFinanceEntry,
} from "@/hooks/api/queries";
import type { InsightsWindow } from "@/api/endpoints/finance";
import { ApiError } from "@/api/client";
import { ReadOnlyBanner, ReadOnlyBadge, ErrorState, EmptyState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { PlayerFilterSelect } from "@/components/PlayerFilterSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Scale, PiggyBank, Lock, Users, Lightbulb, AlertTriangle } from "lucide-react";
import type {
  FinanceAccessLevel,
  FinanceBudgetLine,
  FinanceBudgetStatus,
  FinanceCategory,
  FinanceEntry,
  FinanceEntryInput,
  FinanceGrantLevel,
  FinanceKind,
  FinanceSummary,
} from "@/types";
import { FINANCE_EXPENSE_CATEGORIES, FINANCE_INCOME_CATEGORIES } from "@/types";

const ALL_PLAYERS = "__all__";
const ENTRY_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK"];
const GRANT_LEVELS: FinanceGrantLevel[] = ["view", "add", "full"];

const today = () => new Date().toISOString().slice(0, 10);
const thisYear = () => String(new Date().getFullYear());

const canAdd = (a: FinanceAccessLevel) => a === "owner" || a === "full" || a === "add";
const canPlan = (a: FinanceAccessLevel) => a === "owner" || a === "full";
const canChange = (a: FinanceAccessLevel, e: FinanceEntry, userId: string) =>
  a === "owner" || a === "full" || (a === "add" && e.createdById === userId);

const STATUS_STYLE: Record<FinanceBudgetStatus, string> = {
  ok: "text-foreground",
  warning: "text-amber-700 dark:text-amber-400",
  over: "text-destructive",
  unplanned: "text-muted-foreground",
};

// ─── Entry form (add / edit) ─────────────────────────────────────────────────

type EntryForm = { kind: FinanceKind; category: FinanceCategory; description: string; amount: string; date: string; currency: string };

const emptyForm = (kind: FinanceKind = "expense"): EntryForm => ({
  kind,
  category: kind === "income" ? "prize_money" : "training",
  description: "",
  amount: "",
  date: today(),
  currency: "EUR",
});

function EntryDialog({
  open,
  onOpenChange,
  initial,
  editing,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EntryForm;
  editing: boolean;
  pending: boolean;
  onSubmit: (data: FinanceEntryInput) => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState<EntryForm>(initial);
  // Re-seed when the dialog opens for a different row.
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setForm(initial);
  }
  const categories = form.kind === "income" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
  const valid = form.description.trim().length > 0 && Number(form.amount) > 0 && !!form.date;

  const setKind = (kind: FinanceKind) =>
    setForm((f) => ({ ...f, kind, category: kind === "income" ? "prize_money" : "training" }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("finance.add.editTitle") : form.kind === "income" ? t("finance.add.incomeTitle") : t("finance.add.title")}</DialogTitle>
          <DialogDescription>{form.kind === "income" ? t("finance.add.incomeDescription") : t("finance.add.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("finance.add.kind")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as FinanceKind[]).map((k) => (
                <Button key={k} type="button" variant={form.kind === k ? "default" : "outline"} size="sm" onClick={() => setKind(k)} disabled={editing}>
                  {k === "expense" ? <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />}
                  {t(`finance.kind.${k}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-description">{t("finance.add.descriptionLabel")}</Label>
            <Input id="finance-description" aria-required="true" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={form.kind === "income" ? t("finance.add.incomePlaceholder") : t("finance.add.descriptionPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="finance-amount">{t("finance.add.amount")}</Label>
              <Input id="finance-amount" aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder={t("finance.add.amountPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-currency">{t("finance.add.currency")}</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger id="finance-currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="finance-category">{t("finance.add.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as FinanceCategory }))}>
                <SelectTrigger id="finance-category"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{t(`finance.category.${c}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-date">{t("finance.add.date")}</Label>
              <Input id="finance-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              onSubmit({ kind: form.kind, category: form.category, description: form.description.trim(), amount: parseFloat(form.amount), date: form.date, currency: form.currency })
            }
          >
            {pending ? t("finance.add.saving") : editing ? t("finance.add.editSubmit") : form.kind === "income" ? t("finance.add.incomeSubmit") : t("finance.add.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function BudgetLines({ lines, currency }: { lines: FinanceBudgetLine[]; currency: string }) {
  const { t, formatCurrency } = useT();
  return (
    <div className="space-y-3">
      {lines.map((l) => (
        <div key={l.category} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              {(l.status === "warning" || l.status === "over") && <AlertTriangle className={`h-3.5 w-3.5 ${STATUS_STYLE[l.status]}`} />}
              {t(`finance.category.${l.category}`)}
            </span>
            <span className={`text-xs ${STATUS_STYLE[l.status]}`}>
              {l.status === "unplanned"
                ? t("finance.budget.unplannedSpend", { spent: formatCurrency(l.spent, currency) })
                : t("finance.budget.lineProgress", { spent: formatCurrency(l.spent, currency), planned: formatCurrency(l.planned, currency) })}
            </span>
          </div>
          {l.planned > 0 && <Progress value={Math.min(100, (l.ratio ?? 0) * 100)} className="h-2" aria-label={t(`finance.category.${l.category}`)} />}
        </div>
      ))}
    </div>
  );
}

function Overview({ summary, entryCount }: { summary: FinanceSummary | undefined; entryCount: number }) {
  const { t, formatCurrency } = useT();
  const blocks = summary?.perCurrency ?? [];
  const budget = summary?.budget ?? null;

  if (!summary || (blocks.length === 0 && !budget)) {
    return (
      <p className="text-sm text-muted-foreground">
        {entryCount > 0 ? t("finance.overview.noSeasonData", { season: summary?.season?.label ?? thisYear() }) : t("finance.overview.nothingYet")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <div key={b.currency} className="space-y-3">
          {blocks.length > 1 && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{b.currency}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingUp className="h-4 w-4" /></div>
              <div><div className="text-lg font-bold text-foreground">{formatCurrency(b.income, b.currency)}</div><div className="text-xs text-muted-foreground">{t("finance.overview.income")}</div></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingDown className="h-4 w-4" /></div>
              <div><div className="text-lg font-bold text-foreground">{formatCurrency(b.expenses, b.currency)}</div><div className="text-xs text-muted-foreground">{t("finance.overview.expenses")}</div></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Scale className="h-4 w-4" /></div>
              <div><div className={`text-lg font-bold ${b.net < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(b.net, b.currency)}</div><div className="text-xs text-muted-foreground">{t("finance.overview.net")}</div></div>
            </div>
          </div>
          {Object.keys(b.byCategory).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(b.byCategory)
                .sort((x, y) => y[1] - x[1])
                .map(([cat, amount]) => (
                  <span key={cat} className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-foreground">
                    {t(`finance.category.${cat}`)} · {formatCurrency(amount, b.currency)}
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}

      {budget && (
        <DashboardCard
          title={t("finance.budget.title", { season: budget.season })}
          description={
            budget.totalPlanned > 0
              ? t("finance.budget.totalProgress", {
                  spent: formatCurrency(budget.totalSpent, budget.currency),
                  planned: formatCurrency(budget.totalPlanned, budget.currency),
                  remaining: formatCurrency(budget.totalRemaining, budget.currency),
                })
              : t("finance.budget.noLines")
          }
          icon={<PiggyBank className="h-4 w-4" />}
        >
          <BudgetLines lines={budget.progress} currency={budget.currency} />
          {budget.otherCurrencies.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t("finance.budget.otherCurrencies", {
                list: budget.otherCurrencies.map((o) => formatCurrency(o.expenses, o.currency)).join(", "),
              })}
            </p>
          )}
        </DashboardCard>
      )}
    </div>
  );
}

// ─── Entries ─────────────────────────────────────────────────────────────────

function EntriesTab({
  playerId,
  entries,
  access,
  userId,
}: {
  playerId: string;
  entries: FinanceEntry[];
  access: FinanceAccessLevel;
  userId: string;
}) {
  const { t, formatDate, formatCurrency } = useT();
  const [filter, setFilter] = useState<"all" | FinanceKind>("all");
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [deleting, setDeleting] = useState<FinanceEntry | null>(null);
  const updateMut = useUpdateFinanceEntry();
  const deleteMut = useDeleteFinanceEntry();

  const shown = useMemo(() => entries.filter((e) => filter === "all" || (e.kind ?? "expense") === filter), [entries, filter]);

  const editForm: EntryForm | null = editing
    ? { kind: editing.kind ?? "expense", category: editing.category, description: editing.description, amount: String(editing.amount), date: editing.date.slice(0, 10), currency: editing.currency }
    : null;

  return (
    <DashboardCard title={t("finance.transactions")} description={t("finance.entryCount", { count: shown.length })} icon={<Wallet className="h-4 w-4" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "expense", "income"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(f)}>
            {t(`finance.entries.filter.${f}`)}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("finance.entries.emptyFilter")}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((e) => {
            const income = (e.kind ?? "expense") === "income";
            const byOther = e.createdById && e.createdById !== playerId;
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("finance.entryMeta", { category: t(`finance.category.${e.category}`), date: formatDate(new Date(e.date), ENTRY_DATE) })}
                    {byOther && e.createdByName ? ` · ${t("finance.entries.recordedBy", { name: e.createdByName })}` : ""}
                  </p>
                </div>
                <span className={`font-semibold ${income ? "text-primary" : "text-foreground"}`}>
                  {income ? "+" : "−"}{formatCurrency(e.amount, e.currency)}
                </span>
                {canChange(access, e, userId) && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("finance.entries.edit")} onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={t("finance.entries.delete")} onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editForm && editing && (
        <EntryDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editForm}
          editing
          pending={updateMut.isPending}
          onSubmit={(data) => updateMut.mutate({ id: editing.id, playerId, data }, { onSuccess: () => setEditing(null) })}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("finance.entries.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && t("finance.entries.deleteBody", { description: deleting.description, amount: formatCurrency(deleting.amount, deleting.currency) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMut.mutate({ id: deleting.id, playerId }, { onSettled: () => setDeleting(null) })}
            >
              {t("finance.entries.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardCard>
  );
}

// ─── Budget ──────────────────────────────────────────────────────────────────

function BudgetTab({ playerId, summary, access }: { playerId: string; summary: FinanceSummary | undefined; access: FinanceAccessLevel }) {
  const { t, formatCurrency } = useT();
  const budget = summary?.budget ?? null;
  const saveMut = useSaveFinanceBudget();
  const [editing, setEditing] = useState(false);
  const [season, setSeason] = useState(budget?.season ?? summary?.season?.label ?? thisYear());
  const [currency, setCurrency] = useState(budget?.currency ?? "EUR");
  const [lines, setLines] = useState<Record<string, string>>(() =>
    Object.fromEntries(FINANCE_EXPENSE_CATEGORIES.map((c) => [c, budget?.lines[c] ? String(budget.lines[c]) : ""])),
  );

  const startEdit = () => {
    setSeason(budget?.season ?? summary?.season?.label ?? thisYear());
    setCurrency(budget?.currency ?? "EUR");
    setLines(Object.fromEntries(FINANCE_EXPENSE_CATEGORIES.map((c) => [c, budget?.lines[c] ? String(budget.lines[c]) : ""])));
    setEditing(true);
  };

  const save = () => {
    const parsed: Record<string, number> = {};
    for (const [c, v] of Object.entries(lines)) {
      const n = parseFloat(v);
      if (v.trim() && Number.isFinite(n) && n >= 0) parsed[c] = n;
    }
    saveMut.mutate({ playerId, data: { season: season.trim(), currency, lines: parsed } }, { onSuccess: () => setEditing(false) });
  };

  if (!editing) {
    if (!budget) {
      return (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6 text-muted-foreground" />}
          title={t("finance.budget.noneTitle")}
          description={canPlan(access) ? t("finance.budget.noneDescription") : t("finance.budget.noneReadOnly")}
          action={canPlan(access) ? <Button onClick={startEdit} className="gap-1.5"><Plus className="h-4 w-4" /> {t("finance.budget.create")}</Button> : undefined}
        />
      );
    }
    return (
      <DashboardCard
        title={t("finance.budget.title", { season: budget.season })}
        description={t("finance.budget.window", { start: budget.seasonStart, end: budget.seasonEnd, currency: budget.currency })}
        icon={<PiggyBank className="h-4 w-4" />}
        action={canPlan(access) ? <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> {t("finance.budget.edit")}</Button> : undefined}
      >
        <BudgetLines lines={budget.progress} currency={budget.currency} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border p-2"><div className="font-semibold text-foreground">{formatCurrency(budget.totalPlanned, budget.currency)}</div>{t("finance.budget.planned")}</div>
          <div className="rounded-lg border border-border p-2"><div className="font-semibold text-foreground">{formatCurrency(budget.totalSpent, budget.currency)}</div>{t("finance.budget.spent")}</div>
          <div className="rounded-lg border border-border p-2"><div className={`font-semibold ${budget.totalRemaining < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(budget.totalRemaining, budget.currency)}</div>{t("finance.budget.remaining")}</div>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={t("finance.budget.editTitle")} description={t("finance.budget.editDescription")} icon={<PiggyBank className="h-4 w-4" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="budget-season">{t("finance.budget.season")}</Label>
            <Input id="budget-season" value={season} onChange={(e) => setSeason(e.target.value)} placeholder={thisYear()} />
            <p className="text-[11px] text-muted-foreground">{t("finance.budget.seasonHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-currency">{t("finance.add.currency")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="budget-currency"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FINANCE_EXPENSE_CATEGORIES.map((c) => (
            <div key={c} className="space-y-1">
              <Label htmlFor={`budget-${c}`} className="text-xs">{t(`finance.category.${c}`)}</Label>
              <Input id={`budget-${c}`} type="number" min="0" step="1" inputMode="decimal" value={lines[c] ?? ""} onChange={(e) => setLines((l) => ({ ...l, [c]: e.target.value }))} placeholder="0" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saveMut.isPending || !/^\d{4}(\/\d{2})?$/.test(season.trim())}>{saveMut.isPending ? t("finance.budget.saving") : t("finance.budget.save")}</Button>
        </div>
      </div>
    </DashboardCard>
  );
}

// ─── Insights ────────────────────────────────────────────────────────────────

function InsightsTab({ playerId, aggregate }: { playerId: string; aggregate: boolean }) {
  const { t, formatCurrency, formatNumber } = useT();
  const [window, setWindow] = useState<InsightsWindow>("season");
  const { data, isLoading, error, refetch } = useFinanceInsights(playerId, window);

  if (isLoading) return <PageSkeleton variant="page" />;
  if (error) return <ErrorState error={error} message={t("states.load.finance")} onRetry={() => void refetch()} />;
  if (!data) return null;

  const hasAnything = data.tournaments.length > 0 || data.costPerTrainingHour || data.stringingPerHour || (data.headline?.entries ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{aggregate ? t("finance.insights.aggregateNote") : t("finance.insights.description")}</p>
        <Select value={window} onValueChange={(v) => setWindow(v as InsightsWindow)}>
          <SelectTrigger className="w-[160px]" aria-label={t("finance.insights.window.label")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["month", "season", "year"] as InsightsWindow[]).map((w) => <SelectItem key={w} value={w}>{t(`finance.insights.window.${w}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!hasAnything ? (
        <EmptyState icon={<Lightbulb className="h-6 w-6 text-muted-foreground" />} title={t("finance.insights.noDataTitle")} description={t("finance.insights.noDataDescription")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.headline && !aggregate && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("finance.insights.headline", { currency: data.headline.currency })}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(data.headline.total, data.headline.currency)}</p>
                <p className="text-xs text-muted-foreground">{t("finance.insights.previous", { amount: formatCurrency(data.headline.previousTotal, data.headline.currency) })}</p>
              </div>
            )}
            {data.costPerTrainingHour && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("finance.insights.costPerHour")}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(data.costPerTrainingHour.perHour, data.costPerTrainingHour.currency)}</p>
                <p className="text-xs text-muted-foreground">{t("finance.insights.costPerHourDetail", { hours: formatNumber(data.costPerTrainingHour.hours), sessions: data.costPerTrainingHour.sessions })}</p>
              </div>
            )}
            {data.stringingPerHour && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("finance.insights.stringingPerHour")}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(data.stringingPerHour.perHour, data.stringingPerHour.currency)}</p>
                <p className="text-xs text-muted-foreground">{t("finance.insights.stringingDetail", { jobs: data.stringingPerHour.jobs, hours: formatNumber(data.stringingPerHour.hours) })}</p>
              </div>
            )}
          </div>

          {data.tournaments.length > 0 && (
            <DashboardCard title={t("finance.insights.tournamentsTitle")} description={t("finance.insights.tournamentsDescription")} icon={<Wallet className="h-4 w-4" />}>
              <div className="space-y-2">
                {data.tournaments.map((tc) => (
                  <div key={tc.tournamentId} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{tc.name}</p>
                      <p className="text-xs text-muted-foreground">{tc.startDate.slice(0, 10)} → {tc.endDate.slice(0, 10)}</p>
                    </div>
                    <div className="text-right">
                      {tc.byCurrency.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t("finance.insights.noCostLogged")}</span>
                      ) : (
                        tc.byCurrency.map((c) => <p key={c.currency} className="text-sm font-semibold text-foreground">{formatCurrency(c.total, c.currency)}</p>)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}

          {!aggregate && (data.insights?.length ?? 0) > 0 && (
            <DashboardCard title={t("finance.insights.insightsTitle")} icon={<Lightbulb className="h-4 w-4" />}>
              <ul className="space-y-2">
                {data.insights!.map((i) => (
                  <li key={i.code} className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground">{i.textEn}</li>
                ))}
              </ul>
            </DashboardCard>
          )}
        </>
      )}
      <p className="text-[11px] text-muted-foreground">{t(`finance.insights.confidence.${data.confidence.level}`)}</p>
    </div>
  );
}

// ─── Access ──────────────────────────────────────────────────────────────────

function AccessTab({ playerId }: { playerId: string }) {
  const { t } = useT();
  const { data, isLoading, error, refetch } = useFinanceAccess(playerId);
  const setMut = useSetFinanceAccess();
  const removeMut = useRemoveFinanceAccess();
  const [pendingLevel, setPendingLevel] = useState<Record<string, FinanceGrantLevel>>({});

  if (isLoading) return <PageSkeleton variant="page" />;
  if (error) return <ErrorState error={error} message={t("states.load.finance")} onRetry={() => void refetch()} />;
  const grants = data?.grants ?? [];
  const eligible = data?.eligible ?? [];

  if (grants.length === 0 && eligible.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6 text-muted-foreground" />}
        title={t("finance.access.noneTitle")}
        description={t("finance.access.noneDescription")}
        action={<Button asChild variant="outline" className="gap-1.5"><Link to="/connections">{t("finance.access.noneAction")}</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("finance.access.description")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {GRANT_LEVELS.map((l) => (
          <div key={l} className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
            <p className="font-semibold text-foreground">{t(`finance.access.level.${l}`)}</p>
            <p className="text-muted-foreground">{t(`finance.access.levelHelp.${l}`)}</p>
          </div>
        ))}
      </div>

      {grants.length > 0 && (
        <DashboardCard title={t("finance.access.grantsTitle")} icon={<Lock className="h-4 w-4" />}>
          <div className="space-y-2">
            {grants.map((g) => (
              <div key={g.granteeId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <div><p className="text-sm font-medium text-foreground">{g.name}</p><p className="text-xs text-muted-foreground">{t(`common.role.${g.role}`)}</p></div>
                <div className="flex items-center gap-2">
                  <Select value={g.level} onValueChange={(v) => setMut.mutate({ playerId, granteeId: g.granteeId, level: v as FinanceGrantLevel })}>
                    <SelectTrigger className="w-[130px]" aria-label={t("finance.access.changeLevel", { name: g.name })}><SelectValue /></SelectTrigger>
                    <SelectContent>{GRANT_LEVELS.map((l) => <SelectItem key={l} value={l}>{t(`finance.access.level.${l}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={removeMut.isPending} onClick={() => removeMut.mutate({ playerId, granteeId: g.granteeId })}>
                    {t("finance.access.remove")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {eligible.length > 0 && (
        <DashboardCard title={t("finance.access.eligibleTitle")} description={t("finance.access.eligibleDescription")} icon={<Users className="h-4 w-4" />}>
          <div className="space-y-2">
            {eligible.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <div><p className="text-sm font-medium text-foreground">{u.name}</p><p className="text-xs text-muted-foreground">{t(`common.role.${u.role}`)}</p></div>
                <div className="flex items-center gap-2">
                  <Select value={pendingLevel[u.id] ?? "view"} onValueChange={(v) => setPendingLevel((p) => ({ ...p, [u.id]: v as FinanceGrantLevel }))}>
                    <SelectTrigger className="w-[130px]" aria-label={t("finance.access.chooseLevel", { name: u.name })}><SelectValue /></SelectTrigger>
                    <SelectContent>{GRANT_LEVELS.map((l) => <SelectItem key={l} value={l}>{t(`finance.access.level.${l}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" disabled={setMut.isPending} onClick={() => setMut.mutate({ playerId, granteeId: u.id, level: pendingLevel[u.id] ?? "view" })}>
                    {t("finance.access.grant")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { t } = useT();
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const role = user?.role ?? "player";
  const isObserver = role === "observer";
  const isCoach = role === "coach";
  const viewsOther = isObserver || isCoach;

  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const otherPlayerId = selectedPlayerId && selectedPlayerId !== ALL_PLAYERS ? selectedPlayerId : connectedPlayers[0]?.id ?? "";
  const playerId = !user ? "" : role === "player" ? user.id : otherPlayerId;

  // A coach never asks for the ledger: the server would refuse, and the
  // aggregate insights are the whole of what a coach is shown.
  const { data: entries = [], isLoading, error, refetch } = useFinanceEntries(isCoach ? "" : playerId);
  const { data: summary, refetch: refetchSummary } = useFinanceSummary(isCoach ? "" : playerId);
  const createMut = useCreateFinanceEntry();
  const [addOpen, setAddOpen] = useState<FinanceKind | null>(null);

  if (!user) return <PageSkeleton variant="page" />;

  const header = (badge?: boolean) => (
    <div>
      <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-foreground">{t("finance.title")}</h1>{badge && <ReadOnlyBadge />}</div>
      <p className="text-muted-foreground">{isCoach ? t("finance.coach.subtitle") : t("finance.subtitle")}</p>
    </div>
  );

  // Parent or coach with nobody connected yet — no player to show, no fake numbers.
  if (viewsOther && connectedPlayers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">{header(isObserver)}</div>
        {isObserver && <ReadOnlyBanner />}
        <EmptyState
          icon={<Wallet className="h-6 w-6 text-muted-foreground" />}
          title={t("empty.finance.noPlayers.title")}
          description={isCoach ? t("finance.coach.noPlayers") : t("empty.finance.noPlayers.description")}
          action={<Button asChild className="gap-1.5"><Link to="/connections">{t("empty.finance.noPlayers.action")}</Link></Button>}
        />
      </div>
    );
  }

  const playerSelect = viewsOther && connectedPlayers.length > 1 && (
    <PlayerFilterSelect players={connectedPlayers} value={selectedPlayerId || connectedPlayers[0]?.id || ALL_PLAYERS} onValueChange={setSelectedPlayerId} />
  );

  if (isCoach) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {header(true)}
          <div className="flex items-center gap-2 self-start">{playerSelect}</div>
        </div>
        <InsightsTab playerId={playerId} aggregate />
      </div>
    );
  }

  if (isLoading) return <PageSkeleton variant="page" />;

  // The server said no: the player has not granted this parent anything.
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {header(true)}
          <div className="flex items-center gap-2 self-start">{playerSelect}</div>
        </div>
        <EmptyState icon={<Lock className="h-6 w-6 text-muted-foreground" />} title={t("finance.noAccess.title")} description={t("finance.noAccess.description")} />
      </div>
    );
  }
  if (error) return <ErrorState error={error} message={t("states.load.finance")} onRetry={() => { void refetch(); void refetchSummary(); }} />;

  const access: FinanceAccessLevel = role === "player" ? "owner" : summary?.access ?? "view";
  const readOnly = access === "view";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {header(readOnly)}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {playerSelect}
          {canAdd(access) && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setAddOpen("income")}><TrendingUp className="h-4 w-4" /> {t("finance.addIncome")}</Button>
              <Button className="gap-2" onClick={() => setAddOpen("expense")}><Plus className="h-4 w-4" /> {t("finance.addExpense")}</Button>
            </>
          )}
        </div>
      </div>

      {isObserver && readOnly && <ReadOnlyBanner />}
      {isObserver && !readOnly && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">{t(`finance.access.yours.${access}`)}</p>
      )}

      {entries.length === 0 && !summary?.budget ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6 text-muted-foreground" />}
          title={t("empty.finance.title")}
          description={canAdd(access) ? t("empty.finance.player.description") : t("empty.finance.observer.description")}
          action={canAdd(access) ? <Button onClick={() => setAddOpen("expense")} className="gap-1.5"><Plus className="h-4 w-4" /> {t("empty.finance.player.action")}</Button> : undefined}
        />
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">{t("finance.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="entries">{t("finance.tabs.entries")}</TabsTrigger>
            <TabsTrigger value="budget">{t("finance.tabs.budget")}</TabsTrigger>
            <TabsTrigger value="insights">{t("finance.tabs.insights")}</TabsTrigger>
            {access === "owner" && <TabsTrigger value="access">{t("finance.tabs.access")}</TabsTrigger>}
          </TabsList>
          <TabsContent value="overview">
            {summary?.season && <p className="mb-3 text-xs text-muted-foreground">{t("finance.season", { season: summary.season.label, start: summary.season.start, end: summary.season.end })}</p>}
            <Overview summary={summary} entryCount={entries.length} />
          </TabsContent>
          <TabsContent value="entries"><EntriesTab playerId={playerId} entries={entries} access={access} userId={user.id} /></TabsContent>
          <TabsContent value="budget"><BudgetTab playerId={playerId} summary={summary} access={access} /></TabsContent>
          <TabsContent value="insights"><InsightsTab playerId={playerId} aggregate={false} /></TabsContent>
          {access === "owner" && <TabsContent value="access"><AccessTab playerId={playerId} /></TabsContent>}
        </Tabs>
      )}

      {addOpen && (
        <EntryDialog
          open
          onOpenChange={(v) => !v && setAddOpen(null)}
          initial={emptyForm(addOpen)}
          editing={false}
          pending={createMut.isPending}
          onSubmit={(data) => createMut.mutate({ playerId, data }, { onSuccess: () => setAddOpen(null) })}
        />
      )}
    </div>
  );
}
