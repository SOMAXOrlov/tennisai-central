// TODO: Integrate with GET /api/tournaments, GET /api/player-tournaments
import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Search, MapPin, Calendar, Sun, Warehouse, Mountain, X, Users, User, Filter,
  Trophy, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { mockTournaments, mockPlayerTournaments, mockTeams } from "@/mock/data";
import { ReadOnlyBanner, ReadOnlyBadge, StatusBadge, EmptyState } from "@/components/ui/shared";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TournamentStatus } from "@/types";

const ALL = "__all__";

const surfaces = [...new Set(mockTournaments.map((t) => t.surface))];
const countries = [...new Set(mockTournaments.map((t) => t.country))].sort();
const categories = [...new Set(mockTournaments.map((t) => t.category).filter(Boolean))] as string[];

const surfaceColor: Record<string, string> = {
  Clay: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Hard: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Grass: "bg-green-500/15 text-green-700 dark:text-green-400",
};

const STATUS_OPTIONS: TournamentStatus[] = ["planned", "registered", "maybe", "withdrawn", "played"];

export default function TournamentsPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const role = user?.role ?? "player";
  const isCoach = role === "coach";
  const isObserver = role === "observer";
  const isPlayer = role === "player";

  const connectedIds = new Set(connectedPlayers.map((p) => p.id));

  // For coach/observer: show player tournament visibility
  const showPlayerTournaments = isCoach || isObserver;

  // Filter states
  const [search, setSearch] = useState("");
  const [surface, setSurface] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [playerFilter, setPlayerFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [viewMode, setViewMode] = useState<"tournaments" | "players">(showPlayerTournaments ? "players" : "tournaments");

  // Filtered player tournaments (coach sees only connected players)
  const filteredPlayerTournaments = useMemo(() => {
    return mockPlayerTournaments.filter((pt) => {
      // Connection scoping
      if (isCoach && !connectedIds.has(pt.playerId)) return false;
      if (isObserver && !connectedIds.has(pt.playerId)) return false;

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
  }, [search, surface, category, country, playerFilter, statusFilter, isCoach, isObserver, connectedIds]);

  // Filtered tournaments (general browse)
  const filteredTournaments = useMemo(() => {
    return mockTournaments.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !t.city.toLowerCase().includes(q) && !t.country.toLowerCase().includes(q)) return false;
      if (surface !== ALL && t.surface !== surface) return false;
      if (category !== ALL && t.category !== category) return false;
      if (country !== ALL && t.country !== country) return false;
      return true;
    });
  }, [search, surface, category, country]);

  const hasFilters = surface !== ALL || category !== ALL || country !== ALL || playerFilter !== ALL || statusFilter !== ALL || search !== "";
  const clearFilters = () => { setSearch(""); setSurface(ALL); setCategory(ALL); setCountry(ALL); setPlayerFilter(ALL); setStatusFilter(ALL); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Tournaments</h1>
            {isObserver && <ReadOnlyBadge />}
          </div>
          <p className="text-muted-foreground">
            {isCoach
              ? "View tournaments and your connected players' participation."
              : isObserver
              ? "Read-only view of connected player tournaments."
              : "Browse upcoming tournaments and plan your schedule."}
          </p>
        </div>
        {showPlayerTournaments && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList>
              <TabsTrigger value="players" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Player View
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> Browse All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {isObserver && <ReadOnlyBanner />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, city, or country…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={surface} onValueChange={setSurface}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Surface" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Surfaces</SelectItem>
            {surfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Countries</SelectItem>
            {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Coach/Observer: player + status filters */}
        {showPlayerTournaments && viewMode === "players" && (
          <>
            <Select value={playerFilter} onValueChange={setPlayerFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Players" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Players</SelectItem>
                {connectedPlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-1 h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {search && <Badge variant="secondary" className="gap-1">Search: "{search}" <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} /></Badge>}
          {surface !== ALL && <Badge variant="secondary" className="gap-1">{surface} <X className="h-3 w-3 cursor-pointer" onClick={() => setSurface(ALL)} /></Badge>}
          {category !== ALL && <Badge variant="secondary" className="gap-1">{category} <X className="h-3 w-3 cursor-pointer" onClick={() => setCategory(ALL)} /></Badge>}
          {country !== ALL && <Badge variant="secondary" className="gap-1">{country} <X className="h-3 w-3 cursor-pointer" onClick={() => setCountry(ALL)} /></Badge>}
          {playerFilter !== ALL && (
            <Badge variant="secondary" className="gap-1">
              {connectedPlayers.find((p) => p.id === playerFilter)?.firstName ?? "Player"}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setPlayerFilter(ALL)} />
            </Badge>
          )}
          {statusFilter !== ALL && <Badge variant="secondary" className="gap-1 capitalize">{statusFilter} <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter(ALL)} /></Badge>}
        </div>
      )}

      {/* Player Tournament View */}
      {showPlayerTournaments && viewMode === "players" && (
        filteredPlayerTournaments.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6 text-muted-foreground" />}
            title="No player tournaments"
            description={hasFilters ? "No results match your filters." : "No connected players have tournament entries yet."}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tournament</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Surface</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlayerTournaments.map((pt) => (
                    <tr key={pt.id} className="transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{pt.tournament.name}</p>
                          {pt.tournament.category && <p className="text-xs text-muted-foreground">{pt.tournament.category}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(pt.playerName ?? "?")[0]}
                          </div>
                          <span className="text-foreground">{pt.playerName ?? pt.playerId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {pt.tournament.city}, {pt.tournament.country}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(pt.tournament.startDate), "MMM d")} – {format(new Date(pt.tournament.endDate), "MMM d")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={surfaceColor[pt.tournament.surface] ?? ""}>
                          {pt.tournament.surface}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={pt.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* General Tournament Browse */}
      {(!showPlayerTournaments || viewMode === "tournaments") && (
        filteredTournaments.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6 text-muted-foreground" />}
            title="No tournaments found"
            description="No tournaments match your filters."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTournaments.map((t) => (
              <Card key={t.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{t.name}</CardTitle>
                    <Badge variant="outline" className={surfaceColor[t.surface] ?? ""}>
                      {t.surface}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {t.city}, {t.country}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(t.startDate), "MMM d")} – {format(new Date(t.endDate), "MMM d, yyyy")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.category && <Badge variant="secondary">{t.category}</Badge>}
                    {t.level && <Badge variant="secondary">{t.level}</Badge>}
                    <Badge variant="outline" className="capitalize">
                      {t.indoorOutdoor === "indoor" ? (
                        <><Warehouse className="mr-1 h-3 w-3" />Indoor</>
                      ) : (
                        <><Sun className="mr-1 h-3 w-3" />Outdoor</>
                      )}
                    </Badge>
                    {t.altitude != null && t.altitude > 0 && (
                      <Badge variant="outline"><Mountain className="mr-1 h-3 w-3" />{t.altitude}m</Badge>
                    )}
                  </div>
                  {/* Show connected player participation for coach */}
                  {isCoach && (() => {
                    const pts = mockPlayerTournaments.filter((pt) => pt.tournamentId === t.id && connectedIds.has(pt.playerId));
                    if (pts.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-border bg-secondary/30 p-2">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Your Players</p>
                        <div className="space-y-1">
                          {pts.map((pt) => (
                            <div key={pt.id} className="flex items-center justify-between">
                              <span className="text-xs text-foreground">{pt.playerName}</span>
                              <StatusBadge status={pt.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {t.weatherSummary && (
                    <p className="text-xs text-muted-foreground">🌤 {t.weatherSummary}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
