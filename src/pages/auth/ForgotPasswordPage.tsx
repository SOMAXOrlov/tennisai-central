import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/api/endpoints/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { interleave, slot, useT } from "@/lib/i18n";

/**
 * Request a password-reset link.
 *
 * The confirmation screen is deliberately non-committal: the API returns the same
 * response whether or not the address belongs to an account, and this page must
 * not leak the difference either.
 */
export default function ForgotPasswordPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The server's own wording. Usually the deliberately vague "if that email is
  // registered…", but a server with no mail transport says so plainly instead —
  // and answering "check your email" to that sends someone to watch an inbox
  // nothing can ever arrive in.
  const [serverMessage, setServerMessage] = useState("");
  // Whether this server can send mail at all. A property of the server, the
  // same for every address, so showing it reveals nothing about any account.
  const [mailUnavailable, setMailUnavailable] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const address = email.trim();
    if (!address) return setError(t("auth.forgot.emptyEmail"));
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(address);
      setServerMessage(res?.message ?? "");
      setMailUnavailable(res?.data?.emailConfigured === false);
      setSentTo(address);
      setSent(true);
    } catch (err: any) {
      // Only transport / rate-limit failures land here — a successful request is
      // always a generic 200, so nothing here reveals whether the account exists.
      setError(err?.message || t("auth.forgot.failed"));
    } finally {
      setLoading(false);
    }
  };


  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {mailUnavailable ? t("auth.forgot.unavailableTitle") : t("auth.forgot.sentTitle")}
          </h2>
          {mailUnavailable ? (
            <p className="text-sm text-muted-foreground">{serverMessage}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {interleave(t("auth.forgot.sentBody", { email: slot(0) }), [
                <span key="email" className="font-medium text-foreground">{sentTo}</span>,
              ])}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button asChild>
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </Button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setError("");
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline coarse:min-h-11"
          >
            {t("auth.forgot.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground coarse:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backToLogin")}
      </Link>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.forgot.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
        </div>
        {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="space-y-1">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.forgot.submitting")}
            </>
          ) : (
            t("auth.forgot.submit")
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.forgot.remembered")}{" "}
          <Link to="/login" className="text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
