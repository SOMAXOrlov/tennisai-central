import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Eye,
  Users,
  Calendar,
  Trophy,
  BarChart3,
  Wallet,
  Bell,
  ArrowRight,
  Clock,
  Lock,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import {
  mockConnectedPlayers,
  mockCalendarEvents,
  mockPlayerTournaments,
  mockFinanceSummary,
  mockNotifications,
} from "@/mock/data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

const eventTypeColor: Record<string, string> = {
  training: "bg-blue-500",
  tournament: "bg-primary",
  match: "bg-orange-500",
  travel: "bg-purple-500",
  recovery: "bg-muted-foreground",
};

function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
      <Eye className="h-3 w-3" />
      Read-only
    </span>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
      <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <p className="text-sm text-amber-700 dark:text-amber-300">
        You have <strong>read-only</strong> access. You can view but not edit any data.
      </p>
    </div>
  );
}

export default function ObserverDashboard() {
  const { user } = useAuth();
  const connectedPlayer = mockConnectedPlayers[0];
  const upcomingEvents = mockCalendarEvents.slice(0, 4);
  const unreadNotifications = mockNotifications.filter((n) => !n.read);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome, {user?.firstName}
            </h1>
            <p className="text-muted-foreground">Viewing connected player's progress.</p>
          </div>
          <ReadOnlyBadge />
        </div>
      </div>

      <ReadOnlyBanner />

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Connected Players"
          value={mockConnectedPlayers.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Upcoming Events"
          value={upcomingEvents.length}
          icon={<Calendar className="h-4 w-4" />}
        />
        <StatCard
          label="Tournaments"
          value={mockPlayerTournaments.length}
          icon={<Trophy className="h-4 w-4" />}
        />
        <StatCard
          label="Unread Notifications"
          value={unreadNotifications.length}
          icon={<Bell className="h-4 w-4" />}
        />
      </div>

      {/* Connected Player Summary */}
      <DashboardCard
        title="Connected Player"
        icon={<Users className="h-4 w-4" />}
        badge={<ReadOnlyBadge />}
      >
        <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {connectedPlayer.firstName[0]}{connectedPlayer.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">
              {connectedPlayer.firstName} {connectedPlayer.lastName}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{connectedPlayer.playerPublicId}</p>
            <p className="text-xs text-muted-foreground">Connected since {formatDate(connectedPlayer.connectedSince)}</p>
          </div>
        </div>
      </DashboardCard>

      {/* Calendar + Tournaments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Player Schedule"
          description="Upcoming events on the player's calendar"
          icon={<Calendar className="h-4 w-4" />}
          badge={<ReadOnlyBadge />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/calendar">Full calendar <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className="mt-1.5 flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ${eventTypeColor[event.type] || "bg-muted"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(event.startDate)}
                    {event.location && <span>· {event.location}</span>}
                  </div>
                </div>
                <span className="mt-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {event.type}
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Player Tournaments"
          description="Planned and registered tournaments"
          icon={<Trophy className="h-4 w-4" />}
          badge={<ReadOnlyBadge />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tournaments">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {mockPlayerTournaments.map((pt) => (
              <div key={pt.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{pt.tournament.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pt.tournament.city}, {pt.tournament.country} · {pt.tournament.surface}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(pt.tournament.startDate, pt.tournament.endDate)}
                  </p>
                </div>
                <StatusBadge status={pt.status} />
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* Stats + Finance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Player Statistics"
          description="Season performance overview"
          icon={<BarChart3 className="h-4 w-4" />}
          badge={<ReadOnlyBadge />}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Matches Played</p>
              <p className="text-xl font-bold text-foreground">24</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold text-primary">67%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tournaments</p>
              <p className="text-xl font-bold text-foreground">8</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Best Result</p>
              <p className="text-xl font-bold text-foreground">SF</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Player Finance"
          description="Season cost breakdown"
          icon={<Wallet className="h-4 w-4" />}
          badge={<ReadOnlyBadge />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/finance">Details <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {[
              { label: "Training", amount: mockFinanceSummary.totalTraining },
              { label: "Travel", amount: mockFinanceSummary.totalTravel },
              { label: "Tournaments", amount: mockFinanceSummary.totalTournament },
              { label: "Equipment", amount: mockFinanceSummary.totalEquipment },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold text-foreground">${item.amount.toLocaleString()}</p>
              </div>
            ))}
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Total</p>
                <p className="text-sm font-bold text-foreground">
                  ${(mockFinanceSummary.totalTraining + mockFinanceSummary.totalTravel + mockFinanceSummary.totalTournament + mockFinanceSummary.totalEquipment).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Notifications */}
      <DashboardCard
        title="Recent Notifications"
        description={`${unreadNotifications.length} unread`}
        icon={<Bell className="h-4 w-4" />}
        badge={
          unreadNotifications.length > 0 ? (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {unreadNotifications.length}
            </span>
          ) : undefined
        }
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/notifications">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        }
      >
        <div className="space-y-3">
          {mockNotifications.slice(0, 3).map((notif) => (
            <div key={notif.id} className="flex items-start gap-3">
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notif.read ? "bg-muted" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${notif.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                  {notif.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{notif.message}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(notif.createdAt)}</span>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
