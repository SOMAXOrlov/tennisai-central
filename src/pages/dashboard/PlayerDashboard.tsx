import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/ui/shared";
import { RoleBadge } from "@/components/ui/shared";
import {
  Copy,
  UserPlus,
  Calendar,
  Trophy,
  BarChart3,
  Wallet,
  Package,
  Brain,
  Bell,
  Check,
  X,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import {
  mockCalendarEvents,
  mockPlayerTournaments,
  mockFinanceSummary,
  mockEquipment,
  mockNotifications,
} from "@/mock/data";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

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

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { requests } = useConnections();
  const [copied, setCopied] = useState(false);

  const playerPublicId = user?.playerPublicId ?? "TAI-2025-001";

  // Incoming pending requests for this player
  const pendingRequests = requests.filter(
    (r) => r.status === "pending" && r.toUserId === user?.id
  );
  const upcomingEvents = mockCalendarEvents.slice(0, 4);
  const unreadNotifications = mockNotifications.filter((n) => !n.read);

  const copyPlayerId = () => {
    navigator.clipboard.writeText(playerPublicId);
    setCopied(true);
    toast({ title: "Copied!", description: "Player ID copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">Here's your tennis overview for today.</p>
      </div>

      {/* Top stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Requests"
          value={pendingRequests.length}
          icon={<UserPlus className="h-4 w-4" />}
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
          trend={`${mockPlayerTournaments.filter((t) => t.status === "registered").length} registered`}
        />
        <StatCard
          label="Unread Notifications"
          value={unreadNotifications.length}
          icon={<Bell className="h-4 w-4" />}
        />
      </div>

      {/* Player ID + Pending Requests row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Player Public ID */}
        <DashboardCard
          title="My Player ID"
          description="Share this ID so coaches and observers can connect with you"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-3">
              <p className="font-mono text-lg font-bold tracking-wider text-foreground">
                {playerPublicId}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={copyPlayerId}>
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DashboardCard>

        {/* Pending Connection Requests */}
        <DashboardCard
          title="Pending Requests"
          description={`${pendingRequests.length} awaiting your response`}
          icon={<UserPlus className="h-4 w-4" />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/connections">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{req.fromUserName}</p>
                    <RoleBadge role={req.fromUserRole} />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Calendar + Tournaments row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Upcoming Schedule"
          description="Next events on your calendar"
          icon={<Calendar className="h-4 w-4" />}
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
          title="My Tournaments"
          description="Your planned and registered tournaments"
          icon={<Trophy className="h-4 w-4" />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tournaments">Explore <ArrowRight className="ml-1 h-3 w-3" /></Link>
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

      {/* Stats + Finance + Equipment row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard
          title="Statistics"
          description="Season performance overview"
          icon={<BarChart3 className="h-4 w-4" />}
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
          title="Finance"
          description="Season cost breakdown"
          icon={<Wallet className="h-4 w-4" />}
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

        <DashboardCard
          title="Equipment"
          description={`${mockEquipment.length} items tracked`}
          icon={<Package className="h-4 w-4" />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/equipment">Manage <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {mockEquipment.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{item.category}</p>
                </div>
                {item.condition && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.condition}
                  </span>
                )}
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* AI Insights + Notifications row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="AI Insights"
          description="AI-powered match preparation"
          icon={<Brain className="h-4 w-4" />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ai-insights">Open <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          }
        >
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">City Open 2026 — Preparation Ready</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clay court at 650m altitude with warm sunny conditions. AI analysis suggests adjusting string tension and increasing hydration prep.
            </p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link to="/ai-insights">View full analysis</Link>
            </Button>
          </div>
        </DashboardCard>

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
    </div>
  );
}
