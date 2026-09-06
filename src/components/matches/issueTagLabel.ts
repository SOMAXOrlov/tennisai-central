// The words for a match-issue tag come from the locale file, never from the
// enum — `serve` is "Serve" in English and "Saque" in Spanish. One helper so
// the panel, the summary card and the toasts agree.
import type { t as translate } from "@/lib/i18n";
import type { MatchIssueTag } from "@/types/matchIssues";

export function issueTagLabel(t: typeof translate, tag: MatchIssueTag): string {
  return t(`matchIssues.tags.${tag}`);
}
