import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "@/api/endpoints/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Set a new password from an emailed reset link (`/reset-password?token=…`).
 *
 * Three terminal states: no/invalid token, success, and a recoverable form error.
 * The token is only ever passed straight to the API — never displayed or stored.
 */
export default function ResetPasswordPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  /** True once the server rejected the attempt — offer a fresh link, not just a retry. */
  const [serverRejected, setServerRejected] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setServerRejected(false);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(t("auth.reset.passwordLength", { count: MIN_PASSWORD_LENGTH }));
    }
    if (password !== confirm) return setError(t("auth.reset.passwordMismatch"));
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      setMessage(res.message || t("auth.reset.successDefault"));
      setSuccess(true);
    } catch (err: any) {
      setServerRejected(true);
      setError(err?.message || t("auth.reset.failed"));
    } finally {
      setLoading(false);
    }
  };

  // Arrived without a token — the link was mangled or copied incompletely.
  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.reset.noTokenTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.reset.noTokenBody")}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button asChild>
            <Link to="/forgot-password">{t("auth.reset.requestNew")}</Link>
          </Button>
          <Link
            to="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.reset.successTitle")}</h2>
          <p className="text-sm text-muted-foreground">{message} {t("auth.reset.successHint")}</p>
        </div>
        <Button asChild>
          <Link to="/login">{t("auth.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{t("auth.reset.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
      </div>
      {error && (
        <div role="alert" className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          {serverRejected && (
            <Link to="/forgot-password" className="inline-block font-medium underline underline-offset-4">
              {t("auth.reset.requestNewLink")}
            </Link>
          )}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <p className="text-xs text-muted-foreground">{t("auth.reset.lengthHint", { count: MIN_PASSWORD_LENGTH })}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">{t("auth.reset.confirmPassword")}</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("auth.reset.submitting")}
          </>
        ) : (
          t("auth.reset.submit")
        )}
      </Button>
      <p className="text-center text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
