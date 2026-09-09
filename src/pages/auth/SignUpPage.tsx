import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ageFromIsoDate, todayUtc, toIsoDate } from "@/lib/age";
import { FALLBACK_SIGNUP_POLICY, fetchSignupPolicy, type SignupPolicy } from "./signupPolicy";
import type { UserRole } from "@/types";
import { interleave, slot, useT } from "@/lib/i18n";

// Only the role keys live here; the label and blurb are looked up during render
// so a language switch reaches them (a module constant would freeze to "en").
// "observer" (the parent role) is deliberately not offered. An observer account
// links to nothing today — the guardianship table has never had a row written
// by any route — so offering it would create accounts that see an empty app.
// The role still exists server-side and in every dashboard; this only removes
// it from the door. Put it back here when guardianship linking ships.
const roles: UserRole[] = ["player", "coach"];

/** One live-checked rule under the password box. */
function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  const Icon = met ? Check : X;
  return (
    <li
      className={`flex items-center gap-1.5 ${met ? "text-primary" : "text-muted-foreground"}`}
      data-met={met}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function SignUpPage() {
  const { signUp } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    guardianName: "",
    guardianEmail: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  /** Which "we're done" screen to show — the two outcomes need different words. */
  const [awaitingGuardian, setAwaitingGuardian] = useState(false);

  // The age of digital consent and the password minimum are the SERVER's, not
  // this form's. Rendering starts with the fallback and corrects itself, so the
  // form is never blocked on this request.
  const [policy, setPolicy] = useState<SignupPolicy>(FALLBACK_SIGNUP_POLICY);
  useEffect(() => {
    let cancelled = false;
    void fetchSignupPolicy().then((p) => {
      if (!cancelled) setPolicy(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Derived, not stored: the age comes from the date of birth on every render,
  // so it can never drift out of step with what the field says.
  //
  // UTC, NOT the browser's local day — deliberately, because the SERVER decides
  // in UTC. East of UTC the two calendars disagree for a few hours after local
  // midnight, and if this form used the local day it would hide the guardian
  // fields on someone's 16th birthday morning while the server still counted
  // them as 15 — leaving them with an error asking for fields that are not on
  // the screen. Agreeing with the server costs a UTC+ user a couple of hours of
  // being asked for a guardian they no longer need, which is the safe direction.
  const age = form.dateOfBirth ? ageFromIsoDate(form.dateOfBirth, todayUtc()) : null;
  const dateOfBirthInvalid = form.dateOfBirth !== "" && age === null;
  const isMinor = age !== null && age < policy.minorAgeThreshold;

  const passwordLongEnough = form.password.length >= policy.passwordMinLength;
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;
  const passwordTouched = form.password.length > 0 || form.confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!role) return setError(t("auth.signUp.errors.role"));
    if (!form.dateOfBirth) return setError(t("auth.signUp.errors.dateOfBirthMissing"));
    if (age === null) return setError(t("auth.signUp.errors.dateOfBirthInvalid"));
    if (!passwordLongEnough)
      return setError(t("auth.signUp.errors.passwordLength", { count: policy.passwordMinLength }));
    if (form.password !== form.confirmPassword) return setError(t("auth.signUp.errors.passwordMismatch"));
    if (isMinor && (!form.guardianName.trim() || !form.guardianEmail.trim())) {
      return setError(t("auth.signUp.errors.guardianMissing"));
    }
    if (isMinor && form.guardianEmail.trim().toLowerCase() === form.email.trim().toLowerCase()) {
      return setError(t("auth.signUp.errors.guardianSameEmail"));
    }
    if (!termsAccepted) return setError(t("auth.signUp.errors.terms"));

    setLoading(true);
    try {
      const msg = await signUp({
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        firstName: form.firstName,
        lastName: form.lastName,
        role,
        dateOfBirth: form.dateOfBirth,
        // Derived from the date of birth rather than self-declared. The server
        // ignores it whenever a date of birth is present; it is still sent so an
        // older API that only understands the checkbox keeps working.
        ageConfirmed: !isMinor,
        termsAccepted,
        ...(isMinor
          ? { guardianName: form.guardianName.trim(), guardianEmail: form.guardianEmail.trim() }
          : {}),
      });
      setAwaitingGuardian(isMinor);
      setSuccessMsg(msg || t("auth.signUp.done.default"));
    } catch (err) {
      setError(err?.message || t("auth.signUp.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {awaitingGuardian ? t("auth.signUp.done.waiting") : t("auth.signUp.done.checkEmail")}
        </h2>
        <p className="text-sm text-muted-foreground">{successMsg}</p>
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/login")}>{t("auth.goToLogin")}</Button>
          {/* The resend link is about EMAIL VERIFICATION, which is not what a
              minor is waiting on — offering it here would send them chasing the
              wrong email. */}
          {!awaitingGuardian && (
            <button
              type="button"
              onClick={() => navigate("/verify-email")}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("auth.signUp.done.resend")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{t("auth.signUp.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.signUp.subtitle")}</p>
      </div>
      {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {/* Role selector */}
      <div className="grid grid-cols-3 gap-2">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-lg border p-3 text-center text-sm transition-colors ${
              role === r
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            <div className="font-medium">{t(`auth.signUp.roles.${r}.label`)}</div>
            <div className="mt-1 text-xs leading-tight">{t(`auth.signUp.roles.${r}.description`)}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="firstName">{t("auth.signUp.firstName")}</Label>
          <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lastName">{t("auth.signUp.lastName")}</Label>
          <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
      </div>

      {/* Date of birth replaces the old "I am 16 or older" tick. The product
          ships ITF JUNIOR calendars, so under-16s are core users rather than an
          edge case — they need a way in, not a box they have to lie in. */}
      <div className="space-y-1">
        <Label htmlFor="dateOfBirth">{t("auth.signUp.dateOfBirth")}</Label>
        <Input
          id="dateOfBirth"
          type="date"
          value={form.dateOfBirth}
          max={toIsoDate(todayUtc())}
          onChange={(e) => update("dateOfBirth", e.target.value)}
          aria-describedby="dob-hint"
          aria-invalid={dateOfBirthInvalid || undefined}
          required
        />
        <p id="dob-hint" className="text-xs text-muted-foreground">
          {dateOfBirthInvalid
            ? t("auth.signUp.dateOfBirthInvalid")
            : t("auth.signUp.dateOfBirthHint", { age: policy.minorAgeThreshold })}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          aria-describedby="password-rules"
          required
        />
        {/* The rule, stated up front and checked as you type — rather than
            revealed only by a rejected submit. */}
        <ul id="password-rules" className="space-y-0.5 pt-0.5 text-xs" aria-live="polite">
          <Rule met={passwordLongEnough}>{t("auth.signUp.ruleLength", { count: policy.passwordMinLength })}</Rule>
          {passwordTouched && <Rule met={passwordsMatch}>{t("auth.signUp.ruleMatch")}</Rule>}
        </ul>
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">{t("auth.signUp.confirmPassword")}</Label>
        <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} required />
      </div>

      {/* Shown only below the age of digital consent — which is the SERVER's
          number (GDPR leaves it to each member state: Spain 14, Germany 16). */}
      {isMinor && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">{t("auth.signUp.guardian.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("auth.signUp.guardian.body", { age: policy.minorAgeThreshold })}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="guardianName">{t("auth.signUp.guardian.name")}</Label>
            <Input
              id="guardianName"
              value={form.guardianName}
              onChange={(e) => update("guardianName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="guardianEmail">{t("auth.signUp.guardian.email")}</Label>
            <Input
              id="guardianEmail"
              type="email"
              value={form.guardianEmail}
              onChange={(e) => update("guardianEmail", e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{t("auth.signUp.guardian.emailHint")}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} />
        <Label htmlFor="terms" className="text-sm text-muted-foreground">
          {/* One sentence with two links in it: the copy carries {terms} and
              {privacy} as slots so Spanish can order them its own way, and the
              filled slots are split back out to hang the <Link>s on. */}
          {interleave(t("auth.signUp.terms", { terms: slot(0), privacy: slot(1) }), [
            <Link key="terms" to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
              {t("auth.signUp.termsLink")}
            </Link>,
            <Link key="privacy" to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
              {t("auth.signUp.privacyLink")}
            </Link>,
          ])}
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? t("auth.signUp.submitting") : t("auth.signUp.submit")}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.signUp.haveAccount")}{" "}
        <Link to="/login" className="text-primary hover:underline">{t("auth.signIn")}</Link>
      </p>
    </form>
  );
}
