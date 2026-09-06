// ============================================================================
// The page a parent or guardian lands on from the approval email.
//
// WHY IT ASKS FOR A CLICK INSTEAD OF APPROVING ON LOAD
// The email-verification page consumes its token the moment it mounts, which is
// fine for confirming an address. Consent is not that: it is a deliberate act
// by a named person, and corporate mail scanners and link prefetchers open
// links without a human ever seeing them. So the token is only spent when the
// guardian presses the button, after reading what they are agreeing to.
// ============================================================================

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import type { ApiResponse } from "@/types";
import { interleave, slot, useT } from "@/lib/i18n";

interface ConsentResult {
  childFirstName: string;
  accountRole: string;
}

type Status = "ready" | "submitting" | "approved" | "error" | "no-token";

export default function GuardianConsentPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>(token ? "ready" : "no-token");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ConsentResult | null>(null);

  const approve = async () => {
    if (!token) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await apiClient.post<ApiResponse<ConsentResult>>("/auth/guardian-consent", { token });
      setResult(res.data ?? null);
      setMessage(res.message || t("auth.consent.approvedDefault"));
      setStatus("approved");
    } catch (err) {
      setMessage(err?.message || t("auth.consent.errorDefault"));
      setStatus("error");
    }
  };

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.consent.approvedTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {result?.childFirstName
              ? t("auth.consent.approvedNamed", {
                  name: result.childFirstName,
                  role: result.accountRole ? t("auth.consent.approvedRole", { role: result.accountRole }) : "",
                })
              : t("auth.consent.approvedUnnamed")}
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">{t("auth.consent.withdraw")}</p>
        <Button asChild variant="outline">
          <Link to="/">{t("auth.consent.goToApp")}</Link>
        </Button>
      </div>
    );
  }

  if (status === "error" || status === "no-token") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.consent.errorTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {status === "no-token" ? t("auth.consent.noToken") : message}
          </p>
        </div>
        {/* Deliberately does NOT say "sign up again": the email is already
            registered, so a second attempt is refused. There is no self-service
            way to re-issue a consent link yet — see the note in
            server/src/auth/guardianConsent.ts. */}
        <p className="max-w-sm text-xs text-muted-foreground">{t("auth.consent.errorHelp")}</p>
        <Button asChild variant="outline">
          <Link to="/">{t("auth.consent.goToApp")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldQuestion className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.consent.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.consent.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("auth.consent.agreeingTitle")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("auth.consent.point1")}</li>
          <li>{t("auth.consent.point2")}</li>
          <li>{t("auth.consent.point3")}</li>
          <li>{t("auth.consent.point4")}</li>
        </ul>
        <p>
          {interleave(t("auth.consent.privacyNote", { privacy: slot(0) }), [
            <Link key="privacy" to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {t("auth.consent.privacyLink")}
            </Link>,
          ])}
        </p>
      </div>

      <Button className="w-full" onClick={approve} disabled={status === "submitting"}>
        {status === "submitting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("auth.consent.approve")
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("auth.consent.unexpected")}</p>
    </div>
  );
}
