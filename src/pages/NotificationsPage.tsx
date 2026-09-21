// Notifications — the inbox, with what a person can do with each one.
//
// Open (follow the server's link: a calendar day and event, a tournament, the
// finance page), mark read, archive (out of the inbox and the unread count,
// still there under Archived), restore, delete. Three tabs: All is the inbox,
// Unread is the inbox's unread rows, Archived is what has been filed away.
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
  useUnarchiveNotification,
  useDeleteNotification,
} from "@/hooks/api/queries";
import { useT } from "@/lib/i18n";
import { inInbox, internalPath, isUnread } from "@/lib/notifications";
import { ErrorState, EmptyState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, ArchiveRestore, CheckCheck, ChevronRight, Inbox, Settings2, Trash2 } from "lucide-react";
import { NotificationPreferencesCard } from "@/components/notifications/NotificationPreferencesCard";

type Filter = "all" | "unread" | "archived";

export default function NotificationsPage() {
  const { t, formatDate } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? "";
  const { data: notifications = [], isLoading, error, refetch } = useNotifications(userId);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const archive = useArchiveNotification();
  const unarchive = useUnarchiveNotification();
  const remove = useDeleteNotification();
  const [filter, setFilter] = useState<Filter>("all");
  const [showPrefs, setShowPrefs] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter(isUnread);
    if (filter === "archived") return notifications.filter((n) => !inInbox(n));
    return notifications.filter(inInbox);
  }, [notifications, filter]);

  const unreadCount = notifications.filter(isUnread).length;
  const inboxCount = notifications.filter(inInbox).length;

  if (isLoading) return <PageSkeleton variant="list" />;
  if (error) return <ErrorState error={error} message={t("states.load.notifications")} onRetry={() => void refetch()} />;

  const emptyState = () => {
    if (filter === "unread") {
      return <EmptyState icon={<Inbox className="h-6 w-6 text-muted-foreground" />} title={t("empty.notifications.unread.title")} description={t("empty.notifications.unread.description")} />;
    }
    if (filter === "archived") {
      return <EmptyState icon={<Archive className="h-6 w-6 text-muted-foreground" />} title={t("empty.notifications.archived.title")} description={t("empty.notifications.archived.description")} />;
    }
    // First run: the inbox has never had anything in it. The one useful
    // thing to do here is decide what should arrive — the settings card.
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6 text-muted-foreground" />}
        title={t("empty.notifications.title")}
        description={t("empty.notifications.description")}
        action={!showPrefs ? <Button variant="outline" className="gap-1.5" onClick={() => setShowPrefs(true)}><Settings2 className="h-4 w-4" /> {t("empty.notifications.action")}</Button> : undefined}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("notifications.title")}</h1>
          <p className="text-muted-foreground">{unreadCount > 0 ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.allCaughtUp")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllRead.mutate(userId)} disabled={markAllRead.isPending}>
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAllRead")}
            </Button>
          )}
          {/* The first-run empty state below offers the same action as its
              call to action; showing both put two "settings" buttons at two
              sizes on one screen. The header keeps it once there is anything
              in the inbox, or while the card is open and needs a way to close. */}
          {(showPrefs || inboxCount > 0 || filter !== "all") && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrefs((v) => !v)}>
              <Settings2 className="h-3.5 w-3.5" /> {showPrefs ? t("notifications.hideSettings") : t("notifications.settings")}
            </Button>
          )}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">{t("notifications.tabAll")}</TabsTrigger>
              <TabsTrigger value="unread">{unreadCount > 0 ? t("notifications.tabUnreadCount", { count: unreadCount }) : t("notifications.tabUnread")}</TabsTrigger>
              <TabsTrigger value="archived">{t("notifications.tabArchived")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {showPrefs && <NotificationPreferencesCard />}

      {filtered.length === 0 ? (
        emptyState()
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const target = internalPath(n.linkTo);
            const archived = !inInbox(n);
            const busy = archive.isPending || unarchive.isPending || remove.isPending;
            return (
              <li
                key={n.id}
                className={`group flex items-start gap-2 rounded-xl border border-border p-2 pl-4 transition-colors hover:bg-accent/20 ${target ? "hover:border-primary/40" : ""} ${isUnread(n) ? "bg-primary/5 border-primary/20" : "bg-card"}`}
              >
                <button
                  type="button"
                  aria-label={target ? t("notifications.openAria", { title: n.title, message: n.message }) : t("notifications.rowAria", { title: n.title, message: n.message })}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    if (target) navigate(target);
                  }}
                  className={`flex min-w-0 flex-1 items-start gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${target ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-muted" : "bg-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(new Date(n.createdAt), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {target && (
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    />
                  )}
                </button>
                <div className="flex shrink-0 items-center">
                  {archived ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("notifications.unarchiveAria", { title: n.title })} title={t("notifications.unarchive")} disabled={busy} onClick={() => unarchive.mutate(n.id)}>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("notifications.archiveAria", { title: n.title })} title={t("notifications.archive")} disabled={busy} onClick={() => archive.mutate(n.id)}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={t("notifications.deleteAria", { title: n.title })} title={t("notifications.delete")} disabled={busy} onClick={() => remove.mutate(n.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
