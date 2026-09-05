// ============================================================
// What went wrong in ONE match — tagged by the player and their coach.
//
// Built for a tired player on a phone: tap the tag (one), optionally type a
// sentence, tap Save (two). On a touch screen the sentence + Save step lives
// in a bottom drawer so the thumb never leaves the bottom of the screen; on a
// desktop the same form unfolds inline under the tags. Everyone's entries are
// listed with who wrote them; only your own can be edited or removed.
//
// The "Summary" toggle shows the per-match summary the server computes from
// these same rows — counts per tag, who raised what, and one thing to work
// on. Deterministic: no model, no guessing, so it is safe to show to a child.
// ============================================================
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/auth/AuthContext";
import { useIsCoarsePointer } from "@/hooks/use-mobile";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  useAddMatchIssue, useDeleteMatchIssue, useMatchIssueSummary, useMatchIssues, useUpdateMatchIssue,
} from "@/hooks/api/matchIssues";
import { MATCH_ISSUE_NOTE_MAX, MATCH_ISSUE_TAGS, type MatchIssue, type MatchIssueTag } from "@/types/matchIssues";
import type { IssueAuthorRole, MatchIssueSummary } from "@/types";
import { issueTagLabel } from "./issueTagLabel";

type Translate = ReturnType<typeof useT>["t"];

/** What an entry being written or edited looks like before it is saved. */
interface EditorState {
  id?: string;
  tag: MatchIssueTag;
  note: string;
}

const CHIP =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors coarse:min-h-11 coarse:px-4 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function TagChips({ value, onPick, disabled }: { value: MatchIssueTag | null; onPick: (tag: MatchIssueTag) => void; disabled?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("matchIssues.pickTag")}>
      {MATCH_ISSUE_TAGS.map((tag) => {
        const active = value === tag;
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onPick(tag)}
            className={cn(
              CHIP,
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/40",
            )}
          >
            {issueTagLabel(t, tag)}
          </button>
        );
      })}
    </div>
  );
}

/** The sentence box + Save/Cancel. Shown inline on desktop, inside the drawer on touch. */
function NoteAndSave({
  editor, onChange, onSave, onCancel, busy,
}: {
  editor: EditorState;
  onChange: (note: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <Textarea
        value={editor.note}
        onChange={(e) => onChange(e.target.value.slice(0, MATCH_ISSUE_NOTE_MAX))}
        placeholder={t("matchIssues.notePlaceholder")}
        aria-label={t("matchIssues.noteLabel")}
        rows={2}
        maxLength={MATCH_ISSUE_NOTE_MAX}
        className="min-h-[3.5rem] resize-none text-base sm:text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{editor.note.length}/{MATCH_ISSUE_NOTE_MAX}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="coarse:min-h-11" onClick={onCancel} disabled={busy}>
            {t("matchIssues.cancel")}
          </Button>
          <Button type="button" size="sm" className="gap-1 coarse:min-h-11" onClick={onSave} disabled={busy}>
            <Check className="h-4 w-4" /> {t("matchIssues.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function authorLabel(t: Translate, issue: MatchIssue, currentUserId: string | undefined): string {
  if (issue.author.id === currentUserId) return t("matchIssues.you");
  const name = `${issue.author.firstName} ${issue.author.lastName}`.trim();
  return issue.author.role === "coach" ? t("matchIssues.coachName", { name }) : name;
}

function EntryRow({
  issue, mine, onEdit, onRemove, busy,
}: {
  issue: MatchIssue;
  mine: boolean;
  onEdit: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const label = issueTagLabel(t, issue.tag);
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{label}</span>
      <div className="min-w-0 flex-1">
        {issue.note && <p className="text-sm text-foreground">{issue.note}</p>}
        <p className="text-xs text-muted-foreground">
          {authorLabel(t, issue, user?.id)} · {format(parseISO(issue.createdAt), "d MMM, HH:mm")}
        </p>
      </div>
      {mine && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 coarse:h-11 coarse:w-11"
            aria-label={t("matchIssues.editAria", { tag: label })}
            onClick={onEdit}
            disabled={busy}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive coarse:h-11 coarse:w-11"
            aria-label={t("matchIssues.removeAria", { tag: label })}
            onClick={onRemove}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}

function roleWords(t: Translate, roles: IssueAuthorRole[]): string {
  if (roles.length === 2) return t("matchIssues.summary.both");
  if (roles[0] === "coach") return t("matchIssues.summary.byCoach");
  return t("matchIssues.summary.byPlayer");
}

function SummaryView({ summary }: { summary: MatchIssueSummary }) {
  const { t } = useT();
  if (summary.total === 0) {
    return <p className="text-sm text-muted-foreground">{t("matchIssues.summary.empty")}</p>;
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-1" aria-label={t("matchIssues.summary.byTagAria")}>
        {summary.byTag.map((row) => (
          <li key={row.tag} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{issueTagLabel(t, row.tag)}</span>
            <span className="text-xs text-muted-foreground">
              {t("matchIssues.summary.count", { count: row.count })} · {roleWords(t, row.raisedBy)}
            </span>
          </li>
        ))}
      </ul>
      {summary.focus && (
        <p className="border-l-2 border-primary pl-3 text-sm font-medium text-foreground">
          {summary.focus.agreedByBoth
            ? t("matchIssues.summary.workOnAgreed", { tag: issueTagLabel(t, summary.focus.tag) })
            : t("matchIssues.summary.workOnOne", { tag: issueTagLabel(t, summary.focus.tag) })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("matchIssues.summary.split", { player: summary.byAuthor.player.length, coach: summary.byAuthor.coach.length })}
      </p>
    </div>
  );
}

export interface MatchIssuesPanelProps {
  matchId: string;
  className?: string;
}

export function MatchIssuesPanel({ matchId, className }: MatchIssuesPanelProps) {
  const { t } = useT();
  const { user } = useAuth();
  const coarse = useIsCoarsePointer();

  const [view, setView] = useState<"notes" | "summary">("notes");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const issues = useMatchIssues(matchId);
  const summary = useMatchIssueSummary(matchId, view === "summary");
  const add = useAddMatchIssue();
  const update = useUpdateMatchIssue();
  const remove = useDeleteMatchIssue();
  const busy = add.isPending || update.isPending || remove.isPending;

  const close = () => setEditor(null);

  const pick = (tag: MatchIssueTag) => setEditor((e) => (e ? { ...e, tag } : { tag, note: "" }));

  const save = () => {
    if (!editor) return;
    const note = editor.note.trim();
    if (editor.id) {
      update.mutate({ id: editor.id, matchId, input: { tag: editor.tag, note: note ? note : null } }, { onSuccess: close });
    } else {
      add.mutate({ matchId, input: { tag: editor.tag, ...(note ? { note } : {}) } }, { onSuccess: close });
    }
  };

  const startEdit = (issue: MatchIssue) => setEditor({ id: issue.id, tag: issue.tag, note: issue.note ?? "" });

  const editorForm = editor && (
    <NoteAndSave editor={editor} onChange={(note) => setEditor({ ...editor, note })} onSave={save} onCancel={close} busy={busy} />
  );

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs font-medium transition-colors coarse:min-h-11",
      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
    );

  return (
    <section className={cn("space-y-3 border-t border-border pt-4", className)} aria-label={t("matchIssues.title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("matchIssues.title")}</h4>
          <p className="text-xs text-muted-foreground">{t("matchIssues.description")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="tablist" aria-label={t("matchIssues.viewAria")}>
          <button type="button" role="tab" aria-selected={view === "notes"} className={tabClass(view === "notes")} onClick={() => setView("notes")}>
            {t("matchIssues.tabs.notes")}
          </button>
          <button type="button" role="tab" aria-selected={view === "summary"} className={tabClass(view === "summary")} onClick={() => setView("summary")}>
            {t("matchIssues.tabs.summary")}
          </button>
        </div>
      </div>

      {view === "summary" ? (
        summary.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("matchIssues.loading")}</p>
        ) : summary.error || !summary.data ? (
          <p className="text-sm text-destructive">{t("matchIssues.error")}</p>
        ) : (
          <SummaryView summary={summary.data} />
        )
      ) : (
        <>
          {/* Add: tap a tag. On touch the sentence + Save open in a drawer; on desktop they unfold here. */}
          <TagChips value={editor && !editor.id ? editor.tag : null} onPick={pick} disabled={busy} />
          {!coarse && editor && !editor.id && editorForm}

          {issues.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("matchIssues.loading")}</p>
          ) : issues.error ? (
            <p className="text-sm text-destructive">{t("matchIssues.error")}</p>
          ) : (issues.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("matchIssues.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {(issues.data ?? []).map((issue) =>
                !coarse && editor?.id === issue.id ? (
                  <li key={issue.id} className="space-y-2 py-2">
                    <TagChips value={editor.tag} onPick={pick} disabled={busy} />
                    {editorForm}
                  </li>
                ) : (
                  <EntryRow
                    key={issue.id}
                    issue={issue}
                    mine={issue.author.id === user?.id}
                    onEdit={() => startEdit(issue)}
                    onRemove={() => remove.mutate({ id: issue.id, matchId })}
                    busy={busy}
                  />
                ),
              )}
            </ul>
          )}
        </>
      )}

      {/* Touch screens: the sentence + Save live in a bottom drawer. */}
      {coarse && (
        <Drawer open={Boolean(editor)} onOpenChange={(open) => { if (!open) close(); }}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{editor?.id ? t("matchIssues.editTitle") : t("matchIssues.title")}</DrawerTitle>
              <DrawerDescription>{t("matchIssues.drawerHint")}</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4">
              {editor && <TagChips value={editor.tag} onPick={pick} disabled={busy} />}
              {editorForm}
            </div>
            <DrawerFooter className="pt-2">
              <Button type="button" variant="ghost" className="coarse:min-h-11" onClick={close} aria-label={t("matchIssues.cancel")}>
                <X className="h-4 w-4" />
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </section>
  );
}
