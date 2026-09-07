// The two legal drafts.
//
// What these tests are really guarding is honesty, not markup: that every
// company detail is still visibly unresolved rather than quietly filled in with
// something plausible, that the "last updated" line cannot drift back to
// `new Date()`, and that the draft notice is still on the page. If someone ever
// deletes the notice or hard-codes an address, one of these should go red.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/lib/i18n";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import {
  COMPANY_ADDRESS,
  COMPANY_CONTACT_EMAIL,
  COMPANY_DPO_EMAIL,
  COMPANY_JURISDICTION,
  COMPANY_NAME,
  LEGAL_EFFECTIVE_DATE,
  isUnresolved,
} from "@/lib/legal/companyDetails";
import PrivacyPolicyPage from "@/pages/legal/PrivacyPolicyPage";
import TermsPage from "@/pages/legal/TermsPage";

/** Every leaf string under the `legal` namespace of one bundle. */
function legalStrings(bundle: typeof en): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") out.push(node);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(bundle.legal);
  return out;
}

function renderPage(Page: () => JSX.Element, locale: "en" | "es" = "en") {
  localStorage.setItem("tennisai_locale", locale);
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <Page />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  localStorage.setItem("tennisai_locale", "en");
  render(
    <LocaleProvider>
      <span />
    </LocaleProvider>,
  );
  cleanup();
  localStorage.clear();
});

describe("company details", () => {
  it("is entirely unresolved — nobody has quietly filled a value in", () => {
    for (const value of [
      COMPANY_NAME,
      COMPANY_ADDRESS,
      COMPANY_CONTACT_EMAIL,
      COMPANY_DPO_EMAIL,
      COMPANY_JURISDICTION,
      LEGAL_EFFECTIVE_DATE,
    ]) {
      expect(isUnresolved(value)).toBe(true);
    }
  });

  it("uses a fixed effective date, not today's", () => {
    // The bug this replaces: `new Date().toLocaleDateString(...)`, which
    // re-dated both documents every morning.
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    expect(LEGAL_EFFECTIVE_DATE).not.toBe(today);
    expect(LEGAL_EFFECTIVE_DATE).toBe("{{LEGAL_EFFECTIVE_DATE}}");
  });
});

describe("privacy policy", () => {
  it("keeps the draft notice", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByText(en.legal.draft.label)).toBeInTheDocument();
    expect(screen.getByText(en.legal.draft.body)).toBeInTheDocument();
  });

  it("renders the four controller tokens, the effective date and the jurisdiction", () => {
    renderPage(PrivacyPolicyPage);
    for (const value of [
      COMPANY_NAME,
      COMPANY_ADDRESS,
      COMPANY_CONTACT_EMAIL,
      COMPANY_DPO_EMAIL,
      LEGAL_EFFECTIVE_DATE,
      // The complaints section cannot name a supervisory authority until the
      // governing law is decided, so it shows the same unresolved token the
      // terms page does rather than guessing at a regulator.
      COMPANY_JURISDICTION,
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("marks each token for a screen reader, so the warning is not purely visual", () => {
    const { container } = renderPage(PrivacyPolicyPage);
    const tokens = container.querySelectorAll("[data-legal-token]");
    expect(tokens.length).toBe(6);
    for (const token of tokens) {
      expect(token.textContent).toContain(en.legal.token.srLabel);
    }
  });

  it("carries no invented contact address and no mailto: link", () => {
    const { container } = renderPage(PrivacyPolicyPage);
    expect(container.textContent).not.toMatch(/@tennisai\.example/);
    expect(container.querySelectorAll('a[href^="mailto:"]').length).toBe(0);
  });

  it("renders every data category as a row of the table, with all four cells filled", () => {
    const { container } = renderPage(PrivacyPolicyPage);
    const headers = Array.from(container.querySelectorAll("[data-legal-category]"));

    // The list is spelled out rather than derived from the bundle: a category
    // silently dropped from the page would otherwise take its own assertion
    // with it and the test would still pass.
    expect(headers.map((header) => header.getAttribute("data-legal-category"))).toEqual([
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
    ]);

    for (const header of headers) {
      const cells = header.parentElement!.querySelectorAll("th, td");
      expect(cells.length).toBe(4);
      for (const cell of cells) expect(cell.textContent?.trim()).not.toBe("");
    }
  });

  it("answers retention per category, and claims no lawful basis anywhere", () => {
    renderPage(PrivacyPolicyPage);
    // The reason the table exists: the photo row can carry the backup window
    // and the log row the web server's rotation, which one shared paragraph
    // about "as long as necessary" could never have said.
    expect(screen.getByText(en.legal.privacy.collect.rows.photo.retention)).toBeInTheDocument();
    expect(screen.getByText(en.legal.privacy.collect.rows.technical.retention)).toBeInTheDocument();
    // Nothing has been decided, so no row may assert a basis — in either language.
    for (const row of Object.values(en.legal.privacy.collect.rows)) {
      expect(row.basis).toMatch(/^Not settled/);
    }
    for (const row of Object.values(es.legal.privacy.collect.rows)) {
      expect(row.basis).toMatch(/^Sin decidir/);
    }
  });

  it("has a photographs section that admits the metadata strip and the backup window", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.photos.heading })).toBeInTheDocument();

    // The two facts that are easy to leave out and expensive to leave out.
    // The re-encode is what removes the coordinates (server/src/photos/storage.ts),
    // and the nightly archive keeps fourteen copies (deploy/hetzner/backup.sh),
    // so "deleted immediately" on its own would be a small lie.
    expect(en.legal.privacy.photos.metadata).toMatch(/metadata/i);
    expect(en.legal.privacy.photos.metadata).toMatch(/coordinates/i);
    expect(en.legal.privacy.photos.deletion).toMatch(/fourteen/i);
    expect(es.legal.privacy.photos.metadata).toMatch(/metadatos/i);
    expect(es.legal.privacy.photos.deletion).toMatch(/catorce/i);
    expect(screen.getByText(en.legal.privacy.photos.deletion)).toBeInTheDocument();
  });

  it("says a child's photograph is limited to the player, their coach and a consented guardian", () => {
    renderPage(PrivacyPolicyPage);
    const body = en.legal.privacy.photos.whoCanSee;
    expect(screen.getByText(body)).toBeInTheDocument();
    expect(body).toMatch(/coach/i);
    expect(body).toMatch(/consent/i);
    // The refusals matter as much as the permissions — assertCanViewPlayerPhoto
    // in server/src/authz.ts turns each of these away.
    expect(body).toMatch(/not another player/i);
    expect(body).toMatch(/never consented/i);
  });

  it("does not imply a cookie consent banner, because there is none", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.device.heading })).toBeInTheDocument();
    expect(en.legal.privacy.device.intro).toMatch(/no consent banner/i);
    expect(es.legal.privacy.device.intro).toMatch(/no hay banner de consentimiento/i);
  });

  it("names no hosting country, because the repository does not record one", () => {
    const { container } = renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.transfers.heading })).toBeInTheDocument();
    // deploy/hetzner/** shows a single rented host and a German provider; it
    // never says which data centre. The page must not fill that in for itself,
    // and the still-open list has to carry the question instead.
    expect(en.legal.privacy.transfers.provider).toMatch(/not recorded/i);
    expect(en.legal.privacy.open.item8).toMatch(/not recorded/i);
    expect(container.textContent).not.toMatch(/\bGermany\b/);
  });

  it("awards itself no security verdict while listing what is not done", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.security.heading })).toBeInTheDocument();
    expect(screen.getByText(en.legal.privacy.security.gaps)).toBeInTheDocument();

    expect(en.legal.privacy.security.noVerdict).toMatch(/not been certified, audited or approved/i);
    expect(en.legal.privacy.security.gaps).toMatch(/no external security review or penetration test/i);
  });

  it("never grades itself compliant, certified, audited or secure", () => {
    // The product has had no external assessment of any kind (SECURITY.md), so
    // a verdict anywhere on these pages would be the one claim a reader could
    // not check.
    //
    // A forbidden-PHRASE list rather than a search for the word "secure",
    // because the word has an innocent use ("keep your sign-in details secure")
    // and because the honest disclaimers are denials. Writing the disclaimer so
    // that it does not contain the phrase it forbids was part of the work.
    const FORBIDDEN_CLAIMS = [
      /GDPR[- ]compliant/i,
      /compliant with the GDPR/i,
      /cumple (con )?el RGPD/i,
      /conforme al RGPD/i,
      /\b(?:is|are)\s+secure\b/i,
      /\bfully secure\b/i,
      /\bpenetration[-\s]tested\b/i,
      /\bsecurity[- ]approved\b/i,
      /(?<!\bnot )(?:has|have) been (?:certified|audited|approved)/i,
      /\b(?:es|son|sea)\s+segur[ao]s?\b/i,
      /(?<!\bno )ha sido (?:certificad|auditad|aprobad)/i,
    ];

    for (const bundle of [en, es]) {
      for (const value of legalStrings(bundle)) {
        for (const claim of FORBIDDEN_CLAIMS) expect(value).not.toMatch(claim);
      }
    }
  });

  it("describes the recommendation engines as advice and still names the two rules that gate something", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.automated.heading })).toBeInTheDocument();
    expect(en.legal.privacy.automated.body).toMatch(/deterministic/i);
    expect(en.legal.privacy.automated.body).toMatch(/advice/i);
    // The sign-up age gate and the tournament age filter really do decide
    // something, so the section says so rather than claiming nothing is
    // automated — and it does not reach for an Article 22 conclusion either.
    expect(en.legal.privacy.automated.item1).toMatch(/age check at sign-up/i);
    expect(en.legal.privacy.automated.item2).toMatch(/age eligibility/i);
    expect(JSON.stringify(en.legal.privacy.automated)).not.toMatch(/Article 22/i);
  });

  it("keeps the 'still open' list of decisions a lawyer has to make", () => {
    renderPage(PrivacyPolicyPage);
    expect(screen.getByRole("heading", { name: en.legal.privacy.open.heading })).toBeInTheDocument();
    for (const item of [
      en.legal.privacy.open.item1,
      en.legal.privacy.open.item2,
      en.legal.privacy.open.item3,
      en.legal.privacy.open.item4,
      en.legal.privacy.open.item5,
      en.legal.privacy.open.item6,
      en.legal.privacy.open.item7,
      en.legal.privacy.open.item8,
      en.legal.privacy.open.item9,
      en.legal.privacy.open.item10,
      en.legal.privacy.open.item11,
      en.legal.privacy.open.item12,
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("resolves every key in Spanish too", () => {
    const { container } = renderPage(PrivacyPolicyPage, "es");
    expect(screen.getByRole("heading", { level: 1, name: es.legal.privacy.title })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\blegal\.[a-z]/i);
  });
});

describe("terms of service", () => {
  it("keeps the draft notice", () => {
    renderPage(TermsPage);
    expect(screen.getByText(en.legal.draft.label)).toBeInTheDocument();
  });

  it("renders the counterparty tokens, the governing-law token and the effective date", () => {
    const { container } = renderPage(TermsPage);
    for (const value of [COMPANY_NAME, COMPANY_ADDRESS, COMPANY_CONTACT_EMAIL, COMPANY_JURISDICTION, LEGAL_EFFECTIVE_DATE]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("[data-legal-token]").length).toBe(5);
  });

  it("links to the privacy policy and drops the invented hello@ address", () => {
    const { container } = renderPage(TermsPage);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/privacy", "/"]));
    expect(container.textContent).not.toMatch(/@tennisai\.example/);
  });

  it("separates the deterministic session builder from the optional AI provider", () => {
    renderPage(TermsPage);
    expect(screen.getByText(en.legal.terms.warranty.body)).toBeInTheDocument();
    expect(en.legal.terms.warranty.body).toMatch(/deterministic rule-based builder/);
    expect(en.legal.terms.warranty.body).toMatch(/AI provider/);
  });

  it("resolves every key in Spanish too", () => {
    const { container } = renderPage(TermsPage, "es");
    expect(screen.getByRole("heading", { level: 1, name: es.legal.terms.title })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\blegal\.[a-z]/i);
  });
});
