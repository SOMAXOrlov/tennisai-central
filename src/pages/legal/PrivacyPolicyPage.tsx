// Draft privacy policy. Wired as a public route (/privacy) from App.tsx.
//
// Written against what the code actually does, not against a template: the
// local-storage list is the keys the app really writes, the processor list is
// only what env.ts can switch on, and the guardian-consent section describes
// server/src/auth/guardianConsent.ts rather than a generic minors clause.
//
// Everything the team has NOT decided is either a `<LegalToken>` or an entry in
// the "Still open" section at the foot of the page. That is the point: a draft
// that hides its gaps is worse than no draft, because nobody can see what is
// left to do. See src/lib/legal/companyDetails.ts.
import { Link } from "react-router-dom";
import { LegalDraftNotice } from "@/components/legal/LegalDraftNotice";
import { LegalToken } from "@/components/legal/LegalToken";
import { useT } from "@/lib/i18n";
import {
  COMPANY_ADDRESS,
  COMPANY_CONTACT_EMAIL,
  COMPANY_DPO_EMAIL,
  COMPANY_NAME,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/legal/companyDetails";

/** A heading + body block. The pages are almost entirely made of these. */
function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

/** One label/value row of the identity block. Every value is a token today. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-border py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-foreground">{label}</dt>
      <dd>
        <LegalToken value={value} />
      </dd>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const { t } = useT();

  return (
    <div className="bg-background">
      <div className="container max-w-3xl py-16 md:py-20">
        <LegalDraftNotice />

        <h1 className="mt-10 text-3xl font-extrabold tracking-tight text-foreground">
          {t("legal.privacy.title")}
        </h1>
        {/* A fixed constant, never `new Date()` — see companyDetails.ts. */}
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t("legal.effectiveDate")}
          <LegalToken value={LEGAL_EFFECTIVE_DATE} />
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
          <Section heading={t("legal.privacy.controller.heading")}>
            <p>{t("legal.privacy.controller.note")}</p>
            <dl className="mt-4">
              <DetailRow label={t("legal.privacy.controller.controllerLabel")} value={COMPANY_NAME} />
              <DetailRow label={t("legal.privacy.controller.addressLabel")} value={COMPANY_ADDRESS} />
              <DetailRow label={t("legal.privacy.controller.contactLabel")} value={COMPANY_CONTACT_EMAIL} />
              <DetailRow label={t("legal.privacy.controller.dpoLabel")} value={COMPANY_DPO_EMAIL} />
            </dl>
          </Section>

          <Section heading={t("legal.privacy.scope.heading")}>
            <p>{t("legal.privacy.scope.body")}</p>
          </Section>

          <Section heading={t("legal.privacy.collect.heading")}>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.collect.item1")}</li>
              <li>{t("legal.privacy.collect.item2")}</li>
              <li>{t("legal.privacy.collect.item3")}</li>
              <li>{t("legal.privacy.collect.item4")}</li>
              <li>{t("legal.privacy.collect.item5")}</li>
              <li>{t("legal.privacy.collect.item6")}</li>
              <li>{t("legal.privacy.collect.item7")}</li>
            </ul>
            <p>{t("legal.privacy.collect.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.purpose.heading")}>
            <p>{t("legal.privacy.purpose.body")}</p>
            <p>{t("legal.privacy.purpose.legalBasisNote")}</p>
          </Section>

          <Section heading={t("legal.privacy.device.heading")}>
            <p>{t("legal.privacy.device.intro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.device.item1")}</li>
              <li>{t("legal.privacy.device.item2")}</li>
              <li>{t("legal.privacy.device.item3")}</li>
              <li>{t("legal.privacy.device.item4")}</li>
            </ul>
            <p>{t("legal.privacy.device.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.processors.heading")}>
            <p>{t("legal.privacy.processors.intro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.processors.item1")}</li>
              <li>{t("legal.privacy.processors.item2")}</li>
              <li>{t("legal.privacy.processors.item3")}</li>
              <li>{t("legal.privacy.processors.item4")}</li>
            </ul>
          </Section>

          <Section heading={t("legal.privacy.minors.heading")}>
            <p>{t("legal.privacy.minors.body")}</p>
            <p>{t("legal.privacy.minors.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.ai.heading")}>
            <p>{t("legal.privacy.ai.body")}</p>
          </Section>

          <Section heading={t("legal.privacy.retention.heading")}>
            <p>{t("legal.privacy.retention.body")}</p>
          </Section>

          <Section heading={t("legal.privacy.rights.heading")}>
            <p>{t("legal.privacy.rights.body")}</p>
            <p>{t("legal.privacy.rights.contact")}</p>
          </Section>

          <Section heading={t("legal.privacy.open.heading")}>
            <p>{t("legal.privacy.open.intro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.open.item1")}</li>
              <li>{t("legal.privacy.open.item2")}</li>
              <li>{t("legal.privacy.open.item3")}</li>
              <li>{t("legal.privacy.open.item4")}</li>
              <li>{t("legal.privacy.open.item5")}</li>
              <li>{t("legal.privacy.open.item6")}</li>
            </ul>
          </Section>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link to="/" className="font-medium text-primary hover:underline coarse:inline-flex coarse:min-h-11 coarse:items-center">
            {t("legal.backHome")}
          </Link>
          <Link to="/terms" className="font-medium text-primary hover:underline coarse:inline-flex coarse:min-h-11 coarse:items-center">
            {t("legal.terms.linkLabel")}
          </Link>
        </div>
      </div>
    </div>
  );
}
