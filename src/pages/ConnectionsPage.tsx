import { useState, useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import { useT } from "@/lib/i18n";
import { StatusBadge, RoleBadge, EmptyState } from "@/components/ui/shared";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { NewConnectionDialog } from "@/components/connections/NewConnectionDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  Search,
  UserPlus,
  Users,
  Clock,
  LinkIcon,
  Unlink,
} from "lucide-react";
import type { RelationshipStatus } from "@/types";
import { formatDate as formatDateIntl } from "@/lib/i18n";

/** Intl, not date-fns: the clock and month conventions follow the reader. */
function formatDate(iso: string) {
  return formatDateIntl(new Date(iso), { year: "numeric", month: "short", day: "numeric" });
}

// ─── Request Row ───

export function RequestRow({
  req,
  perspective,
  currentUserId,
  onApprove,
  onReject,
  onRevoke,
}: {
  req: { id: string; fromUserId: string; fromUserName: string; fromUserRole: string; toUserId: string; toUserName: string; toUserRole: string; status: RelationshipStatus; createdAt: string };
  perspective: "sent" | "received";
  currentUserId: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onRevoke?: (id: string) => void;
}) {
  const isSent = perspective === "sent";
  const name = isSent ? req.toUserName : req.fromUserName;
  const role = isSent ? req.toUserRole : req.fromUserRole;
  const isPending = req.status === "pending";
  const isActive = req.status === "active";
  const isRecipient = req.toUserId === currentUserId;
  const isParticipant = req.fromUserId === currentUserId || req.toUserId === currentUserId;
  const canDecide = isPending && isRecipient;
  const canRevoke = isActive && isParticipant;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {name.split(" ").map((n) => n[0]).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          <RoleBadge role={role as any} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {isSent ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
          <span>{isSent ? t("connections.sentOn", { date: formatDate(req.createdAt) }) : t("connections.receivedOn", { date: formatDate(req.createdAt) })}</span>
        </div>
      </div>
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center gap-2">
          {isPending && !isSent && onApprove && onReject ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canDecide}
                      className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => canDecide && onApprove(req.id)}
                    >
                      <Check className="h-3.5 w-3.5" /> {t("connections.approve")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canDecide && (
                  <TooltipContent>{t("connections.approveDisabled")}</TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canDecide}
                      className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => canDecide && onReject(req.id)}
                    >
                      <X className="h-3.5 w-3.5" /> {t("connections.reject")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canDecide && (
                  <TooltipContent>{t("connections.rejectDisabled")}</TooltipContent>
                )}
              </Tooltip>
            </>
          ) : isPending && isSent ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {t("connections.awaiting")}
            </div>
          ) : isActive && onRevoke ? (
            <div className="flex items-center gap-2">
              <StatusBadge status="active" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canRevoke}
                      className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => canRevoke && onRevoke(req.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" /> {t("connections.revoke")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canRevoke && (
                  <TooltipContent>{t("connections.revokeDisabled")}</TooltipContent>
                )}
              </Tooltip>
            </div>
          ) : (
            <StatusBadge status={req.status} />
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}

// ─── Page ───

export default function ConnectionsPage() {
  const { t } = useT();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const role = user?.role ?? "player";
  const { requests, sendRequest, updateStatus, revokeRelationship } = useConnections();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const matchesSearch = (name: string) => !search || name.toLowerCase().includes(search.toLowerCase());

  const incoming = useMemo(
    () => requests.filter((r) => r.toUserId === userId && r.status === "pending" && matchesSearch(r.fromUserName)),
    [requests, userId, search]
  );

  const sent = useMemo(
    () => requests.filter((r) => r.fromUserId === userId && r.status === "pending" && matchesSearch(r.toUserName)),
    [requests, userId, search]
  );

  const active = useMemo(
    () => requests.filter((r) => r.status === "active" && (r.fromUserId === userId || r.toUserId === userId))
      .filter((r) => matchesSearch(r.fromUserId === userId ? r.toUserName : r.fromUserName)),
    [requests, userId, search]
  );

  const revoked = useMemo(
    () => requests.filter((r) => r.status === "revoked" && (r.fromUserId === userId || r.toUserId === userId))
      .filter((r) => matchesSearch(r.fromUserId === userId ? r.toUserName : r.fromUserName)),
    [requests, userId, search]
  );

  const rejected = useMemo(
    () => requests.filter((r) => r.status === "rejected" && (r.fromUserId === userId || r.toUserId === userId))
      .filter((r) => matchesSearch(r.fromUserId === userId ? r.toUserName : r.fromUserName)),
    [requests, userId, search]
  );

  // Role-based: Player only sees incoming. Coach/Observer can send.
  const canSend = role === "coach" || role === "observer";
  const pageTitle = role === "admin" ? t("connections.adminTitle") : t("connections.title");
  const pageDesc = t(`connections.subtitle.${role === "player" || role === "coach" || role === "observer" ? role : "admin"}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDesc}</p>
        </div>
        {(canSend || role === "player") && (
          <Button className="gap-2 self-start" onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" /> {t("connections.newRequest")}
          </Button>
        )}
      </div>

      <NewConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} onRequestSent={sendRequest} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { key: "incoming", value: incoming.length, icon: ArrowDownLeft },
          { key: "sent", value: sent.length, icon: ArrowUpRight },
          { key: "active", value: active.length, icon: LinkIcon },
          { key: "revoked", value: revoked.length, icon: Unlink },
        ].map((s) => (
          <div key={s.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{t(`connections.stat.${s.key}`)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={t("a11y.search.connections")} placeholder={t("connections.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="incoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incoming" className="gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5" /> {t("connections.stat.incoming")}
            {incoming.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {incoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5" /> {t("connections.stat.sent")}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> {t("connections.stat.active")}
          </TabsTrigger>
          <TabsTrigger value="revoked" className="gap-1.5">
            <Unlink className="h-3.5 w-3.5" /> {t("connections.stat.revoked")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming">
          <DashboardCard title={t("connections.card.incoming")} description={t("connections.pendingCount", { count: incoming.length })}>
            {incoming.length === 0 ? (
              <EmptyState title={t("empty.connections.incoming.title")} description={search ? t("empty.connections.search.description") : t("empty.connections.incoming.description")} />
            ) : (
              <div className="space-y-3">
                {incoming.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                perspective="received"
                currentUserId={userId}
                onApprove={(id) => {
                  const res = updateStatus(id, "active");
                  if (res.ok) toast({ title: t("toast.connection.approved") });
                  else toast({ title: t("toast.connection.approveFailed"), description: res.reason, variant: "destructive" });
                }}
                onReject={(id) => {
                  const res = updateStatus(id, "rejected");
                  if (res.ok) toast({ title: t("toast.connection.rejected") });
                  else toast({ title: t("toast.connection.rejectFailed"), description: res.reason, variant: "destructive" });
                }}
              />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="sent">
          <DashboardCard title={t("connections.card.sent")} description={t("connections.pendingCount", { count: sent.length })}>
            {sent.length === 0 ? (
              <EmptyState title={t("empty.connections.sent.title")} description={search ? t("empty.connections.search.description") : t("empty.connections.sent.description")} />
            ) : (
              <div className="space-y-3">
                {sent.map((req) => (
                  <RequestRow key={req.id} req={req} perspective="sent" currentUserId={userId} />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="active">
          <DashboardCard title={t("connections.card.active")} description={t("connections.activeCount", { count: active.length })}>
            {active.length === 0 ? (
              // The first-run state of this page: nobody is linked yet. Every
              // role that can send a request gets the dialog as its next step;
              // an admin only views records, so no action.
              <EmptyState
                title={t("empty.connections.active.title")}
                description={
                  search
                    ? t("empty.connections.search.description")
                    : role === "coach"
                    ? t("empty.connections.active.coach.description")
                    : role === "observer"
                    ? t("empty.connections.active.observer.description")
                    : role === "player"
                    ? t("empty.connections.active.player.description")
                    : t("empty.connections.active.admin.description")
                }
                action={
                  !search && (canSend || role === "player") ? (
                    <Button onClick={() => setDialogOpen(true)} className="gap-1.5"><UserPlus className="h-4 w-4" /> {t("empty.connections.active.action")}</Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {active.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    perspective={req.fromUserId === userId ? "sent" : "received"}
                    currentUserId={userId}
                    onRevoke={(id) => {
                      const res = revokeRelationship(id);
                      if (res.ok) toast({ title: t("toast.connection.revoked") });
                      else toast({ title: t("toast.connection.revokeFailed"), description: res.reason, variant: "destructive" });
                    }}
                  />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="revoked">
          <DashboardCard title={t("connections.card.revoked")} description={t("connections.relationshipCount", { count: revoked.length + rejected.length })}>
            {revoked.length + rejected.length === 0 ? (
              <EmptyState title={t("empty.connections.revoked.title")} description={t("empty.connections.revoked.description")} />
            ) : (
              <div className="space-y-3">
                {[...revoked, ...rejected].map((req) => (
                  <RequestRow key={req.id} req={req} perspective={req.fromUserId === userId ? "sent" : "received"} currentUserId={userId} />
                ))}
              </div>
            )}
          </DashboardCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
