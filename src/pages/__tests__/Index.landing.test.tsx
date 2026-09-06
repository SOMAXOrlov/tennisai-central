// The public landing page.
//
// Every assertion matches against the value in the locale bundle rather than a
// literal typed here: `t()` falls back to returning the KEY when a lookup
// misses, so a test written against a hard-coded English sentence would pass
// happily while the page rendered "landing.hero.title" to a visitor. Comparing
// against en.json / es.json is what actually proves the key resolves.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/lib/i18n";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import { DEMO_CONTACT_EMAIL } from "@/lib/legal/companyDetails";
import Index from "@/pages/Index";

function renderLanding(locale: "en" | "es") {
  localStorage.setItem("tennisai_locale", locale);
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <Index />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  // The translator keeps the active locale in a module-level variable, so a
  // Spanish test would otherwise leak into whatever renders next.
  localStorage.setItem("tennisai_locale", "en");
  render(
    <LocaleProvider>
      <span />
    </LocaleProvider>,
  );
  cleanup();
  localStorage.clear();
});

describe("landing page — English", () => {
  it("renders the hero, and no unresolved translation key anywhere on the page", () => {
    const { container } = renderLanding("en");

    expect(screen.getByRole("heading", { level: 1, name: en.landing.hero.title })).toBeInTheDocument();
    expect(screen.getByText(en.landing.hero.subtitle)).toBeInTheDocument();
    // A missed key renders as the key itself — "landing.foo.bar".
    expect(container.textContent).not.toMatch(/\blanding\.[a-z]/i);
  });

  it("renders every section: capabilities, how it works, differentiators, roles, access, demo, closing", () => {
    renderLanding("en");

    for (const c of Object.values(en.landing.capabilities)) {
      expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();
    }
    // Also the footer's own "How it works" link, hence getAllByText.
    expect(screen.getAllByText(en.landing.how.eyebrow).length).toBeGreaterThan(0);
    expect(screen.getByText(en.landing.how.step1.lead)).toBeInTheDocument();
    expect(screen.getByText(en.landing.differentiators.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(en.landing.roles.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.landing.access.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.landing.demo.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.landing.closing.title })).toBeInTheDocument();
  });

  it("shows one card per role, each linking to the single sign-up flow", () => {
    renderLanding("en");

    const roles = Object.values(en.landing.roles).filter(
      (r): r is { title: string; desc: string } => typeof r !== "string",
    );
    expect(roles).toHaveLength(4);

    for (const role of roles) {
      const heading = screen.getByRole("heading", { name: role.title });
      const card = heading.closest("div");
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByRole("link")).toHaveAttribute("href", "/signup");
      expect(screen.getByText(role.desc)).toBeInTheDocument();
    }
  });

  it("offers the demo as a mailto: built from the DEMO_CONTACT_EMAIL constant, with a prefilled subject", () => {
    renderLanding("en");

    const cta = screen.getByRole("link", { name: new RegExp(en.landing.demo.cta, "i") });
    const href = cta.getAttribute("href") ?? "";
    expect(href.startsWith(`mailto:${DEMO_CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href.split("subject=")[1])).toBe(en.landing.demo.subject);
  });

  it("says out loud that the demo address is still a placeholder", () => {
    renderLanding("en");

    expect(screen.getByText(en.landing.demo.addressPending)).toBeInTheDocument();
    expect(screen.getByText(DEMO_CONTACT_EMAIL)).toBeInTheDocument();
  });

  it("shows the three differentiator screenshots, each lazy, sized and described", () => {
    renderLanding("en");

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    const alts = Object.values(en.landing.differentiators)
      .filter((d): d is { title: string; desc: string; alt: string } => typeof d !== "string")
      .map((d) => d.alt);

    for (const img of images) {
      expect(alts).toContain(img.getAttribute("alt"));
      expect(img).toHaveAttribute("loading", "lazy");
      // Intrinsic size present, so the page reserves the box and does not jump.
      expect(Number(img.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(img.getAttribute("height"))).toBeGreaterThan(0);
      expect(img.getAttribute("src")).toMatch(/^\/landing\/.+\.png$/);
    }
  });

  it("links the footer to the privacy policy, the terms and the status page", () => {
    renderLanding("en");

    const footer = document.querySelector("footer");
    expect(footer).not.toBeNull();
    const hrefs = Array.from((footer as HTMLElement).querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/privacy", "/terms", "/status", "/login"]));
  });

  it("puts the current year in the copyright line rather than a frozen one", () => {
    renderLanding("en");

    const expected = en.landing.footer.copyright.replace("{year}", String(new Date().getFullYear()));
    // The line also holds the accent square, so the text is split across nodes.
    const footer = document.querySelector("footer") as HTMLElement;
    expect(footer.textContent).toContain(expected);
  });
});

describe("landing page — Spanish", () => {
  it("renders the Spanish hero and role cards, with no key left unresolved", () => {
    const { container } = renderLanding("es");

    expect(screen.getByRole("heading", { level: 1, name: es.landing.hero.title })).toBeInTheDocument();
    expect(screen.getByText(es.landing.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: es.landing.roles.coach.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: es.landing.demo.title })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\blanding\.[a-z]/i);
  });

  it("prefills the demo subject in Spanish", () => {
    renderLanding("es");

    const cta = screen.getByRole("link", { name: new RegExp(es.landing.demo.cta, "i") });
    const href = cta.getAttribute("href") ?? "";
    expect(decodeURIComponent(href.split("subject=")[1])).toBe(es.landing.demo.subject);
  });
});
