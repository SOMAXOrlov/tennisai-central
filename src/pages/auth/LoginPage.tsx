import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The one login failure with a next step: the account exists and the password
  // was right, but the address was never confirmed.
  const [needsVerification, setNeedsVerification] = useState(false);
  // The other one: an under-age account whose parent or guardian has not
  // approved it yet. Nothing the person at the keyboard can do about it, so the
  // screen must not push them into the password-reset loop.
  const [awaitingGuardian, setAwaitingGuardian] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setAwaitingGuardian(false);
    setLoading(true);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      const message = err?.message || t("auth.login.failed");
      setError(message);
      // Three distinguishable outcomes, by status:
      //   401 — the uniform "invalid email or password" (could be either).
      //   403 — correct credentials, unverified email.
      //   423 — correct credentials, waiting on a guardian's approval.
      // The last has its own status precisely so it is never shown as a
      // credential failure to a 14-year-old who typed everything correctly.
      setNeedsVerification(err?.status === 403);
      setAwaitingGuardian(err?.status === 423);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground coarse:min-h-11">
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backHome")}
      </Link>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{t("auth.login.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>
      {/* Waiting on a guardian is not an error the person made — it gets its own
          neutral panel rather than the red "you got it wrong" one. */}
      {awaitingGuardian ? (
        <div
          role="status"
          className="space-y-1 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">{t("auth.login.guardian.title")}</p>
          <p>{error}</p>
          <p className="text-xs">
            {t("auth.login.guardian.hint")}
          </p>
        </div>
      ) : (
        error && (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          {/* Being told to check an inbox is useless without a way to make the
              email arrive again — the first one expires, or never came. */}
          {needsVerification && (
            <>
              {" "}
              <Link to="/verify-email" className="font-medium underline underline-offset-4">
                {t("auth.login.resend")}
              </Link>
            </>
          )}
        </div>
        )
      )}
      <div className="space-y-1">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("auth.emailPlaceholder")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.login.submitting") : t("auth.signIn")}
      </Button>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:items-center">{t("auth.login.forgot")}</Link>
        <Link to="/signup" className="text-primary hover:underline coarse:inline-flex coarse:min-h-11 coarse:items-center">{t("auth.login.createAccount")}</Link>
      </div>
    </form>
    </div>
  );
}
