// What the tournaments page has narrowed itself to, and how to get out of it.
//
// The owner's complaint was two things at once: the calendar was full of events
// that were not tournaments, and it showed all of them regardless of who was
// looking. This is the second half. The page opens on the viewer's own context —
// a player's country, a coach's players' countries — and this bar says so out
// loud, with one obvious way to see everything instead.
//
// It is a default, not a cage. Three rules it follows:
//
//   • Never scope silently. If the page is narrowed, the bar names the countries
//     it narrowed to.
//   • Never fail silently. When no default can be worked out, the bar says which
//     of the three reasons it is — nobody assigned yet, nobody has set a home
//     country, or a country nothing has been collected for — and offers to fix
//     the one that is fixable, right here.
//   • Never claim a filter that is not running. The squad's age bands are shown
//     with the reason they are NOT applied, because no event in the catalog
//     publishes an age band to compare them against.

import { useMemo, useState } from "react";
import { Globe, Info, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries, useSaveHomeCountry } from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import type { TournamentScope } from "@/api/endpoints/tournaments";
import type { ConnectedPlayer } from "@/types";

/** One row of "this player has not said where they compete — say it here". */
function SetHomeCountryRow({
  playerId,
  label,
  countries,
}: {
  playerId: string;
  label: string;
  countries: Array<{ code: string; name: string }>;
}) {
  const { t } = useT();
  const save = useSaveHomeCountry(playerId);
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={`home-country-${playerId}`} className="min-w-[8rem] text-sm text-foreground">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          setValue(next);
          save.mutate(next);
        }}
      >
        <SelectTrigger id={`home-country-${playerId}`} className="w-[220px]" disabled={save.isPending}>
          <SelectValue placeholder={t("tournaments.scope.pickCountry")} />
        </SelectTrigger>
        <SelectContent>
          {countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TournamentScopeBanner({
  scope,
  applied,
  ownUserId,
  players,
  onShowEverything,
  onRescope,
}: {
  scope: TournamentScope;
  /** Is the page actually narrowed right now? */
  applied: boolean;
  ownUserId: string | undefined;
  /** The players this viewer may read, for naming the ones missing a country. */
  players: ConnectedPlayer[];
  onShowEverything: () => void;
  onRescope: () => void;
}) {
  const { t } = useT();
  const { data: countries = [] } = useCountries();

  const missing = scope.missingHomeCountry ?? [];
  const nameFor = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    return (id: string) => byId.get(id) ?? t("tournaments.scope.thisPlayer");
  }, [players, t]);

  /** The bands the squad is in, when there are any, and why they are inert. */
  const ageNote =
    scope.ageBands.bands.length > 0 && !scope.ageBands.applied ? (
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("tournaments.scope.ageBandUnavailable", { bands: scope.ageBands.bands.join(", ") })}
      </p>
    ) : null;

  // ── Narrowed, and saying so ──────────────────────────────────────────────
  if (applied) {
    return (
      <div
        className="space-y-2 rounded-xl border border-border bg-secondary/20 p-4"
        data-testid="tournament-scope-banner"
      >
        <div className="flex flex-wrap items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm text-foreground">
            {scope.role === "player"
              ? t("tournaments.scope.scopedPlayer")
              : t("tournaments.scope.scopedCoach", { players: scope.playersWithHomeCountry })}
          </span>
          {scope.countries.map((c) => (
            <Badge key={c} variant="outline" className="border-primary/40 text-primary">
              {c}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={onShowEverything}>
            <Globe className="h-3.5 w-3.5" /> {t("tournaments.scope.showEverything")}
          </Button>
        </div>
        {ageNote}
      </div>
    );
  }

  // ── Deliberately showing everything ─────────────────────────────────────
  if (scope.reason === "ok") {
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        data-testid="tournament-scope-banner"
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">{t("tournaments.scope.showingEverything")}</span>
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={onRescope}>
          <MapPin className="h-3.5 w-3.5" />
          {t("tournaments.scope.backToScope", { countries: scope.countries.join(", ") })}
        </Button>
      </div>
    );
  }

  // ── Cannot be worked out: say which of the three reasons, and offer a fix ─
  const unmatched = scope.unmatchedCountryCodes.map((c) => c.name ?? c.code).join(", ");
  const explanation =
    scope.reason === "no-players"
      ? t("tournaments.scope.reason.noPlayers")
      : scope.reason === "unmatched"
        ? t("tournaments.scope.reason.unmatched", { countries: unmatched })
        : scope.role === "player"
          ? t("tournaments.scope.reason.noHomeCountryPlayer")
          : t("tournaments.scope.reason.noHomeCountryCoach");

  // Only offer to set what this viewer may set. A player sets their own; a
  // coach sets it for the players the server said are missing one — which is
  // already scoped to the players they may act on.
  const settable =
    scope.role === "player" ? (ownUserId ? [ownUserId] : []) : missing;

  return (
    <div
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      data-testid="tournament-scope-banner"
    >
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("tournaments.scope.cannotScope")}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{explanation}</p>
        </div>
      </div>

      {settable.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          {settable.map((id) => (
            <SetHomeCountryRow
              key={id}
              playerId={id}
              label={
                scope.role === "player" ? t("tournaments.scope.yourCountry") : nameFor(id)
              }
              countries={countries}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {t("tournaments.scope.meanwhile", { total: scope.playersReadable })}
        </span>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onShowEverything}>
          <Globe className="h-3.5 w-3.5" /> {t("tournaments.scope.showEverything")}
        </Button>
      </div>
      {ageNote}
    </div>
  );
}
