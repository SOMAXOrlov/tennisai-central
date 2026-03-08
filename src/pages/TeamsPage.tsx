import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { mockTeams as seedTeams } from "@/mock/data";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  ArrowLeft,
  Search,
  Check,
} from "lucide-react";
import type { Team, ConnectedPlayer } from "@/types";
import { format } from "date-fns";

// ─── Player Avatar ───

function PlayerAvatar({ player, size = "md" }: { player: ConnectedPlayer; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`}>
      {player.firstName[0]}{player.lastName[0]}
    </div>
  );
}

// ─── Team Card (list view) ───

function TeamCard({
  team,
  onSelect,
  onRename,
  onDelete,
}: {
  team: Team;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{team.name}</h3>
            <p className="text-xs text-muted-foreground">
              {team.players.length} player{team.players.length !== 1 ? "s" : ""} · Created {format(new Date(team.createdAt), "MMM yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename(); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {team.players.slice(0, 5).map((p) => (
            <PlayerAvatar key={p.id} player={p} size="sm" />
          ))}
        </div>
        {team.players.length > 5 && <span className="text-xs text-muted-foreground">+{team.players.length - 5} more</span>}
        {team.players.length === 0 && <span className="text-xs text-muted-foreground">No players yet</span>}
      </div>

      <Button variant="outline" className="w-full gap-1.5" onClick={onSelect}>
        Manage Team
        <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
      </Button>
    </div>
  );
}

// ─── Team Detail View ───

function TeamDetail({
  team,
  connectedPlayers,
  onBack,
  onAddPlayer,
  onRemovePlayer,
  onRename,
}: {
  team: Team;
  connectedPlayers: ConnectedPlayer[];
  onBack: () => void;
  onAddPlayer: (player: ConnectedPlayer) => void;
  onRemovePlayer: (playerId: string) => void;
  onRename: () => void;
}) {
  const [search, setSearch] = useState("");

  const teamPlayerIds = new Set(team.players.map((p) => p.id));
  const availablePlayers = connectedPlayers.filter(
    (p) => !teamPlayerIds.has(p.id) && (!search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{team.name}</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRename}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {team.players.length} player{team.players.length !== 1 ? "s" : ""} · Created {format(new Date(team.createdAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Players */}
        <DashboardCard title="Team Roster" description={`${team.players.length} player${team.players.length !== 1 ? "s" : ""}`} icon={<Users className="h-4 w-4" />}>
          {team.players.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No players in this team yet. Add players from your connected players.</p>
          ) : (
            <div className="space-y-2">
              {team.players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30">
                  <PlayerAvatar player={player} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{player.firstName} {player.lastName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{player.playerPublicId}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemovePlayer(player.id)}>
                    <UserMinus className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Available Connected Players */}
        <DashboardCard title="Add Connected Players" description="Only players with accepted connections" icon={<UserPlus className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search connected players…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {connectedPlayers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No connected players yet. Go to <span className="font-medium text-foreground">Connections</span> to send requests and get them accepted first.
              </p>
            ) : availablePlayers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? "No matching players found." : "All connected players are already in this team."}
              </p>
            ) : (
              <div className="space-y-2">
                {availablePlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30">
                    <PlayerAvatar player={player} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{player.firstName} {player.lastName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{player.playerPublicId}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => onAddPlayer(player)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

// ─── Create / Rename Dialog ───

function TeamNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="team-name">Team Name</Label>
          <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="e.g. Junior Elite Squad" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            <Check className="mr-1.5 h-4 w-4" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───

function DeleteTeamDialog({
  open,
  onOpenChange,
  teamName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-semibold text-foreground">{teamName}</span>? This won't affect the player connections — only the team grouping will be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───

export default function TeamsPage() {
  const { user } = useAuth();
  const coachId = user?.id ?? "";
  const { connectedPlayers } = useConnections();

  const [teams, setTeams] = useState<Team[]>(seedTeams.filter((t) => t.coachId === coachId));
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedTeamId) ?? null, [teams, selectedTeamId]);

  const createTeam = (name: string) => {
    const newTeam: Team = {
      id: `t-${Date.now()}`,
      name,
      coachId,
      players: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTeams((prev) => [...prev, newTeam]);
  };

  const renameTeam = (id: string, name: string) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name, updatedAt: new Date().toISOString() } : t)));
  };

  const deleteTeam = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (selectedTeamId === id) setSelectedTeamId(null);
  };

  const addPlayerToTeam = (teamId: string, player: ConnectedPlayer) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId && !t.players.some((p) => p.id === player.id)
          ? { ...t, players: [...t.players, player], updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const removePlayerFromTeam = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, players: t.players.filter((p) => p.id !== playerId), updatedAt: new Date().toISOString() } : t
      )
    );
  };

  // ─── Detail View ───
  if (selectedTeam) {
    return (
      <div className="space-y-6">
        <TeamDetail
          team={selectedTeam}
          connectedPlayers={connectedPlayers}
          onBack={() => setSelectedTeamId(null)}
          onAddPlayer={(p) => addPlayerToTeam(selectedTeam.id, p)}
          onRemovePlayer={(pid) => removePlayerFromTeam(selectedTeam.id, pid)}
          onRename={() => setRenameTarget(selectedTeam)}
        />
        {renameTarget && (
          <TeamNameDialog
            open={!!renameTarget}
            onOpenChange={(v) => !v && setRenameTarget(null)}
            title="Rename Team"
            description="Enter a new name for this team."
            initialName={renameTarget.name}
            onSubmit={(name) => { renameTeam(renameTarget.id, name); setRenameTarget(null); }}
          />
        )}
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Create teams and organize your connected players into groups.
          </p>
        </div>
        <Button className="gap-2 self-start" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Team
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
          <div>
            <div className="text-xl font-bold text-foreground">{teams.length}</div>
            <div className="text-xs text-muted-foreground">Teams</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserPlus className="h-4 w-4" /></div>
          <div>
            <div className="text-xl font-bold text-foreground">{connectedPlayers.length}</div>
            <div className="text-xs text-muted-foreground">Connected Players</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
          <div>
            <div className="text-xl font-bold text-foreground">{new Set(teams.flatMap((t) => t.players.map((p) => p.id))).size}</div>
            <div className="text-xs text-muted-foreground">Players in Teams</div>
          </div>
        </div>
      </div>

      {/* Team Grid */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Users className="h-6 w-6 text-muted-foreground" /></div>
          <div className="text-center">
            <p className="font-medium text-foreground">No teams yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first team to organize players.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Create Team</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onSelect={() => setSelectedTeamId(team.id)} onRename={() => setRenameTarget(team)} onDelete={() => setDeleteTarget(team)} />
          ))}
          <button onClick={() => setCreateOpen(true)} className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Create New Team</span>
          </button>
        </div>
      )}

      {/* Dialogs */}
      <TeamNameDialog open={createOpen} onOpenChange={setCreateOpen} title="Create Team" description="Give your new team a name. You can add players after creating it." initialName="" onSubmit={createTeam} />
      {renameTarget && (
        <TeamNameDialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)} title="Rename Team" description="Enter a new name for this team." initialName={renameTarget.name} onSubmit={(name) => { renameTeam(renameTarget.id, name); setRenameTarget(null); }} />
      )}
      {deleteTarget && (
        <DeleteTeamDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} teamName={deleteTarget.name} onConfirm={() => { deleteTeam(deleteTarget.id); setDeleteTarget(null); }} />
      )}
    </div>
  );
}
