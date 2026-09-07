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

  it("renders the four controller tokens and the effective-date token", () => {
    renderPage(PrivacyPolicyPage);
    for (const value of [COMPANY_NAME, COMPANY_ADDRESS, COMPANY_CONTACT_EMAIL, COMPANY_DPO_EMAIL, LEGAL_EFFECTIVE_DATE]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("marks each token for a screen reader, so the warning is not purely visual", () => {
    const { container } = renderPage(PrivacyPolicyPage);
    const tokens = container.querySelectorAll("[data-legal-token]");
    expect(tokens.length).toBe(5);
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
