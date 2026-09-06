import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { AmbientCourt } from "@/components/motion/AmbientCourt";
import { LegalToken } from "@/components/legal/LegalToken";
import { useT } from "@/lib/i18n";
import { DEMO_CONTACT_EMAIL, isUnresolved } from "@/lib/legal/companyDetails";

// ── Content ───────────────────────────────────────────────
// Key stems only. The strings themselves live in `landing.*` in
// src/locales/{en,es}.json, and are resolved inside the component: a
// module-level array built from `t()` would be evaluated once at import and
// then keep serving English after someone switches the language.
const CAPABILITIES = ["calendar", "sessions", "kit", "tournaments"] as const;
const STEPS = ["step1", "step2", "step3"] as const;
const ROLES = ["player", "coach", "parent", "admin"] as const;

// Small accent square — the recurring modernist marker.
function Marker() {
  return <span aria-hidden className="mb-5 block h-2.5 w-2.5 bg-primary" />;
}

const Index = () => {
  const { t } = useT();

  // The demo button is a plain mailto: — no form, no backend, nothing to
  // capture a stranger's address into. Until someone fills the constant in
  // (src/lib/legal/companyDetails.ts) it has no mailbox behind it, and the
  // page says so above the button rather than looking like a working CTA.
  const demoAddressPending = isUnresolved(DEMO_CONTACT_EMAIL);
  const demoHref = `mailto:${DEMO_CONTACT_EMAIL}?subject=${encodeURIComponent(t("landing.demo.subject"))}`;

  return (
    // `isolate` keeps the -z-10 background layer inside this element's own
    // stacking context, above the page fill and below every section.
    <div className="relative isolate bg-background">
      {/* Moving background, at the louder of its two settings — on the landing
          page the atmosphere is doing a job, where inside the app it must stay
          out of the way of a coach reading a training plan. */}
      <AmbientCourt intensity="hero" />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl py-20 md:py-28">
          {/* Hero animates on load rather than on scroll — it is already in
              view, so waiting for an intersection would leave it blank. The
              60ms steps read as one considered movement, not four separate
              ones. */}
          <h1 className="max-w-4xl animate-rise-in text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-8 max-w-2xl animate-rise-in text-lg leading-relaxed text-muted-foreground [animation-delay:90ms] md:text-xl">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-10 flex animate-rise-in flex-wrap items-center gap-6 [animation-delay:180ms]">
            <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
              <Link to="/signup">{t("landing.hero.ctaPrimary")}</Link>
            </Button>
            <a
              href="#how-it-works"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground coarse:min-h-11"
            >
              {/* Underline sweeps out from the left on hover. */}
              <span className="relative after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 after:ease-editorial group-hover:after:scale-x-100 motion-reduce:after:transition-none">
                {t("landing.hero.ctaSecondary")}
              </span>
              <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 ease-editorial group-hover:translate-x-1 motion-reduce:transition-none" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Capabilities (2×2 ruled grid) ─────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl px-0">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {CAPABILITIES.map((key, i) => (
              <Reveal
                key={key}
                // Reading order, not grid order: each cell follows the last by
                // 80ms so the eye is led through them.
                delay={i * 80}
                className={
                  "px-6 py-12 md:px-10 md:py-16 " +
                  // hairline rules between cells only
                  (i % 2 === 0 ? "md:border-r " : "") +
                  (i < 2 ? "md:border-b " : "border-t md:border-t-0 ") +
                  "border-border"
                }
              >
                <Marker />
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {t(`landing.capabilities.${key}.title`)}
                </h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                  {t(`landing.capabilities.${key}.desc`)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <Reveal as="span" className="block">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{t("landing.how.eyebrow")}</p>
          </Reveal>
          <div className="mt-10">
            {STEPS.map((key, i) => (
              <Reveal
                key={key}
                delay={i * 110}
                className="grid grid-cols-[auto_1fr] gap-6 border-t border-border py-8 md:grid-cols-[6rem_1fr] md:gap-10 md:py-10"
              >
                <span className="font-mono text-2xl font-bold text-foreground md:text-3xl">
                  {t(`landing.how.${key}.n`)}
                </span>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  <span className="font-semibold text-foreground">{t(`landing.how.${key}.lead`)}</span>{" "}
                  {t(`landing.how.${key}.desc`)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ──────────────────────────────────── */}
      <section id="roles" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <Reveal as="span" className="block">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{t("landing.roles.eyebrow")}</p>
          </Reveal>
          {/* Four cards, one per role, each linking to the same sign-up — the
              role is chosen inside the flow, so a separate per-role URL would
              be a promise the router does not keep. */}
          <div className="mt-10 grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((key, i) => (
              <Reveal
                key={key}
                delay={i * 80}
                className={
                  "border-b border-border p-6 md:p-8 " +
                  (i < ROLES.length - 1 ? "lg:border-r " : "") +
                  (i % 2 === 0 ? "sm:border-r sm:lg:border-r " : "")
                }
              >
                <Marker />
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  {t(`landing.roles.${key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.roles.${key}.desc`)}
                </p>
                <Link
                  to="/signup"
                  className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground coarse:min-h-11"
                >
                  <span className="relative after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 after:ease-editorial group-hover:after:scale-x-100 motion-reduce:after:transition-none">
                    {t("landing.hero.ctaPrimary")}
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 ease-editorial group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Access (private trial — no invented paid tiers) ── */}
      <section id="pricing" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <Reveal as="span" className="block">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{t("landing.access.eyebrow")}</p>
          </Reveal>
          <Reveal delay={80} className="mt-10 max-w-2xl">
            {/* Not "invite-only" any more — signup takes no invite code, so
                claiming otherwise would be false. */}
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {t("landing.access.title")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t("landing.access.desc")}</p>
            <div className="mt-8">
              <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
                <Link to="/signup">{t("landing.access.cta")}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Book a demo (mailto only — there is no form backend) ── */}
      <section id="demo" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <Reveal as="span" className="block">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{t("landing.demo.eyebrow")}</p>
          </Reveal>
          <Reveal delay={80} className="mt-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {t("landing.demo.title")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t("landing.demo.desc")}</p>
            {demoAddressPending && (
              <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{t("landing.demo.addressPending")}</span>
                <span className="inline-flex items-center gap-2">
                  <span>{t("landing.demo.addressLabel")}</span>
                  <LegalToken value={DEMO_CONTACT_EMAIL} />
                </span>
              </p>
            )}
            <div className="mt-8">
              <Button size="lg" variant="outline" className="h-12 px-7 text-sm font-semibold" asChild>
                <a href={demoHref}>
                  <Mail className="mr-2 h-4 w-4" aria-hidden />
                  {t("landing.demo.cta")}
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA ───────────────────────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl py-24 md:py-28">
          <Reveal>
            <h2 className="max-w-3xl text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-foreground md:text-6xl">
              {t("landing.closing.title")}
            </h2>
          </Reveal>
          <Reveal delay={120} className="mt-10 flex flex-wrap items-center gap-6">
            <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
              <Link to="/signup">{t("landing.closing.cta")}</Link>
            </Button>
            <Link to="/login" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline coarse:inline-flex coarse:min-h-11 coarse:items-center">
              {t("landing.closing.signIn")}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="py-10">
        <div className="container max-w-6xl flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 bg-primary" />
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </span>
          <nav className="flex flex-wrap items-center gap-6">
            <a href="#how-it-works" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.how")}</a>
            <a href="#pricing" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.access")}</a>
            <Link to="/login" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.signIn")}</Link>
            <Link to="/privacy" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.privacy")}</Link>
            <Link to="/terms" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.terms")}</Link>
            {/* Wave 1 shipped /status; a public page nobody can find from the
                public page is not much of a status page. */}
            <Link to="/status" className="hover:text-foreground coarse:inline-flex coarse:min-h-11 coarse:min-w-11 coarse:items-center coarse:justify-center">{t("landing.footer.status")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
