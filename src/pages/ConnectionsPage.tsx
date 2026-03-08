import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mockConnectionRequests } from "@/mock/data";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  Search,
  UserPlus,
  Users,
  Clock,
} from "lucide-react";
import type { ConnectionRequest, ConnectionStatus } from "@/types";
import { format } from "date-fns";

// ─── Helpers ───

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    player: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    coach: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    observer: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    admin: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        styles[role] || "bg-muted text-muted-foreground"
      }`}
    >
      {role === "observer" ? "Fan" : role}
    </span>
  );
}

function formatDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

// ─── Request Row ───

function RequestRow({
  req,
  perspective,
  onApprove,
  onReject,
}: {
  req: ConnectionRequest;
  perspective: "sent" | "received";
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isSent = perspective === "sent";
  const name = isSent ? req.toUserName : req.fromUserName;
  const role = isSent ? req.toUserRole : req.fromUserRole;
  const isPending = req.status === "pending";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30">
      {/* Avatar placeholder */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {name.split(" ").map((n) => n[0]).join("")}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          {roleBadge(role)}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {isSent ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownLeft className="h-3 w-3" />
          )}
          <span>{isSent ? "Sent" : "Received"} {formatDate(req.createdAt)}</span>
        </div>
      </div>

      {/* Status / Actions */}
      <div className="flex items-center gap-2">
        {isPending && !isSent ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onApprove(req.id)}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onReject(req.id)}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </>
        ) : isPending && isSent ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Awaiting response
          </div>
        ) : (
          <StatusBadge status={req.status} />
        )}
      </div>
    </div>
  );
}

// ─── Page ───

export default function ConnectionsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [requests, setRequests] = useState<ConnectionRequest[]>(mockConnectionRequests);
  const [search, setSearch] = useState("");

  const sent = useMemo(
    () =>
      requests
        .filter((r) => r.fromUserId === userId)
        .filter(
          (r) =>
            !search ||
            r.toUserName.toLowerCase().includes(search.toLowerCase())
        ),
    [requests, userId, search]
  );

  const received = useMemo(
    () =>
      requests
        .filter((r) => r.toUserId === userId)
        .filter(
          (r) =>
            !search ||
            r.fromUserName.toLowerCase().includes(search.toLowerCase())
        ),
    [requests, userId, search]
  );

  const pendingReceivedCount = received.filter((r) => r.status === "pending").length;

  const updateStatus = (id: string, status: ConnectionStatus) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Manage your connection requests with players, coaches, and fans.
          </p>
        </div>
        <Button className="gap-2 self-start">
          <UserPlus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Sent", value: sent.length, icon: ArrowUpRight },
          { label: "Total Received", value: received.length, icon: ArrowDownLeft },
          {
            label: "Pending Approval",
            value: pendingReceivedCount,
            icon: Clock,
          },
          {
            label: "Active Connections",
            value: requests.filter((r) => r.status === "accepted").length,
            icon: Users,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received" className="gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            Received
            {pendingReceivedCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {pendingReceivedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <DashboardCard
            title="Received Requests"
            description={`${received.length} request${received.length !== 1 ? "s" : ""}`}
          >
            {received.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No received requests{search ? " matching your search" : ""}.
              </p>
            ) : (
              <div className="space-y-3">
                {received.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    perspective="received"
                    onApprove={(id) => updateStatus(id, "accepted")}
                    onReject={(id) => updateStatus(id, "rejected")}
                  />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="sent">
          <DashboardCard
            title="Sent Requests"
            description={`${sent.length} request${sent.length !== 1 ? "s" : ""}`}
          >
            {sent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sent requests{search ? " matching your search" : ""}.
              </p>
            ) : (
              <div className="space-y-3">
                {sent.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    perspective="sent"
                    onApprove={(id) => updateStatus(id, "accepted")}
                    onReject={(id) => updateStatus(id, "rejected")}
                  />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
