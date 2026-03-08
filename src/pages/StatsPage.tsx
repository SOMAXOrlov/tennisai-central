// TODO: Integrate with GET /api/player/stats endpoint
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { BarChart3, Trophy, Target, TrendingUp } from "lucide-react";

export default function StatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Statistics</h1>
        <p className="text-sm text-muted-foreground">Your season performance overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Matches Played", value: "24", icon: <Target className="h-4 w-4" /> },
          { label: "Win Rate", value: "67%", icon: <TrendingUp className="h-4 w-4" /> },
          { label: "Tournaments", value: "8", icon: <Trophy className="h-4 w-4" /> },
          { label: "Best Result", value: "SF", icon: <BarChart3 className="h-4 w-4" /> },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <DashboardCard title="Match History" icon={<BarChart3 className="h-4 w-4" />}>
        <div className="space-y-3">
          {[
            { opponent: "Taylor M.", result: "W", score: "6-4, 7-5", tournament: "Regional Open" },
            { opponent: "Nguyen T.", result: "W", score: "6-3, 6-2", tournament: "City Open R1" },
            { opponent: "Johansson K.", result: "L", score: "4-6, 6-7", tournament: "City Open R2" },
            { opponent: "Chen S.", result: "W", score: "6-1, 6-4", tournament: "Practice Match" },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${m.result === "W" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {m.result}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">vs. {m.opponent}</p>
                <p className="text-xs text-muted-foreground">{m.tournament}</p>
              </div>
              <span className="font-mono text-sm text-muted-foreground">{m.score}</span>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
