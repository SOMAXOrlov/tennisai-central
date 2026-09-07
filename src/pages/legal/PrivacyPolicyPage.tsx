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
  COMPANY_JURISDICTION,
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

/**
 * The data categories, in the order they appear in the table.
 *
 * A list rather than thirteen hand-written rows, because the four cells of a
 * row have to stay in step, and because `t()` on a template literal is what
 * lets `src/locales/__tests__/unusedKeys.test.ts` see the whole
 * `legal.privacy.collect.rows.*` subtree as used. Adding a category means
 * adding an id here and four strings to each bundle; the parity test then
 * insists on the Spanish half.
 */
const DATA_CATEGORIES = [
  "account",
  "age",
  "profile",
  "photo",
  "activity",
  "equipment",
  "finance",
  "connections",
  "coachNotes",
  "opponents",
  "push",
  "aiRecords",
  "technical",
] as const;

/**
 * Category · why it is held · lawful basis · how long.
 *
 * The shape a reader of sports-platform policies expects, and the reason the
 * retention question is answered per category here instead of in one paragraph
 * that says "as long as necessary". The lawful-basis column says "not settled"
 * in every row on purpose: none of them has been decided, and a table that
 * quietly asserted six different bases would be the most convincing false
 * thing on the page.
 *
 * Four columns do not fit a phone, so the table keeps its own width and scrolls
 * inside its own box. The page itself must never scroll sideways — that would
 * break every other section to accommodate this one.
 */
function DataCategoryTable() {
  const { t } = useT();

  return (
    <div className="mt-4 overflow-x-auto border border-border">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        {/* A real caption rather than an aria-label: it is the table's name in a
            screen reader's list of tables, and it still makes sense read out of
            context. Hidden visually because the heading above it already says
            the same thing to a sighted reader. */}
        <caption className="sr-only">{t("legal.privacy.collect.tableLabel")}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th scope="col" className="px-3 py-2 align-top font-bold text-foreground">
              {t("legal.privacy.collect.columns.category")}
            </th>
            <th scope="col" className="px-3 py-2 align-top font-bold text-foreground">
              {t("legal.privacy.collect.columns.why")}
            </th>
            <th scope="col" className="px-3 py-2 align-top font-bold text-foreground">
              {t("legal.privacy.collect.columns.basis")}
            </th>
            <th scope="col" className="px-3 py-2 align-top font-bold text-foreground">
              {t("legal.privacy.collect.columns.retention")}
            </th>
          </tr>
        </thead>
        <tbody>
          {DATA_CATEGORIES.map((category) => (
            <tr key={category} className="border-b border-border last:border-b-0">
              <th
                scope="row"
                className="w-[28%] px-3 py-3 align-top font-normal text-foreground"
                data-legal-category={category}
              >
                {t(`legal.privacy.collect.rows.${category}.category`)}
              </th>
              <td className="w-[26%] px-3 py-3 align-top">{t(`legal.privacy.collect.rows.${category}.why`)}</td>
              <td className="w-[22%] px-3 py-3 align-top">{t(`legal.privacy.collect.rows.${category}.basis`)}</td>
              <td className="w-[24%] px-3 py-3 align-top">{t(`legal.privacy.collect.rows.${category}.retention`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
            <p>{t("legal.privacy.collect.intro")}</p>
            <p>{t("legal.privacy.collect.basisNote")}</p>
            <DataCategoryTable />
            <p>{t("legal.privacy.collect.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.purpose.heading")}>
            <p>{t("legal.privacy.purpose.body")}</p>
            <p>{t("legal.privacy.purpose.legalBasisNote")}</p>
          </Section>

          {/* Photographs come straight after the purpose section rather than
              being folded into it: a picture of a child is the most sensitive
              thing here, and burying it under "what we collect" would hide the
              part a parent is reading the page for. */}
          <Section heading={t("legal.privacy.photos.heading")}>
            <p>{t("legal.privacy.photos.stored")}</p>
            <p>{t("legal.privacy.photos.metadata")}</p>
            <p>{t("legal.privacy.photos.whoCanSee")}</p>
            <p>{t("legal.privacy.photos.serverEnforced")}</p>
            <p>{t("legal.privacy.photos.notPublic")}</p>
            <p>{t("legal.privacy.photos.upload")}</p>
            <p>{t("legal.privacy.photos.deletion")}</p>
          </Section>

          <Section heading={t("legal.privacy.minors.heading")}>
            <p>{t("legal.privacy.minors.body")}</p>
            <p>{t("legal.privacy.minors.note")}</p>
          </Section>

          {/* Cookies and local storage are their own section because they are
              their own legal question, and because the answer here is unusual
              enough to be worth stating plainly: there are no cookies, and
              therefore no banner. */}
          <Section heading={t("legal.privacy.device.heading")}>
            <p>{t("legal.privacy.device.intro")}</p>
            <p>{t("legal.privacy.device.storageIntro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.device.item1")}</li>
              <li>{t("legal.privacy.device.item2")}</li>
              <li>{t("legal.privacy.device.item3")}</li>
              <li>{t("legal.privacy.device.item4")}</li>
              <li>{t("legal.privacy.device.item5")}</li>
              <li>{t("legal.privacy.device.item6")}</li>
            </ul>
            <p>{t("legal.privacy.device.necessary")}</p>
            <p>{t("legal.privacy.device.serviceWorker")}</p>
            <p>{t("legal.privacy.device.thirdParty")}</p>
            <p>{t("legal.privacy.device.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.processors.heading")}>
            <p>{t("legal.privacy.processors.intro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.processors.item1")}</li>
              <li>{t("legal.privacy.processors.item2")}</li>
              <li>{t("legal.privacy.processors.item3")}</li>
              <li>{t("legal.privacy.processors.item4")}</li>
              <li>{t("legal.privacy.processors.item5")}</li>
              {/* The last two are requests the BROWSER makes, not the server —
                  which is exactly why they were missing from this list until
                  somebody grepped the client for external URLs. */}
              <li>{t("legal.privacy.processors.item6")}</li>
              <li>{t("legal.privacy.processors.item7")}</li>
            </ul>
          </Section>

          <Section heading={t("legal.privacy.transfers.heading")}>
            <p>{t("legal.privacy.transfers.body")}</p>
            <p>{t("legal.privacy.transfers.provider")}</p>
            <p>{t("legal.privacy.transfers.recipientsIntro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.transfers.item1")}</li>
              <li>{t("legal.privacy.transfers.item2")}</li>
              <li>{t("legal.privacy.transfers.item3")}</li>
              <li>{t("legal.privacy.transfers.item4")}</li>
            </ul>
            <p>{t("legal.privacy.transfers.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.ai.heading")}>
            <p>{t("legal.privacy.ai.body")}</p>
            <p>{t("legal.privacy.ai.pseudonymous")}</p>
          </Section>

          {/* Describes the behaviour rather than reaching for an Article 22
              conclusion: the engines are advisory, and the two rules that do
              gate something are named instead of being waved away. */}
          <Section heading={t("legal.privacy.automated.heading")}>
            <p>{t("legal.privacy.automated.body")}</p>
            <p>{t("legal.privacy.automated.effectsIntro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.automated.item1")}</li>
              <li>{t("legal.privacy.automated.item2")}</li>
            </ul>
            <p>{t("legal.privacy.automated.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.security.heading")}>
            <p>{t("legal.privacy.security.intro")}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t("legal.privacy.security.item1")}</li>
              <li>{t("legal.privacy.security.item2")}</li>
              <li>{t("legal.privacy.security.item3")}</li>
              <li>{t("legal.privacy.security.item4")}</li>
              <li>{t("legal.privacy.security.item5")}</li>
              <li>{t("legal.privacy.security.item6")}</li>
            </ul>
            {/* The gaps and the disclaimer are not optional trimmings. A
                security section that lists only the good half is an
                advertisement, and SECURITY.md records every one of these. */}
            <p>{t("legal.privacy.security.gaps")}</p>
            <p>{t("legal.privacy.security.noVerdict")}</p>
          </Section>

          <Section heading={t("legal.privacy.retention.heading")}>
            <p>{t("legal.privacy.retention.body")}</p>
          </Section>

          <Section heading={t("legal.privacy.rights.heading")}>
            <p>{t("legal.privacy.rights.body")}</p>
            <p>{t("legal.privacy.rights.contact")}</p>
          </Section>

          <Section heading={t("legal.privacy.complaints.heading")}>
            <p>{t("legal.privacy.complaints.body")}</p>
            <dl className="mt-4">
              {/* The authority follows from the jurisdiction, so it is named by
                  reference to the token rather than hard-coded to one country's
                  regulator — a guess here sends a complaint to the wrong desk. */}
              <DetailRow label={t("legal.privacy.complaints.lawLabel")} value={COMPANY_JURISDICTION} />
            </dl>
            <p>{t("legal.privacy.complaints.note")}</p>
          </Section>

          <Section heading={t("legal.privacy.changes.heading")}>
            <p>{t("legal.privacy.changes.body")}</p>
            <p>{t("legal.privacy.changes.notice")}</p>
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
              <li>{t("legal.privacy.open.item7")}</li>
              <li>{t("legal.privacy.open.item8")}</li>
              <li>{t("legal.privacy.open.item9")}</li>
              <li>{t("legal.privacy.open.item10")}</li>
              <li>{t("legal.privacy.open.item11")}</li>
              <li>{t("legal.privacy.open.item12")}</li>
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
