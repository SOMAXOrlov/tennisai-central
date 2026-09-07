// Tournaments — with React Query, team filter, player detail, and a map view
import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Search, MapPin, Calendar, Sun, Warehouse, Mountain, X, Users, Trophy, RefreshCw, Plus, Trash2, Check,
  Eye, EyeOff, LocateFixed, Loader2, Lock,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { ReadOnlyBanner, ReadOnlyBadge, StatusBadge, EmptyState, LoadingState, ErrorState } from "@/components/ui/shared";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TeamFilterSelect } from "@/components/TeamFilterSelect";
import { PlayerFilterSelect } from "@/components/PlayerFilterSelect";
import { PlayerDetailDrawer } from "@/components/PlayerDetailDrawer";
import { TournamentConditionsDialog } from "@/components/tournaments/TournamentConditionsDialog";
import { ProvenanceChip, ProvenanceLegend } from "@/components/tournaments/ProvenanceChip";
import { AddToCalendarDialog } from "@/components/tournaments/AddToCalendarDialog";
import { AddTournamentDialog } from "@/components/tournaments/AddTournamentDialog";
import { TournamentScopeBanner } from "@/components/tournaments/TournamentScopeBanner";
import { useCalendarPreferences, useSaveCalendarPreferences } from "@/hooks/api/queries";
// Loaded on demand: Leaflet + its CSS are ~160 KB and only the Map tab needs
// them, so they must not ship with the rest of this page.
const TournamentMap = lazy(() =>
  import("@/components/tournaments/TournamentMap").then((m) => ({ default: m.TournamentMap })),
);
import {
  useTournaments, usePlayerTournaments, useUpdatePlayerTournament, useAddPlayerTournament, useRemovePlayerTournament, useTeams,
  useHiddenTournaments, useHideTournament, useUnhideTournament,
  useTournamentFacets, useTournamentScope,
} from "@/hooks/api/queries";
import { queryKeys } from "@/hooks/api/queries";
import { useGeolocation } from "@/hooks/useGeolocation";
import { interleave, slot, useT } from "@/lib/i18n";
import { CITIES } from "@/lib/geo/cities";
import { haversineKm, formatDistanceKm } from "@/lib/geo/distance";
import type { TournamentStatus, ConnectedPlayer, Tournament } from "@/types";
import { toast } from "sonner";
const ALL = "__all__";

/**
 * A subscription value that is a circuit rather than a federation.
 *
 * The account-level subscription the calendar uses splits ITF's junior events
 * out from its professional ones. No tournament row carries "ITF Junior" as a
 * federation, so it has to become "ITF" before it can be a server-side filter.
 */
const CIRCUIT_TO_FEDERATION: Record<string, string> = { "ITF Junior": "ITF" };
const surfaceColor: Record<string, string> = {
  Clay: "bg-primary/10 text-primary dark:text-primary",
  Hard: "bg-muted text-foreground dark:text-foreground",
  Grass: "bg-muted text-foreground dark:text-foreground",
};
const STATUS_OPTIONS: TournamentStatus[] = ["planned", "registered", "maybe", "withdrawn", "played"];
const MAX_RADIUS_KM = 20000; // ~ half the Earth's circumference — effectively "any distance"

// Intl option sets for this page's dates.
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const FULL_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

function distanceFromUser(userCoords: { lat: number; lng: number } | null, t: Tournament): number | null {
  if (!userCoords || typeof t.latitude !== "number" || typeof t.longitude !== "number") return null;
  return haversineKm(userCoords, { lat: t.latitude, lng: t.longitude });
}

/** Removing a tournament entry is destructive — it always goes through here. */
function RemoveFromScheduleDialog({ open, onOpenChange, tournamentName, onConfirm, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; tournamentName: string; onConfirm: () => void; loading?: boolean;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tournaments.removeDialog.title")}</DialogTitle>
          <DialogDescription>
            {interleave(t("tournaments.removeDialog.body", { name: slot(0) }), [
              <span key="name" className="font-semibold text-foreground">{tournamentName}</span>,
            ])}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("tournaments.removeDialog.keep")}</Button>
          <Button variant="destructive" disabled={loading} onClick={() => { onConfirm(); onOpenChange(false); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> {loading ? t("tournaments.removeDialog.removing") : t("tournaments.removeDialog.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentsPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const queryClient = useQueryClient();
  // `t` is already the tournament row inside the map callbacks below.
  const { t: tr, formatDate } = useT();
  const role = user?.role ?? "player";
  const isCoach = role === "coach";
  const isObserver = role === "observer";
  const isPlayer = role === "player";

  const { data: playerTournaments = [], isLoading: loadingPT, error: errorPT } = usePlayerTournaments();
  const { data: teams = [] } = useTeams();
  const { data: hiddenIds = [] } = useHiddenTournaments();
  const updatePT = useUpdatePlayerTournament();
  const addPT = useAddPlayerTournament();
  const removePT = useRemovePlayerTournament();
  const hideTournament = useHideTournament();
  const unhideTournament = useUnhideTournament();
  const { status: geoStatus, coords: userCoords, request: requestLocation, setManual: setManualLocation, clear: clearLocation } = useGeolocation();

  // The current user's own tournament entry for a given tournament (if any).
  const myEntryFor = (tournamentId: string) =>
    playerTournaments.find((pt) => pt.tournamentId === tournamentId && pt.playerId === user?.id);

  // Memoised because the filter memo below depends on it: rebuilt inline it was
  // a fresh Set every render, which made that memo recompute every render too.
  const connectedIds = useMemo(() => new Set(connectedPlayers.map((p) => p.id)), [connectedPlayers]);
  const showPlayerTournaments = isCoach || isObserver;

  // Clicking a tournament opens what it will be like to play there. From a
  // schedule row the player is known, so the analysis can be about them; from
  // the browse grid it falls back to the current user.
  const [conditionsFor, setConditionsFor] = useState<{ id: string; playerId?: string } | null>(null);

  // The same account-level subscription the calendar uses — kept per account
  // rather than per browser, so the choice survives a device change.
  //
  // It used to be a WALL: nothing was shown until a tour was picked, because
  // rendering thousands of cards was the only way to browse. Now that the
  // server filters and pages, it is what it always should have been — a filter.
  // Nothing subscribed means no restriction by tour.
  const { data: calendarPrefs } = useCalendarPreferences();
  const saveCalendarPrefs = useSaveCalendarPreferences();
  const subscribed = useMemo(() => new Set(calendarPrefs?.federations ?? []), [calendarPrefs]);
  const toggleFederation = (f: string) => {
    const next = new Set(subscribed);
    if (next.has(f)) next.delete(f); else next.add(f);
    saveCalendarPrefs.mutate({ federations: [...next] });
  };
  /** The subscription as federation values the server can filter on. */
  const subscribedFederations = useMemo(
    () => [...new Set([...subscribed].map((f) => CIRCUIT_TO_FEDERATION[f] ?? f))],
    [subscribed],
  );

  // How many cards are on screen. Rendering 2,000 at once is what made this
  // page crawl: each is a Card with badges and buttons, so it was thousands of
  // DOM nodes for a list nobody scrolls past the top of.
  const PAGE = 48;
  const [shown, setShown] = useState(PAGE);

  const [search, setSearch] = useState("");
  const [surface, setSurface] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [playerFilter, setPlayerFilter] = useState(ALL);
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [viewMode, setViewMode] = useState<"tournaments" | "players" | "map">(showPlayerTournaments || isPlayer ? "players" : "tournaments");

  // The tournament awaiting the add dialog, or null when it is closed.
  const [addTarget, setAddTarget] = useState<Tournament | null>(null);

  // Map view controls
  const [radiusKm, setRadiusKm] = useState(MAX_RADIUS_KM);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Player detail drawer
  const [playerDetailOpen, setPlayerDetailOpen] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<ConnectedPlayer | null>(null);

  // Pending "remove from schedule" confirmation ({ id } is the entry id).
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  // Coach's own entry form.
  const [addTournamentOpen, setAddTournamentOpen] = useState(false);

  // ── What the page opens on ───────────────────────────────────────────────
  //
  // "It shouldn't show all tournaments, just base on the filter and what user
  // is chosen." The server works out the viewer's own context — a player's
  // country, a coach's players' countries — and this page opens on it. The
  // scope is a LAYER over the filters, not a filter itself: it can be more than
  // one country, and it steps aside the moment anyone picks a country by hand or
  // asks to see everything.
  const { data: scope, isLoading: loadingScope, error: errorScope } = useTournamentScope();
  const [scopeDismissed, setScopeDismissed] = useState(false);
  const scopeCountries = scope?.countries ?? [];
  const scopeApplied = !scopeDismissed && country === ALL && scopeCountries.length > 0;

  /** The country values to send. A hand-picked one always wins over the scope. */
  const countryParam = country !== ALL ? [country] : scopeApplied ? scopeCountries : undefined;

  /** Everything the server needs to answer this view, except the paging. */
  const filterParams = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(countryParam ? { country: countryParam } : {}),
      ...(subscribedFederations.length ? { federation: subscribedFederations } : {}),
      ...(surface !== ALL ? { surface: [surface] } : {}),
      ...(category !== ALL ? { category: [category] } : {}),
    }),
    // `countryParam` is derived from `country`, the scope and the dismissal, all
    // of which are listed; spreading it directly would rebuild every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, country, scopeApplied, scopeCountries.join("|"), subscribedFederations, surface, category],
  );

  // The browse grid: only the page on screen, ordered by the server.
  const {
    data: browseRows,
    isPending: browsePending,
    error: errorT,
    refetch: refetchTournaments,
    isFetching: isRefetchingTournaments,
  } = useTournaments(
    { ...filterParams, limit: shown },
    // Waiting for the scope first is what stops the page fetching a season of
    // the whole world and then immediately replacing it with the squad's own.
    { enabled: !loadingScope },
  );
  // Memoised so the "hide" filter below is not rebuilt on every render: a bare
  // `?? []` is a fresh array each time.
  const tournaments = useMemo(() => browseRows ?? [], [browseRows]);

  // What there IS to filter by, aggregated over the whole window rather than
  // over the rows on screen — so choosing a surface does not shorten the
  // country list, which is what happened when these came off the loaded rows.
  const { data: facets } = useTournamentFacets(filterParams);
  const surfaces = facets?.surfaces.map((f) => f.value) ?? [];
  const countries = facets?.countries ?? [];
  const categories = facets?.categories.map((f) => f.value) ?? [];
  const federationOptions = facets?.federations ?? [];
  const matchingCount = facets?.matching ?? tournaments.length;

  // The map plots every matching event, not one page of them: a map showing 48
  // of 300 pins is a wrong map rather than a partial one. Same filters, no
  // paging, and only while the map tab is actually open.
  const { data: mapRows } = useTournaments(
    { ...filterParams, limit: 2000 },
    { enabled: !loadingScope && viewMode === "map" },
  );


  // Team filter → restrict player filter
  const teamPlayerIds = useMemo(() => {
    if (teamFilter === ALL) return null;
    const team = teams.find((t) => t.id === teamFilter);
    return new Set(team?.players.map((p) => p.id) ?? []);
  }, [teamFilter, teams]);

  const filteredPlayers = useMemo(() => {
    if (!teamPlayerIds) return connectedPlayers;
    return connectedPlayers.filter((p) => teamPlayerIds.has(p.id));
  }, [connectedPlayers, teamPlayerIds]);

  const filteredPlayerTournaments = useMemo(() => {
    return playerTournaments.filter((pt) => {
      if (isCoach && !connectedIds.has(pt.playerId)) return false;
      if (isObserver && !connectedIds.has(pt.playerId)) return false;
      if (isPlayer && pt.playerId !== user?.id) return false;
      if (teamPlayerIds && !teamPlayerIds.has(pt.playerId)) return false;
      const t = pt.tournament;
      const q = search.toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !t.city.toLowerCase().includes(q) && !t.country.toLowerCase().includes(q)) return false;
      if (surface !== ALL && t.surface !== surface) return false;
      if (category !== ALL && t.category !== category) return false;
      if (country !== ALL && t.country !== country) return false;
      if (playerFilter !== ALL && pt.playerId !== playerFilter) return false;
      if (statusFilter !== ALL && pt.status !== statusFilter) return false;
      return true;
    });
    // `teamFilter` is not read here — only the memoised `teamPlayerIds` it
    // derives, which is already listed and changes identity whenever the team
    // selection does.
  }, [playerTournaments, search, surface, category, country, playerFilter, statusFilter, isCoach, isObserver, isPlayer, connectedIds, user?.id, teamPlayerIds]);

  // Search, surface, category, country and tour are all applied by the SERVER
  // now (see `filterParams`), so what is left here is the two things that are
  // genuinely per-viewer and per-view: the rows this user has hidden, and the
  // map's distance radius.

  // Browse tab: hidden tournaments never show here (that's what "eliminate
  // from suggestions" means) — revealing them again happens from the Map tab.
  const visibleBrowseTournaments = useMemo(
    () => tournaments.filter((t) => !hiddenIds.includes(t.id)),
    [tournaments, hiddenIds],
  );

  // Map tab: hidden tournaments respect the "Show hidden" toggle, and results
  // are further narrowed by the radius when a location is set. Tournaments
  // missing coordinates can't be distance-checked, so they're never excluded
  // by the radius filter (they simply won't render as a map marker).
  const mapVisibleTournaments = useMemo(() => {
    return (mapRows ?? []).filter((t) => {
      if (!showHidden && hiddenIds.includes(t.id)) return false;
      if (userCoords) {
        const d = distanceFromUser(userCoords, t);
        if (d != null && d > radiusKm) return false;
      }
      return true;
    });
  }, [mapRows, hiddenIds, showHidden, userCoords, radiusKm]);

  const sortedMapTournaments = useMemo(() => {
    if (!sortByNearest || !userCoords) return mapVisibleTournaments;
    return [...mapVisibleTournaments].sort((a, b) => {
      const da = distanceFromUser(userCoords, a) ?? Infinity;
      const db = distanceFromUser(userCoords, b) ?? Infinity;
      return da - db;
    });
  }, [mapVisibleTournaments, sortByNearest, userCoords]);

  // A narrowed list should start at its own beginning, not 500 cards down —
  // and now that `shown` is the server's `limit`, resetting it also stops a
  // narrowed query asking for rows nobody will scroll to.
  useEffect(() => { setShown(PAGE); }, [search, surface, category, country, subscribed, scopeApplied]);

  const hasFilters = surface !== ALL || category !== ALL || country !== ALL || playerFilter !== ALL || teamFilter !== ALL || statusFilter !== ALL || search !== "";
  const clearFilters = () => { setSearch(""); setSurface(ALL); setCategory(ALL); setCountry(ALL); setPlayerFilter(ALL); setTeamFilter(ALL); setStatusFilter(ALL); };

  const handleViewPlayerDetail = (player: ConnectedPlayer) => {
    setDetailPlayer(player);
    setPlayerDetailOpen(true);
  };

  const handleRefreshTournaments = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tournaments });
    await refetchTournaments();
    toast.success(tr("toast.tournament.refreshed"));
  };

  /**
   * Opens the add dialog rather than writing straight away.
   *
   * A coach has to say WHICH player, and either of them should be told when the
   * dates clash with something already entered — neither of which fits a button
   * that silently commits.
   */
  const handleAddToSchedule = (t: Tournament) => {
    setAddTarget(t);
  };

  // FIRST load only. Every filter now refetches from the server, and a full-page
  // spinner on each dropdown change would make the page flash on every click —
  // `placeholderData` keeps the previous rows on screen instead.
  if ((browsePending && !browseRows) || loadingPT) return <LoadingState message={tr("tournaments.page.loading")} />;
  // `errorScope` is in here on purpose. If the scope call fails, `loadingScope`
  // goes false, the list fetches unfiltered and `scope` is undefined so the
  // banner renders nothing — a silent whole-world page with no explanation,
  // which is the one outcome the brief rules out. Say the page did not load
  // instead.
  if (errorT || errorPT || errorScope)
    return <ErrorState message={tr("tournaments.page.loadError")} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-foreground">{tr("tournaments.page.title")}</h1>{isObserver && <ReadOnlyBadge />}</div>
          <p className="text-muted-foreground">{isCoach ? tr("tournaments.page.subtitle.coach") : isObserver ? tr("tournaments.page.subtitle.observer") : tr("tournaments.page.subtitle.player")}</p>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
          <TabsList>
            {(showPlayerTournaments || isPlayer) && (
              <TabsTrigger value="players" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {isPlayer ? tr("tournaments.page.tabs.mySchedule") : tr("tournaments.page.tabs.playerView")}</TabsTrigger>
            )}
            <TabsTrigger value="tournaments" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> {isPlayer ? tr("tournaments.page.tabs.addTournaments") : tr("tournaments.page.tabs.browseAll")}</TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5"><MapPin className="h-3.5 w-3.5" /> {tr("tournaments.page.tabs.map")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {/* A coach's route to an event no feed carries. No scraper may be
            written for USTA — its robots.txt disallows this client by name —
            so the answer to a missing tournament is that a coach adds it. */}
        {isCoach && (
          <Button size="sm" className="gap-1.5" onClick={() => setAddTournamentOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {tr("tournaments.add.button")}
          </Button>
        )}
      </div>

      {isObserver && <ReadOnlyBanner />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder={tr("tournaments.list.searchPlaceholder")} aria-label={tr("tournaments.list.searchAria")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={surface} onValueChange={setSurface}><SelectTrigger className="w-[140px]"><SelectValue placeholder={tr("tournaments.page.filters.surface")} /></SelectTrigger><SelectContent><SelectItem value={ALL}>{tr("tournaments.page.filters.allSurfaces")}</SelectItem>{surfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-[160px]"><SelectValue placeholder={tr("tournaments.page.filters.category")} /></SelectTrigger><SelectContent><SelectItem value={ALL}>{tr("tournaments.page.filters.allCategories")}</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={country} onValueChange={setCountry}><SelectTrigger className="w-[140px]"><SelectValue placeholder={tr("tournaments.page.filters.country")} /></SelectTrigger><SelectContent><SelectItem value={ALL}>{tr("tournaments.page.filters.allCountries")}</SelectItem>{countries.map((c) => <SelectItem key={c.value} value={c.value}>{c.value} <span className="text-muted-foreground">{c.count}</span></SelectItem>)}</SelectContent></Select>
        {(showPlayerTournaments && viewMode === "players") && (
          <>
            {isCoach && <TeamFilterSelect teams={teams} value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setPlayerFilter(ALL); }} />}
            <PlayerFilterSelect players={filteredPlayers} value={playerFilter} onValueChange={setPlayerFilter} onViewDetail={isCoach ? handleViewPlayerDetail : undefined} />
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder={tr("tournaments.page.filters.status")} /></SelectTrigger><SelectContent><SelectItem value={ALL}>{tr("tournaments.page.filters.status")}</SelectItem>{STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{tr(`common.status.${s}`)}</SelectItem>))}</SelectContent></Select>
          </>
        )}
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="mr-1 h-4 w-4" /> {tr("tournaments.page.filters.reset")}</Button>}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshTournaments}
          disabled={isRefetchingTournaments}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetchingTournaments ? "animate-spin" : ""}`} />
          {isRefetchingTournaments ? tr("tournaments.page.filters.refreshing") : tr("tournaments.page.filters.refresh")}
        </Button>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {search && <Badge variant="secondary" className="gap-1">{tr("tournaments.page.filters.searchChip", { query: search })} <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} /></Badge>}
          {surface !== ALL && <Badge variant="secondary" className="gap-1">{surface} <X className="h-3 w-3 cursor-pointer" onClick={() => setSurface(ALL)} /></Badge>}
          {category !== ALL && <Badge variant="secondary" className="gap-1">{category} <X className="h-3 w-3 cursor-pointer" onClick={() => setCategory(ALL)} /></Badge>}
          {country !== ALL && <Badge variant="secondary" className="gap-1">{country} <X className="h-3 w-3 cursor-pointer" onClick={() => setCountry(ALL)} /></Badge>}
          {teamFilter !== ALL && <Badge variant="secondary" className="gap-1">{teams.find((team) => team.id === teamFilter)?.name ?? tr("tournaments.page.filters.teamChip")}<X className="h-3 w-3 cursor-pointer" onClick={() => setTeamFilter(ALL)} /></Badge>}
          {playerFilter !== ALL && <Badge variant="secondary" className="gap-1">{connectedPlayers.find((p) => p.id === playerFilter)?.firstName ?? tr("tournaments.page.filters.playerChip")}<X className="h-3 w-3 cursor-pointer" onClick={() => setPlayerFilter(ALL)} /></Badge>}
          {statusFilter !== ALL && <Badge variant="secondary" className="gap-1">{tr(`common.status.${statusFilter}`)} <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter(ALL)} /></Badge>}
        </div>
      )}

      {/* What the page has narrowed itself to, or why it could not — and one
          obvious way out of it. Never on the Player view: that tab is this
          coach's own players' entries, which are already the right scope. */}
      {viewMode !== "players" && scope && (
        <TournamentScopeBanner
          scope={scope}
          applied={scopeApplied}
          ownUserId={user?.id}
          players={connectedPlayers}
          onShowEverything={() => { setScopeDismissed(true); setCountry(ALL); }}
          onRescope={() => { setScopeDismissed(false); setCountry(ALL); }}
        />
      )}

      {/* One legend for the provenance chips on every row below, whichever view. */}
      <ProvenanceLegend />

      {/* Player tournament view */}
      {(showPlayerTournaments || isPlayer) && viewMode === "players" && (
        filteredPlayerTournaments.length === 0 ? (
          <EmptyState icon={<Trophy className="h-6 w-6 text-muted-foreground" />} title={tr("tournaments.page.table.empty")} description={hasFilters ? tr("tournaments.page.table.emptyFiltered") : tr("tournaments.page.table.emptyNone")} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.tournament")}</th>
                  {!isPlayer && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.player")}</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.location")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.date")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.surface")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.table.status")}</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredPlayerTournaments.map((pt) => (
                    <tr key={pt.id} className="transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div>
                          {/* Opens the conditions for THIS player's entry, so the
                              analysis is about the person actually playing it. */}
                          <button
                            type="button"
                            onClick={() => setConditionsFor({ id: pt.tournamentId, playerId: pt.playerId })}
                            className="text-left font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Playing conditions for ${pt.tournament.name}`}
                          >
                            {pt.tournament.name}
                          </button>
                          {pt.tournament.category && <p className="text-xs text-muted-foreground">{pt.tournament.category}</p>}
                          <ProvenanceChip tournament={pt.tournament} className="mt-1" />
                        </div>
                      </td>
                      {!isPlayer && <td className="px-4 py-3">
                        <button
                          className="flex items-center gap-2 hover:opacity-80"
                          onClick={() => {
                            const p = connectedPlayers.find((cp) => cp.id === pt.playerId);
                            if (p && isCoach) handleViewPlayerDetail(p);
                          }}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{(pt.playerName ?? "?")[0]}</div>
                          <span className="text-foreground">{pt.playerName ?? pt.playerId}</span>
                        </button>
                      </td>}
                      <td className="px-4 py-3 text-muted-foreground">{pt.tournament.city}, {pt.tournament.country}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(new Date(pt.tournament.startDate), SHORT_DATE)} – {formatDate(new Date(pt.tournament.endDate), SHORT_DATE)}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={surfaceColor[pt.tournament.surface] ?? ""}>{pt.tournament.surface}</Badge></td>
                      <td className="px-4 py-3">
                        {isPlayer ? (
                          <div className="flex items-center gap-2">
                            <Select value={pt.status} onValueChange={(v) => updatePT.mutate({ id: pt.id, data: { status: v as TournamentStatus } })}>
                              <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{tr(`common.status.${s}`)}</SelectItem>))}</SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title={tr("tournaments.page.table.removeTitle")}
                              aria-label={tr("tournaments.page.table.removeAria", { name: pt.tournament.name })}
                              disabled={removePT.isPending}
                              onClick={() => setRemoveTarget({ id: pt.id, name: pt.tournament.name })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <StatusBadge status={pt.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* The tour filter the page never had. The options and their counts come
          from an aggregate over the whole window, so they do not shrink as the
          list does — and each one says whether anything is actually COLLECTING
          that tour. A count on its own would present ATP's seven hand-typed
          rows and USTA's single one as covered calendars, which is exactly what
          made the owner stop trusting this data. Nothing selected means every
          tour. */}
      {viewMode === "tournaments" && federationOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {subscribed.size > 0 ? tr("tournaments.page.following") : tr("tournaments.page.allTours")}
          </span>
          {federationOptions.map((f) => {
            const on = subscribed.has(f.value) || subscribed.has(`${f.value} Junior`);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => toggleFederation(f.value)}
                aria-pressed={on}
                title={f.collected ? undefined : tr("tournaments.page.curatedOnlyHint")}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/30"
                }`}
              >
                {f.value} <span className="text-muted-foreground">{f.count}</span>
                {!f.collected && (
                  <span className="ml-1 text-muted-foreground">
                    · {tr("tournaments.page.curatedOnly")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {viewMode === "tournaments" && (
        visibleBrowseTournaments.length === 0 ? (
          <EmptyState icon={<Trophy className="h-6 w-6 text-muted-foreground" />} title={tr("tournaments.page.noneFound")} description={tr("tournaments.page.noneMatch")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBrowseTournaments.slice(0, shown).map((t) => {
              const distance = distanceFromUser(userCoords, t);
              return (
              <Card key={t.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* The name is the way in: click a tournament to see the
                        surface, ball, weather and how it will play. A button
                        rather than a clickable card, so the hide/remove
                        controls beside it stay independently reachable. */}
                    <CardTitle className="text-base leading-snug">
                      <button
                        type="button"
                        onClick={() => setConditionsFor({ id: t.id })}
                        className="text-left underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={tr("tournaments.page.conditionsAria", { name: t.name })}
                      >
                        {t.name}
                      </button>
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className={surfaceColor[t.surface] ?? ""}>{t.surface}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title={tr("tournaments.page.hideTitle")}
                        aria-label={tr("tournaments.page.hideAria", { name: t.name })}
                        disabled={hideTournament.isPending}
                        onClick={() => hideTournament.mutate(t.id)}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{t.city}, {t.country}</div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatDate(new Date(t.startDate), SHORT_DATE)} – {formatDate(new Date(t.endDate), FULL_DATE)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.category && <Badge variant="secondary">{t.category}</Badge>}
                    {t.level && <Badge variant="secondary">{t.level}</Badge>}
                    <Badge variant="outline">{t.indoorOutdoor === "indoor" ? <><Warehouse className="mr-1 h-3 w-3" />{tr("tournaments.page.indoor")}</> : <><Sun className="mr-1 h-3 w-3" />{tr("tournaments.page.outdoor")}</>}</Badge>
                    {t.altitude != null && t.altitude > 0 && <Badge variant="outline"><Mountain className="mr-1 h-3 w-3" />{tr("tournaments.page.altitudeM", { m: t.altitude })}</Badge>}
                    {distance != null && <Badge variant="outline" className="border-primary/40 text-primary"><MapPin className="mr-1 h-3 w-3" />{tr("tournaments.page.away", { distance: formatDistanceKm(distance) })}</Badge>}
                  </div>
                  <ProvenanceChip tournament={t} />
                  {isCoach && (() => {
                    const pts = playerTournaments.filter((pt) => pt.tournamentId === t.id && connectedIds.has(pt.playerId));
                    if (pts.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-border bg-secondary/30 p-2">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{tr("tournaments.page.yourPlayers")}</p>
                        <div className="space-y-1">{pts.map((pt) => (<div key={pt.id} className="flex items-center justify-between"><span className="text-xs text-foreground">{pt.playerName}</span><StatusBadge status={pt.status} /></div>))}</div>
                      </div>
                    );
                  })()}
                  {t.weatherSummary && <p className="text-xs text-muted-foreground">🌤 {t.weatherSummary}</p>}
                  {isPlayer && (() => {
                    const entry = myEntryFor(t.id);
                    return entry ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-destructive hover:text-destructive"
                        aria-label={tr("tournaments.page.table.removeAria", { name: t.name })}
                        disabled={removePT.isPending}
                        onClick={() => setRemoveTarget({ id: entry.id, name: t.name })}
                      >
                        <Check className="h-3.5 w-3.5" /> {tr("tournaments.page.inScheduleRemove")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={addPT.isPending}
                        onClick={() => handleAddToSchedule(t)}
                      >
                        <Plus className="h-3.5 w-3.5" /> {tr("tournaments.page.addToSchedule")}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
              );
            })}
          </div>
        )
      )}

      {/* The total is the server's count of everything that matches, not the
          length of what happens to be loaded — so "48 of 312" is true. */}
      {viewMode === "tournaments" && tournaments.length < matchingCount && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-muted-foreground">
            {tr("tournaments.page.showingOf", { shown: visibleBrowseTournaments.length, total: matchingCount })}
          </p>
          <Button variant="outline" disabled={isRefetchingTournaments} onClick={() => setShown((n) => n + PAGE)}>
            {isRefetchingTournaments ? tr("tournaments.page.loadingMore") : tr("tournaments.page.showMore")}
          </Button>
        </div>
      )}

      {viewMode === "map" && (
        <div className="space-y-4">
          <div className="space-y-3 border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={requestLocation}
                disabled={geoStatus === "prompting"}
              >
                {geoStatus === "prompting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                {geoStatus === "prompting" ? tr("tournaments.map.locating") : tr("tournaments.map.useLocation")}
              </Button>

              <Select
                value=""
                onValueChange={(name) => {
                  const city = CITIES.find((c) => c.name === name);
                  if (city) setManualLocation({ lat: city.lat, lng: city.lng }, `${city.name}, ${city.country}`);
                }}
              >
                <SelectTrigger className="w-[190px]"><SelectValue placeholder={tr("tournaments.map.pickCity")} /></SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}, {c.country}</SelectItem>))}
                </SelectContent>
              </Select>

              {userCoords && (
                <Badge variant="secondary" className="gap-1.5">
                  <MapPin className="h-3 w-3" /> {userCoords.label ?? tr("tournaments.map.yourLocation")}
                  <X className="h-3 w-3 cursor-pointer" onClick={clearLocation} />
                </Badge>
              )}

              {geoStatus === "denied" && <p className="text-xs text-muted-foreground">{tr("tournaments.map.denied")}</p>}
              {geoStatus === "unsupported" && <p className="text-xs text-muted-foreground">{tr("tournaments.map.unsupported")}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap text-xs text-muted-foreground">
                  {tr("tournaments.map.within", {
                    radius: radiusKm >= MAX_RADIUS_KM ? tr("tournaments.map.anyDistance") : tr("tournaments.map.radiusKm", { km: radiusKm }),
                  })}
                </Label>
                <Slider
                  className="w-[160px]"
                  min={100}
                  max={MAX_RADIUS_KM}
                  step={100}
                  value={[radiusKm]}
                  onValueChange={(v) => setRadiusKm(v[0])}
                  disabled={!userCoords}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="sort-nearest" checked={sortByNearest} onCheckedChange={setSortByNearest} disabled={!userCoords} />
                <Label htmlFor="sort-nearest" className="text-xs text-muted-foreground">{tr("tournaments.map.sortNearest")}</Label>
              </div>

              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowHidden((v) => !v)}>
                {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {tr("tournaments.map.hiddenToggle", {
                  count: hiddenIds.length,
                  action: showHidden ? tr("tournaments.page.hide") : tr("tournaments.page.unhide"),
                })}
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> {tr("tournaments.map.privacy")}
            </p>
          </div>

          {!userCoords && (
            <div className="border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {tr("tournaments.map.setLocation")}
            </div>
          )}

          {sortedMapTournaments.length === 0 ? (
            <EmptyState icon={<MapPin className="h-6 w-6 text-muted-foreground" />} title={tr("tournaments.page.noneFound")} description={tr("tournaments.page.noneMatch")} />
          ) : (
            <div className="space-y-4">
              <Suspense fallback={<LoadingState message={tr("tournaments.map.loading")} />}>
                <TournamentMap
                  tournaments={sortedMapTournaments}
                  userCoords={userCoords}
                  radiusKm={userCoords ? radiusKm : null}
                  onAdd={handleAddToSchedule}
                  onHide={(id) => hideTournament.mutate(id)}
                  canAdd={isPlayer || isCoach}
                />
              </Suspense>

              <div className="divide-y divide-border border border-border">
                {sortedMapTournaments.map((t) => {
                  const distance = distanceFromUser(userCoords, t);
                  const isHidden = hiddenIds.includes(t.id);
                  const entry = myEntryFor(t.id);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-[220px] flex-1">
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.city}, {t.country} · {formatDate(new Date(t.startDate), { month: "short", day: "numeric" })} – {formatDate(new Date(t.endDate), { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                        <ProvenanceChip tournament={t} className="mt-1" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={surfaceColor[t.surface] ?? ""}>{t.surface}</Badge>
                        {distance != null && <Badge variant="outline" className="border-primary/40 text-primary">{formatDistanceKm(distance)}</Badge>}
                        {isPlayer && (
                          entry ? (
                            // Reads as a status at rest, but it removes — so it
                            // flips to an explicit "Remove" on hover/focus and
                            // still asks for confirmation.
                            <Button
                              variant="outline"
                              size="sm"
                              className="group gap-1 text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                              aria-label={tr("tournaments.page.table.removeAria", { name: t.name })}
                              disabled={removePT.isPending}
                              onClick={() => setRemoveTarget({ id: entry.id, name: t.name })}
                            >
                              <Check className="h-3.5 w-3.5 group-hover:hidden group-focus-visible:hidden" />
                              <X className="hidden h-3.5 w-3.5 group-hover:block group-focus-visible:block" />
                              <span className="group-hover:hidden group-focus-visible:hidden">{tr("tournaments.page.inSchedule")}</span>
                              <span className="hidden group-hover:inline group-focus-visible:inline">{tr("tournaments.page.remove")}</span>
                            </Button>
                          ) : (
                            <Button size="sm" className="gap-1" disabled={addPT.isPending} onClick={() => handleAddToSchedule(t)}>
                              <Plus className="h-3.5 w-3.5" /> {tr("tournaments.page.add")}
                            </Button>
                          )
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          disabled={hideTournament.isPending || unhideTournament.isPending}
                          onClick={() => (isHidden ? unhideTournament.mutate(t.id) : hideTournament.mutate(t.id))}
                        >
                          {isHidden ? <><Eye className="h-3.5 w-3.5" /> {tr("tournaments.page.unhide")}</> : <><EyeOff className="h-3.5 w-3.5" /> {tr("tournaments.page.hide")}</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <PlayerDetailDrawer player={detailPlayer} open={playerDetailOpen} onOpenChange={setPlayerDetailOpen} readOnly={isObserver} />

      <TournamentConditionsDialog
        tournamentId={conditionsFor?.id ?? null}
        playerId={conditionsFor?.playerId}
        // Opened from a browse card by a coach: whoever from the squad is
        // entered is who could be prepared. A specific entry wins over this.
        candidates={
          isCoach && conditionsFor && !conditionsFor.playerId
            ? playerTournaments
                .filter((pt) => pt.tournamentId === conditionsFor.id && connectedIds.has(pt.playerId) && pt.status !== "withdrawn")
                .map((pt) => ({ id: pt.playerId, name: pt.playerName ?? pt.playerId }))
            : undefined
        }
        open={conditionsFor !== null}
        onOpenChange={(o) => { if (!o) setConditionsFor(null); }}
      />
      <AddToCalendarDialog
        tournament={addTarget}
        open={!!addTarget}
        onOpenChange={(o) => { if (!o) setAddTarget(null); }}
      />
      {isCoach && (
        <AddTournamentDialog
          open={addTournamentOpen}
          onOpenChange={setAddTournamentOpen}
          players={connectedPlayers}
        />
      )}

      {removeTarget && (
        <RemoveFromScheduleDialog
          open={!!removeTarget}
          onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}
          tournamentName={removeTarget.name}
          loading={removePT.isPending}
          onConfirm={() => { removePT.mutate(removeTarget.id); setRemoveTarget(null); }}
        />
      )}
    </div>
  );
}
