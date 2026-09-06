// Profile — Edit profile with save via service layer
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useUpdateProfile } from "@/hooks/api/queries";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { RoleBadge } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { User, Copy, Check, ClipboardList, Pencil, CalendarRange, Trophy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCalendarPreferences, useSaveCalendarPreferences } from "@/hooks/api/queries";
import { toastSuccess } from "@/lib/feedback";
import { onboardingApi } from "@/api/endpoints/onboarding";
import { questionsForRole } from "@/lib/onboarding/questions";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";

/** The tours a user can subscribe to, described in a coach's terms. */
// The federation code doubles as its own label (they are codes, not words to
// translate); only the one-line explanation is copy, looked up per render.
const FEDERATION_OPTIONS = ["ITF", "UTR", "ATP", "WTA", "USTA"] as const;

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useT();
  const updateMut = useUpdateProfile();
  const { data: calendarPrefs } = useCalendarPreferences();
  const saveCalendarPrefs = useSaveCalendarPreferences();
  const subscribed = useMemo(() => new Set(calendarPrefs?.federations ?? []), [calendarPrefs]);
  // Real shareable ID from the API (was a hardcoded map that showed "TAI-X-000"
  // for every non-seeded account, which broke new users' ability to connect).
  const publicId = user?.publicId ?? "—";
  const [copied, setCopied] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const { data: onboarding, refetch: refetchOnboarding } = useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => (await onboardingApi.get()).data,
    enabled: !!user,
  });
  const [editOpen, setEditOpen] = useState(false);
  const answers = useMemo(() => onboarding?.answers ?? {}, [onboarding]);
  const roleQuestions = user ? questionsForRole(user.role) : [];
  const answeredQuestions = roleQuestions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : Boolean(a && String(a).trim());
  });
  const fmtAnswer = (a: string | string[] | undefined) => (Array.isArray(a) ? a.join(", ") : (a ?? ""));

  const copyId = () => {
    navigator.clipboard.writeText(publicId);
    setCopied(true);
    toastSuccess("toast.profile.publicIdCopied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    updateMut.mutate({ firstName, lastName, email });
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">{t("profile.title")}</h1><p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p></div>
      <DashboardCard title={t("profile.information")} icon={<User className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div>
              <p className="text-lg font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
              <div className="flex items-center gap-2 mt-1"><RoleBadge role={user?.role ?? "player"} /><span className="text-sm text-muted-foreground">{user?.email}</span></div>
            </div>
          </div>
          {user?.role !== "admin" && (
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <Label className="text-xs text-muted-foreground">{t("profile.publicId")}</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 font-mono text-lg font-bold tracking-wider text-foreground">{publicId}</code>
                <Button variant="outline" size="icon" aria-label={copied ? t("a11y.profile.publicIdCopied") : t("a11y.profile.copyPublicId")} onClick={copyId}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("profile.publicIdHint")}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="profile-first-name">{t("profile.firstName")}</Label><Input id="profile-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-last-name">{t("profile.lastName")}</Label><Input id="profile-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="profile-email">{t("profile.email")}</Label><Input id="profile-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
          </div>
          <Button onClick={handleSave} disabled={updateMut.isPending}>{updateMut.isPending ? t("profile.saving") : t("profile.save")}</Button>
        </div>
      </DashboardCard>

      <DashboardCard
        title={t("profile.questionnaire")}
        description={t("profile.questionnaireDescription")}
        icon={<ClipboardList className="h-4 w-4" />}
        action={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> {t("profile.editAnswers")}
          </Button>
        }
      >
        {answeredQuestions.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">{t("profile.notCompleted")}</p>
            <Button size="sm" className="mt-3" onClick={() => setEditOpen(true)}>{t("profile.completeSetup")}</Button>
          </div>
        ) : (
          <dl className="space-y-3">
            {answeredQuestions.map((q) => (
              <div key={q.id} className="border-b border-border pb-2 last:border-0">
                <dt className="text-xs text-muted-foreground">{q.prompt}</dt>
                <dd className="text-sm font-medium text-foreground">{fmtAnswer(answers[q.id])}</dd>
              </div>
            ))}
          </dl>
        )}
      </DashboardCard>

      <DashboardCard title={t("profile.calendars")} icon={<CalendarRange className="h-4 w-4" />}>
        <p className="mb-3 text-sm text-muted-foreground">{t("profile.calendarsHint")}</p>

        <div className="space-y-1">
          {FEDERATION_OPTIONS.map((f) => {
            const on = subscribed.has(f);
            return (
              <label
                key={f}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/20"
              >
                <Switch
                  checked={on}
                  onCheckedChange={() => {
                    const next = new Set(subscribed);
                    if (next.has(f)) next.delete(f); else next.add(f);
                    saveCalendarPrefs.mutate({ federations: [...next] });
                  }}
                  aria-label={f}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{f}</span>
                  <span className="block text-xs text-muted-foreground">{t(`profile.federation.${f}`)}</span>
                </span>
              </label>
            );
          })}
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-3 border-t border-border pt-3">
          <Switch
            checked={calendarPrefs?.showOwnEvents ?? true}
            onCheckedChange={(checked) =>
              saveCalendarPrefs.mutate({ federations: [...subscribed], showOwnEvents: checked })
            }
            aria-label={t("profile.ownSessionsAria")}
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{t("profile.ownSessions")}</span>
            <span className="block text-xs text-muted-foreground">{t("profile.ownSessionsHint")}</span>
          </span>
        </label>
      </DashboardCard>

      {user && (
        <OnboardingDialog
          user={user}
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) refetchOnboarding();
          }}
          initialAnswers={answers}
        />
      )}
    </div>
  );
}
