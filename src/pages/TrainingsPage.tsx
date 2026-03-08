// TODO: Integrate with POST/GET /api/trainings endpoint
import { useState } from "react";
import { useConnections } from "@/store/ConnectionStore";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dumbbell, Plus, Calendar, MapPin, Clock, Users } from "lucide-react";
import type { TrainingSession } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const mockTrainings: TrainingSession[] = [
  { id: "tr1", title: "Morning Footwork Drills", coachId: "c1", playerIds: ["p1", "p2"], startDate: "2026-03-10T08:00:00Z", endDate: "2026-03-10T10:00:00Z", location: "Court A", createdAt: "2026-03-01T00:00:00Z" },
  { id: "tr2", title: "Serve & Return Practice", coachId: "c1", playerIds: ["p3"], teamId: "t2", startDate: "2026-03-12T09:00:00Z", endDate: "2026-03-12T11:00:00Z", location: "Court B", createdAt: "2026-03-01T00:00:00Z" },
];

export default function TrainingsPage() {
  const { user } = useAuth();
  const { connectedPlayers } = useConnections();
  const [trainings, setTrainings] = useState<TrainingSession[]>(mockTrainings);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const handleCreate = () => {
    if (!title || !startDate || !endDate) return;
    const session: TrainingSession = {
      id: `tr-${Date.now()}`,
      title,
      coachId: user?.id ?? "",
      playerIds: selectedPlayers,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      location: location || undefined,
      createdAt: new Date().toISOString(),
    };
    setTrainings((prev) => [session, ...prev]);
    setCreateOpen(false);
    setTitle(""); setStartDate(""); setEndDate(""); setLocation(""); setSelectedPlayers([]);
    toast.success("Training session created");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trainings</h1>
          <p className="text-sm text-muted-foreground">Create and manage training sessions for your connected players.</p>
        </div>
        <Button className="gap-2 self-start" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Training
        </Button>
      </div>

      {trainings.length === 0 ? (
        <EmptyState icon={<Dumbbell className="h-6 w-6 text-muted-foreground" />} title="No training sessions" description="Create your first training session.">
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Create Training</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {trainings.map((t) => {
            const players = connectedPlayers.filter((p) => t.playerIds.includes(p.id));
            return (
              <DashboardCard key={t.id} title={t.title} icon={<Dumbbell className="h-4 w-4" />}>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(parseISO(t.startDate), "MMM d, h:mm a")} – {format(parseISO(t.endDate), "h:mm a")}
                  </div>
                  {t.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {t.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {players.length > 0 ? players.map((p) => `${p.firstName} ${p.lastName}`).join(", ") : "No players assigned"}
                  </div>
                </div>
              </DashboardCard>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Training Session</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning Drills" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Assign Connected Players</Label>
              {connectedPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connected players. Connect to players first.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {connectedPlayers.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedPlayers.includes(p.id)} onCheckedChange={() => togglePlayer(p.id)} />
                      <span className="text-sm text-foreground">{p.firstName} {p.lastName}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.playerPublicId}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title || !startDate || !endDate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
