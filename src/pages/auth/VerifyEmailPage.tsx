import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, MailCheck } from "lucide-react";
import { authApi } from "@/api/endpoints/auth";
import { useT } from "@/lib/i18n";

type Status = "verifying" | "success" | "error" | "prompt";

export default function VerifyEmailPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "prompt");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // guard against double-run in StrictMode
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message || t("auth.verify.successDefault"));
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.message || t("auth.verify.errorDefault"));
      });
    // `t` is the module-level lookup re-exported by `useT()`, so its identity
    // never changes and listing it costs nothing; the `ran` ref already makes a
    // re-run a no-op in any case.
  }, [token, t]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setResending(true);
    try {
      const res = await authApi.resendVerification(email.trim());
      setResent(true);
      setMessage(res.message || t("auth.verify.resendDefault"));
    } catch (err) {
      setMessage(err?.message || t("auth.verify.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h2 className="text-xl font-semibold text-foreground">{t("auth.verify.verifying")}</h2>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.verify.successTitle")}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button asChild>
          <Link to="/login">{t("auth.goToLogin")}</Link>
        </Button>
      </div>
    );
  }

  // "error" (bad/expired token) and "prompt" (arrived without a token) both offer resend.
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {status === "error" ? (
            <AlertCircle className="h-6 w-6 text-destructive" />
          ) : (
            <MailCheck className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {status === "error" ? t("auth.verify.errorTitle") : t("auth.verify.promptTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {status === "error" ? message : t("auth.verify.promptBody")}
          </p>
        </div>
      </div>

      {resent ? (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-center text-sm text-muted-foreground">
          {message}
        </p>
      ) : (
        <form className="space-y-3" onSubmit={handleResend}>
          <div className="space-y-1.5">
            <Label htmlFor="resend-email">{t("auth.verify.resendLabel")}</Label>
            <Input
              id="resend-email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={resending || !email.trim()}>
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.verify.resend")}
          </Button>
        </form>
      )}

      <p className="text-center text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
