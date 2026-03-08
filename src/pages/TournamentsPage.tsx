import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Search, MapPin, Calendar, Sun, Warehouse, Mountain, X } from "lucide-react";
import { mockTournaments } from "@/mock/data";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ALL = "__all__";

const surfaces = [...new Set(mockTournaments.map((t) => t.surface))];
const categories = [...new Set(mockTournaments.map((t) => t.category).filter(Boolean))] as string[];
const levels = [...new Set(mockTournaments.map((t) => t.level).filter(Boolean))] as string[];

export default function TournamentsPage() {
  const [search, setSearch] = useState("");
  const [surface, setSurface] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [level, setLevel] = useState(ALL);

  const filtered = useMemo(() => {
    return mockTournaments.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.country.toLowerCase().includes(q);
      const matchesSurface = surface === ALL || t.surface === surface;
      const matchesCategory = category === ALL || t.category === category;
      const matchesLevel = level === ALL || t.level === level;
      return matchesSearch && matchesSurface && matchesCategory && matchesLevel;
    });
  }, [search, surface, category, level]);

  const hasFilters = surface !== ALL || category !== ALL || level !== ALL || search !== "";

  const clearFilters = () => {
    setSearch("");
    setSurface(ALL);
    setCategory(ALL);
    setLevel(ALL);
  };

  const surfaceColor: Record<string, string> = {
    Clay: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    Hard: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    Grass: "bg-green-500/15 text-green-700 dark:text-green-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tournament Explorer</h1>
        <p className="text-muted-foreground">Browse upcoming tournaments and plan your schedule.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Levels</SelectItem>
            {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-muted-foreground">No tournaments match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
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

                {t.weatherSummary && (
                  <p className="text-xs text-muted-foreground">🌤 {t.weatherSummary}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
