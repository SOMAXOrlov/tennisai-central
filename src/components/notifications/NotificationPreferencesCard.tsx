// Notification-settings surface: channel switches (Email/Push) + per-category
// toggles, plus a one-click "enable push on this device" action. Lives in the
// notify agent's area — rendered from NotificationsPage.
import { useState } from "react";
import { toastSuccess, toastError } from "@/lib/feedback";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/shared";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useT } from "@/lib/i18n";
import { BellRing, Mail, Smartphone } from "lucide-react";
import {
  useNotificationPreferencesFull,
  useUpdateNotificationPreferencesFull,
  usePushPublicKey,
  useSubscribePush,
} from "@/hooks/api/notifications";
import { enablePushOnThisDevice, isPushSupported } from "./pushClient";
import type { NotificationPreferencesFull } from "@/api/endpoints/notificationPrefs";

// Keys only; each name and blurb comes from
// `notifications.prefs.category.<key>` at render time.
const CATEGORY_FIELDS: (keyof NotificationPreferencesFull)[] = [
  "trainingReminders",
  "tournamentReminders",
  "requestApprovals",
  "financeUpdates",
  "aiInsightUpdates",
  "systemNotifications",
];

type DeviceStatus = "idle" | "enabled" | "unsupported" | "denied";

export function NotificationPreferencesCard() {
  const { data: prefs, isLoading, error, refetch } = useNotificationPreferencesFull();
  const { t } = useT();
  const update = useUpdateNotificationPreferencesFull();
  const { data: pushKey } = usePushPublicKey();
  const subscribePush = useSubscribePush();
  const [enabling, setEnabling] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("idle");

  if (isLoading) return <PageSkeleton variant="list" header={false} rows={4} />;
  if (error || !prefs) {
    return <ErrorState error={error} message={t("states.load.preferences")} onRetry={() => void refetch()} />;
  }

  const toggle = (key: keyof NotificationPreferencesFull) => (checked: boolean) => {
    update.mutate({ [key]: checked });
  };

  const publicKey = pushKey?.publicKey ?? null;
  const pushConfigured = Boolean(publicKey);

  async function handleEnablePush() {
    if (!publicKey) return;
    setEnabling(true);
    try {
      const sub = await enablePushOnThisDevice(publicKey);
      await subscribePush.mutateAsync({
        endpoint: sub.endpoint,
        keys: sub.keys,
        userAgent: navigator.userAgent,
      });
      setDeviceStatus("enabled");
      toastSuccess("toast.notification.pushEnabled");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't enable push on this device";
      setDeviceStatus(message.toLowerCase().includes("permission") ? "denied" : "unsupported");
      toastError("toast.notification.pushFailed", err);
    } finally {
      setEnabling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5 text-primary" /> {t("notifications.prefs.title")}
        </CardTitle>
        <CardDescription>{t("notifications.prefs.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t("notifications.prefs.channels")}</p>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <Label htmlFor="pref-email-enabled">{t("notifications.prefs.email")}</Label>
                <p className="text-xs text-muted-foreground">{t("notifications.prefs.emailHint")}</p>
              </div>
            </div>
            <Switch
              id="pref-email-enabled"
              checked={prefs.emailEnabled}
              onCheckedChange={toggle("emailEnabled")}
              disabled={update.isPending}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <Label htmlFor="pref-push-enabled">{t("notifications.prefs.push")}</Label>
                <p className="text-xs text-muted-foreground">
                  {pushConfigured ? t("notifications.prefs.pushHint") : t("notifications.prefs.pushNotConfigured")}
                </p>
              </div>
            </div>
            <Switch
              id="pref-push-enabled"
              checked={prefs.pushEnabled}
              onCheckedChange={toggle("pushEnabled")}
              disabled={update.isPending || !pushConfigured}
            />
          </div>

          {pushConfigured && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
              <div>
                <p className="text-sm text-foreground">{t("notifications.prefs.thisDevice")}</p>
                <p className="text-xs text-muted-foreground">
                  {deviceStatus === "enabled" && t("notifications.prefs.deviceEnabled")}
                  {deviceStatus === "unsupported" && t("notifications.prefs.deviceUnsupported")}
                  {deviceStatus === "denied" && t("notifications.prefs.deviceDenied")}
                  {deviceStatus === "idle" && t("notifications.prefs.deviceIdle")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={handleEnablePush}
                disabled={enabling || deviceStatus === "enabled" || !isPushSupported()}
              >
                {enabling ? t("notifications.prefs.enabling") : deviceStatus === "enabled" ? t("notifications.prefs.enabled") : t("notifications.prefs.enable")}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t("notifications.prefs.categories")}</p>
          {CATEGORY_FIELDS.map((key) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor={`pref-${key}`}>{t(`notifications.prefs.category.${key}.label`)}</Label>
                <p className="text-xs text-muted-foreground">{t(`notifications.prefs.category.${key}.description`)}</p>
              </div>
              <Switch
                id={`pref-${key}`}
                checked={prefs[key]}
                onCheckedChange={toggle(key)}
                disabled={update.isPending}
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">{update.isPending ? t("notifications.prefs.saving") : t("notifications.prefs.autoSave")}</p>
      </CardFooter>
    </Card>
  );
}
