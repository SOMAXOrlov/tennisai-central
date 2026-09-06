// ============================================================
// Incoming connection requests — dashboard surface
//
// The dashboards already computed the pending-inbound list but never showed
// it, so an approval could only be found by navigating to /connections. This
// card renders it in place with the same approve/reject calls the Connections
// page uses (ConnectionStore.updateStatus), and renders nothing at all when
// there is no request waiting.
// ============================================================

import { Link } from "react-router-dom";
import { interleave, slot, useT } from "@/lib/i18n";

/** Intl options for the "received on" date. */
const REQUEST_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
import { ArrowDownLeft, ArrowRight, Check, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { RoleBadge } from "@/components/ui/shared";
import { toast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { useAuth } from "@/auth/AuthContext";
import { useConnections } from "@/store/ConnectionStore";
import type { ConnectionRequest } from "@/types";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function RequestRow({
  request,
  onApprove,
  onReject,
}: {
  request: ConnectionRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t, formatDate } = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {initials(request.fromUserName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{request.fromUserName}</p>
          <RoleBadge role={request.fromUserRole} />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowDownLeft className="h-3 w-3" />
          {t("connections.receivedOn", { date: formatDate(new Date(request.createdAt), REQUEST_DATE) })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => onApprove(request.id)}
        >
          <Check className="h-3.5 w-3.5" /> {t("connections.approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => onReject(request.id)}
        >
          <X className="h-3.5 w-3.5" /> {t("connections.reject")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Pending requests addressed to the signed-in user. Returns `null` when the
 * inbox is empty so it never occupies dashboard space without content.
 */
export function IncomingRequestsCard({ max = 4 }: { max?: number }) {
  const { user } = useAuth();
  const { requests, updateStatus } = useConnections();
  const userId = user?.id ?? "";

  const incoming = requests.filter((r) => r.status === "pending" && r.toUserId === userId);
  if (incoming.length === 0) return null;

  const decide = (id: string, next: "active" | "rejected") => {
    const res = updateStatus(id, next);
    if (res.ok) {
      toast({ title: t(next === "active" ? "toast.connection.approved" : "toast.connection.rejected") });
    } else {
      toast({
        title: t(next === "active" ? "toast.connection.approveFailed" : "toast.connection.rejectFailed"),
        description: res.reason,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardCard
      title={t("connections.incomingCard.title")}
      description={t("connections.incomingCard.waiting", { count: incoming.length })}
      icon={<Inbox className="h-4 w-4" />}
      badge={
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {incoming.length}
        </span>
      }
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            {t("connections.incomingCard.allConnections")} <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {incoming.slice(0, max).map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            onApprove={(id) => decide(id, "active")}
            onReject={(id) => decide(id, "rejected")}
          />
        ))}
        {incoming.length > max && (
          <p className="text-xs text-muted-foreground">
            {interleave(t("connections.incomingCard.moreOn", { count: incoming.length - max, link: slot(0) }), [
              <Link key="link" to="/connections" className="font-medium text-primary hover:underline">
                {t("connections.incomingCard.connections")}
              </Link>,
            ])}
          </p>
        )}
      </div>
    </DashboardCard>
  );
}
