// ============================================================================
// The i18n ratchet.
//
// Every user-visible string in `src/pages/**` and `src/components/**` has to go
// through `t()`. This test parses each .tsx file and fails on a capitalised JSX
// text node, a capitalised `placeholder` / `aria-label` / `title` / `alt` /
// `label` attribute, or a capitalised string literal rendered inside a JSX
// expression — the three shapes a forgotten English string actually takes.
//
// Two escape hatches, both deliberately small and both justified below:
// `ALLOWED_FILES` (whole files that are not ours to translate) and
// `ALLOWED_STRINGS` (literals that are the same in every language).
//
// Adding to either list is a decision, not a chore. If you find yourself
// wanting to, the string almost certainly belongs in src/locales/*.json.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const SCANNED_DIRS = ["src/pages", "src/components", "src/layouts"];

/**
 * Files exempt as a whole. Every entry needs a reason that is about ownership
 * or dead code — "it has a lot of strings" is not a reason.
 */
const ALLOWED_FILES = new Set<string>([
  // Owned by the landing/legal workstream, which is translating them on its own
  // branch. Delete these three lines once that work merges.
  "src/pages/Index.tsx",
  "src/pages/legal/PrivacyPolicyPage.tsx",
  "src/pages/legal/TermsPage.tsx",

  // Vendored shadcn/ui primitives that nothing in the app renders. They are
  // kept verbatim so a future `npx shadcn add` diff stays readable; translating
  // dead code would only make that diff worse. Anything here that starts being
  // used must be translated and removed from this list.
  "src/components/ui/pagination.tsx",
  "src/components/ui/sidebar.tsx",
  "src/components/ui/carousel.tsx",
  "src/components/ui/breadcrumb.tsx",
]);

/**
 * TEMPORARY. Files the i18n sweep has not reached yet, kept here only so the
 * suite is green at every commit while the sweep lands file by file. This set
 * MUST be empty before this branch merges — the assertion at the bottom of the
 * file enforces that it only ever shrinks.
 */
const MIGRATION_BACKLOG = new Set<string>([
  "src/components/PlayerDetailDrawer.tsx",
  "src/components/PlayerFilterSelect.tsx",
  "src/components/TeamFilterSelect.tsx",
  "src/components/calendar/AgendaView.tsx",
  "src/components/calendar/CalendarFilterMenus.tsx",
  "src/components/calendar/CalendarFiltersSheet.tsx",
  "src/components/calendar/CalendarLegend.tsx",
  "src/components/calendar/DayEventsSheet.tsx",
  "src/components/calendar/MiniMonthCalendar.tsx",
  "src/components/coach/EntityActionsMenu.tsx",
  "src/components/coach/PlayerTeamChips.tsx",
  "src/components/connections/NewConnectionDialog.tsx",
  "src/components/dashboard/IncomingRequestsCard.tsx",
  "src/components/dashboard/StatisticsSummaryCard.tsx",
  "src/components/equipment/PlayerEquipmentDrawer.tsx",
  "src/components/matches/MatchForm.tsx",
  "src/components/matches/MatchList.tsx",
  "src/components/matches/MatchStatsFields.tsx",
  "src/components/notifications/NotificationPreferencesCard.tsx",
  "src/components/onboarding/OnboardingDialog.tsx",
  "src/components/players/PlayerStatsDrawer.tsx",
  "src/components/search/CommandPalette.tsx",
  "src/components/search/SearchTrigger.tsx",
  "src/components/stats/ExpandableMatchRow.tsx",
  "src/components/stats/MatchDetailPanel.tsx",
  "src/components/stats/MetricTile.tsx",
  "src/components/stats/PerformanceTrendChart.tsx",
  "src/components/stats/RecentFormStrip.tsx",
  "src/components/stats/StatsWindowControl.tsx",
  "src/components/stats/SurfaceSplitList.tsx",
  "src/components/tournaments/AddToCalendarDialog.tsx",
  "src/components/tournaments/TournamentMap.tsx",
  "src/components/training/AttendanceRegister.tsx",
  "src/components/training/DiscardChangesDialog.tsx",
  "src/components/training/PlayerFeedbackDialog.tsx",
  "src/components/training/TrainingAdvicePanel.tsx",
  "src/components/training/TrainingReviewDialog.tsx",
  "src/pages/AdminPage.tsx",
  "src/pages/CalendarPage.tsx",
  "src/pages/ConnectionsPage.tsx",
  "src/pages/EquipmentPage.tsx",
  "src/pages/FinancePage.tsx",
  "src/pages/NotificationSettingsPage.tsx",
  "src/pages/NotificationsPage.tsx",
  "src/pages/PlayersPage.tsx",
  "src/pages/ProfilePage.tsx",
  "src/pages/SessionBuilderPage.tsx",
  "src/pages/StatsPage.tsx",
  "src/pages/TeamsPage.tsx",
  "src/pages/TournamentsPage.tsx",
  "src/pages/TrainingRequestsPage.tsx",
  "src/pages/TrainingsPage.tsx",
  "src/pages/matches/MatchesPage.tsx",
  "src/pages/trainingPlans/DrillCard.tsx",
  "src/pages/trainingPlans/PlanListItem.tsx",
  "src/pages/trainingPlans/TrainingPlanDetail.tsx",
  "src/pages/trainingPlans/TrainingPlansPage.tsx",
]);

/** How many files were still unmigrated when the ratchet was installed. */
const BACKLOG_HIGH_WATER_MARK = 58;

/**
 * Literals that read the same in English and Spanish: the product name, unit
 * symbols, and codes.
 */
const ALLOWED_STRINGS = new Set<string>([
  "TennisAI", // brand name — never translated
  "ITF", // governing body's abbreviation, used as a code
  "UTR", // rating system's abbreviation, used as a code
  "TennisAI Match", // calendar event title prefix; the brand carries it
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      walk(full, out);
    } else if (full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Attributes whose value is read out or shown to a person. */
const TEXT_ATTRIBUTES = new Set([
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "title",
  "alt",
  "label",
  "description",
]);

/**
 * Is this literal prose a reader would notice, rather than a class name, an id
 * or an enum value? Prose starts with a capital and has at least one space or
 * three letters; CONSTANT_CASE and single short words like "OK" are treated as
 * codes and left alone.
 */
function looksLikeProse(value: string): boolean {
  const text = value.trim();
  if (text.length < 3) return false;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(text)) return false;
  if (!/^[A-ZÁÉÍÓÚÑ]/.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false; // CONSTANT_CASE / codes
  return true;
}

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

function scanFile(absolute: string): Finding[] {
  const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
  const source = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];

  const record = (node: ts.Node, kind: string, text: string) => {
    const collapsed = text.trim().replace(/\s+/g, " ");
    if (ALLOWED_STRINGS.has(collapsed)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ file: relative, line: line + 1, kind, text: collapsed });
  };

  /** A string literal, or either branch of a ternary / `||` fallback around one. */
  const recordExpression = (expression: ts.Expression, kind: string, node: ts.Node) => {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      if (looksLikeProse(expression.text)) record(node, kind, expression.text);
    } else if (ts.isConditionalExpression(expression)) {
      recordExpression(expression.whenTrue, kind, node);
      recordExpression(expression.whenFalse, kind, node);
    } else if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      recordExpression(expression.right, kind, node);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (looksLikeProse(node.text)) record(node, "text", node.text);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      if (TEXT_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) {
          if (looksLikeProse(init.text)) record(node, name, init.text);
        } else if (ts.isJsxExpression(init) && init.expression) {
          recordExpression(init.expression, name, node);
        }
      }
    } else if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent) && node.expression) {
      recordExpression(node.expression, "expression", node);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

describe("no hard-coded user-visible strings", () => {
  const files = SCANNED_DIRS.flatMap((dir) => {
    const absolute = path.join(ROOT, dir);
    return fs.existsSync(absolute) ? walk(absolute) : [];
  });

  it("finds the files it is meant to be guarding", () => {
    // A broken path would make this suite pass vacuously, which is worse than
    // failing: it would quietly stop guarding anything.
    expect(files.length).toBeGreaterThan(150);
  });

  const relativeOf = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

  it("every JSX text node, label and rendered literal goes through t()", () => {
    const offenders = files
      .filter((file) => {
        const relative = relativeOf(file);
        return !ALLOWED_FILES.has(relative) && !MIGRATION_BACKLOG.has(relative);
      })
      .flatMap(scanFile)
      .map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`);
    expect(offenders).toEqual([]);
  });

  it("keeps the exemption lists small and deliberate", () => {
    // A ratchet only works while the escape hatch stays uncomfortable.
    expect(ALLOWED_FILES.size).toBeLessThanOrEqual(8);
    expect(ALLOWED_STRINGS.size).toBeLessThanOrEqual(10);
  });

  it("the migration backlog only ever shrinks", () => {
    expect(MIGRATION_BACKLOG.size).toBeLessThanOrEqual(BACKLOG_HIGH_WATER_MARK);
  });

  it("does not exempt a file that no longer exists", () => {
    const missing = [...ALLOWED_FILES, ...MIGRATION_BACKLOG].filter(
      (file) => !fs.existsSync(path.join(ROOT, file)),
    );
    expect(missing).toEqual([]);
  });

  it("does not keep a file on the backlog that is already clean", () => {
    // Stops the backlog from turning into a permanent allowlist by accident.
    const alreadyDone = [...MIGRATION_BACKLOG].filter(
      (relative) => scanFile(path.join(ROOT, relative)).length === 0,
    );
    expect(alreadyDone).toEqual([]);
  });
});
