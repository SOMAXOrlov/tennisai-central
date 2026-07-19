import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// ── Content ───────────────────────────────────────────────
const capabilities = [
  { title: "Scheduling", desc: "Lessons, courts and coaches on one calendar — booked around school, work and weather." },
  { title: "Training sessions", desc: "Each session drafted from the player's last ten. The coach adjusts, never starts from zero." },
  { title: "Gear tracking", desc: "Strings, grips and restring cycles per player — nothing snaps mid-match." },
  { title: "Tournaments", desc: "Entries suggested by level, ranking points and travel — agreed between coach and parents." },
];

const steps = [
  { n: "01", lead: "Connect the roster.", desc: "Coaches, players and parents join one workspace; availability syncs from their calendars." },
  { n: "02", lead: "Let it schedule.", desc: "Courts and lessons booked, each session plan drafted and ready for the coach's edits." },
  { n: "03", lead: "Play the right events.", desc: "Gear stays match-ready; tournament entries land on the calendar with travel time blocked." },
];

const pricing = [
  {
    name: "Player",
    price: "Free",
    cadence: "",
    desc: "For competitors building their season.",
    features: ["Tournament calendar", "Training log & feedback", "Basic match insights"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Coach",
    price: "$29",
    cadence: "/mo",
    desc: "For coaches managing rosters and sessions.",
    features: ["Up to 25 players", "Session plans & reviews", "Team analytics & scouting"],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Academy",
    price: "$99",
    cadence: "/mo",
    desc: "For clubs and academies at scale.",
    features: ["Unlimited coaches & players", "Multi-court scheduling", "Billing & parent portal"],
    cta: "Talk to us",
    featured: false,
  },
];

// Small red square — the recurring modernist marker.
function Marker() {
  return <span aria-hidden className="mb-5 block h-2.5 w-2.5 bg-primary" />;
}

const Index = () => {
  return (
    <div className="bg-background">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl py-20 md:py-28">
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl">
            Run the season like a system.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Tennis AI runs the season between coach and player — trainings scheduled, sessions
            planned, gear tracked, tournaments chosen. Built for coaches, academies and the
            parents who drive.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
              <Link to="/signup">Start free trial</Link>
            </Button>
            <a
              href="#how-it-works"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              See how it works
              <ArrowRight className="h-4 w-4 text-primary" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Capabilities (2×2 ruled grid) ─────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl px-0">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {capabilities.map((c, i) => (
              <div
                key={c.title}
                className={
                  "px-6 py-12 md:px-10 md:py-16 " +
                  // hairline rules between cells only
                  (i % 2 === 0 ? "md:border-r " : "") +
                  (i < 2 ? "md:border-b " : "border-t md:border-t-0 ") +
                  "border-border"
                }
              >
                <Marker />
                <h3 className="text-2xl font-bold tracking-tight text-foreground">{c.title}</h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">How it works</p>
          <div className="mt-10">
            {steps.map((s) => (
              <div
                key={s.n}
                className="grid grid-cols-[auto_1fr] gap-6 border-t border-border py-8 md:grid-cols-[6rem_1fr] md:gap-10 md:py-10"
              >
                <span className="font-mono text-2xl font-bold text-foreground md:text-3xl">{s.n}</span>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  <span className="font-semibold text-foreground">{s.lead}</span> {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────── */}
      <section id="pricing" className="border-b border-foreground/15 scroll-mt-20">
        <div className="container max-w-6xl py-20 md:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Pricing</p>
          <div className="mt-10 grid grid-cols-1 gap-px md:grid-cols-3">
            {pricing.map((p) => (
              <div
                key={p.name}
                className={"flex flex-col " + (p.featured ? "border-t-2 border-primary" : "border-t-2 border-foreground")}
              >
                <div className="pt-6">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">{p.name}</h3>
                    {p.featured && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Popular</span>
                    )}
                  </div>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-foreground">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.cadence}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Button
                      asChild
                      variant={p.featured ? "default" : "outline"}
                      className="w-full h-11 text-sm font-semibold"
                    >
                      <Link to="/signup">{p.cta}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ───────────────────────────────────── */}
      <section className="border-b border-foreground/15">
        <div className="container max-w-6xl py-24 md:py-28">
          <h2 className="max-w-3xl text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-foreground md:text-6xl">
            Step on court with the season already handled.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Button size="lg" className="h-12 px-7 text-sm font-semibold" asChild>
              <Link to="/signup">Start free trial</Link>
            </Button>
            <Link to="/login" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
              Already on Tennis AI? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="py-10">
        <div className="container max-w-6xl flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 bg-primary" />
            © {new Date().getFullYear()} Tennis AI
          </span>
          <nav className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
