// Notification Settings — Toggle preferences via React Query
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/api/queries";
import { ErrorState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useT } from "@/lib/i18n";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Dumbbell, Trophy, UserPlus, Wallet, Brain, Settings } from "lucide-react";
import type { NotificationSettings } from "@/types";

// Keys and icons only; the name and blurb come from
// `notifications.setting.<key>` at render time.
const SETTINGS: { key: keyof NotificationSettings; icon: React.ReactNode }[] = [
  { key: "trainingReminders", icon: <Dumbbell className="h-4 w-4" /> },
  { key: "tournamentReminders", icon: <Trophy className="h-4 w-4" /> },
  { key: "requestApprovals", icon: <UserPlus className="h-4 w-4" /> },
  { key: "financeUpdates", icon: <Wallet className="h-4 w-4" /> },
  { key: "aiInsightUpdates", icon: <Brain className="h-4 w-4" /> },
  { key: "systemNotifications", icon: <Settings className="h-4 w-4" /> },
];

export default function NotificationSettingsPage() {
  const { data: prefs, isLoading, error, refetch } = useNotificationPreferences();
  const { t } = useT();
  const updateMut = useUpdateNotificationPreferences();

  if (isLoading) return <PageSkeleton variant="list" rows={4} />;
  if (error) return <ErrorState error={error} message={t("states.load.preferences")} onRetry={() => void refetch()} />;
  if (!prefs) return null;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">{t("notifications.settingsTitle")}</h1><p className="text-muted-foreground">{t("notifications.settingsSubtitle")}</p></div>
      <DashboardCard title={t("notifications.preferences")} icon={<Bell className="h-4 w-4" />}>
        <div className="space-y-6">
          {SETTINGS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{s.icon}</div>
                <div><Label htmlFor={`notif-${s.key}`} className="text-sm font-medium">{t(`notifications.setting.${s.key}.label`)}</Label><p className="text-xs text-muted-foreground">{t(`notifications.setting.${s.key}.description`)}</p></div>
              </div>
              <Switch id={`notif-${s.key}`} checked={prefs[s.key]} onCheckedChange={(checked) => updateMut.mutate({ [s.key]: checked })} />
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
