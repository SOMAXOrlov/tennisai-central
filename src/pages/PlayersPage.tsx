// TODO: Integrate with GET /api/coach/players endpoint
import { useConnections } from "@/store/ConnectionStore";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState, StatusBadge } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, ArrowRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function PlayersPage() {
  const { connectedPlayers } = useConnections();
  const [search, setSearch] = useState("");

  const filtered = connectedPlayers.filter((p) =>
    !search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Players</h1>
          <p className="text-sm text-muted-foreground">Players with active connections to you.</p>
        </div>
        <Button className="gap-2 self-start" asChild>
          <Link to="/connections"><UserPlus className="h-4 w-4" /> Connect Player</Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6 text-muted-foreground" />}
          title="No connected players"
          description="Send connection requests to players to start managing them."
        >
          <Button asChild><Link to="/connections">Send Request</Link></Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => (
            <DashboardCard key={player.id} title={`${player.firstName} ${player.lastName}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {player.firstName[0]}{player.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{player.playerPublicId}</p>
                  <p className="text-xs text-muted-foreground">Connected since {new Date(player.connectedSince).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status="active" />
                <Button size="sm" variant="ghost" className="ml-auto gap-1 text-xs">
                  View <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </DashboardCard>
          ))}
        </div>
      )}
    </div>
  );
}
