import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Brain, Calendar, Users, Shield, BarChart3 } from "lucide-react";

const capabilities = [
  { icon: Trophy, title: "Tournaments", desc: "One calendar across federations, surfaces and categories." },
  { icon: Calendar, title: "Schedule", desc: "Trainings, matches and travel on a conflict-aware timeline." },
  { icon: Brain, title: "Match insights", desc: "Pre-match prep tuned to opponent tendencies and surface." },
  { icon: Users, title: "Team hub", desc: "Quiet collaboration between players, coaches and supporters." },
  { icon: BarChart3, title: "Performance", desc: "Win-rate trends and improvement signals across the season." },
  { icon: Shield, title: "Equipment", desc: "Tension, racquet wear and shoe mileage — tracked gently." },
];

const workflow = [
  { step: "01", title: "Plan", desc: "Build a season around the tournaments that matter." },
  { step: "02", title: "Train", desc: "Coordinate sessions and capture structured feedback." },
  { step: "03", title: "Compete", desc: "Step on court with AI-powered match scouting." },
  { step: "04", title: "Improve", desc: "Turn every match into measurable progress." },
];

const pricing = [
  {
    name: "Player",
    price: "Free",
    cadence: "forever",
    desc: "For competitors building their season.",
    features: [
      "Tournament calendar & planning",
      "Training log & feedback",
      "Basic match insights",
    ],
    cta: "Start as a player",
    highlighted: false,
  },
  {
    name: "Coach",
    price: "$12",
    cadence: "per month",
    desc: "For coaches managing rosters and sessions.",
    features: [
      "Up to 25 connected players",
      "Session proposals & reviews",
      "Team analytics & scouting",
    ],
    cta: "Start coaching",
    highlighted: true,
  },
  {
    name: "Supporter",
    price: "$4",
    cadence: "per month",
    desc: "For parents and fans following along.",
    features: [
      "Follow up to 5 players",
      "Schedule & results digest",
      "Match-day notifications",
    ],
    cta: "Follow a player",
    highlighted: false,
  },
];

const Index = () => {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-24 md:py-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            TennisAI — Season Workspace
          </p>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            A quiet workspace for the competitive tennis season.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Tournament planning, training coordination and AI-driven match insights — assembled
            into a single, calm tool for players, coaches and supporters.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-11 gap-2 px-6 text-sm" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" className="h-11 px-5 text-sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-12">
          <dl className="grid grid-cols-2 gap-y-8 sm:grid-cols-4">
            {[
              { v: "500+", l: "Tournaments" },
              { v: "24/7", l: "AI co-pilot" },
              { v: "3", l: "Surfaces" },
              { v: "13+", l: "Junior to pro" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{s.v}</dt>
                <dd className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              What's inside
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Everything between first serve and match point.
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="border-t border-border/60 pt-5">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              The match week
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              From practice court to match point — in four moves.
            </h2>
          </div>
          <ol className="mt-14 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((w) => (
              <li key={w.step} className="border-t border-border/60 pt-5">
                <span className="font-mono text-xs text-muted-foreground">{w.step}</span>
                <h3 className="mt-3 text-base font-semibold tracking-tight text-foreground">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Pricing
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Simple plans for everyone on the team.
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {pricing.map((p) => (
              <div
                key={p.name}
                className={
                  "flex flex-col rounded-lg border p-6 " +
                  (p.highlighted
                    ? "border-foreground/30 bg-muted/30"
                    : "border-border/60 bg-background")
                }
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {p.name}
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight text-foreground">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.cadence}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                <ul className="mt-6 space-y-2 text-sm text-foreground">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-border" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <Button
                    asChild
                    variant={p.highlighted ? "default" : "outline"}
                    className="w-full h-10 text-sm"
                  >
                    <Link to="/signup">{p.cta}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border/60">
        <div className="container max-w-5xl py-24 md:py-28">
          <h2 className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            Step on court with an edge.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Free to start, built to scale with your season. No credit card required.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-11 gap-2 px-6 text-sm" asChild>
              <Link to="/signup">
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Link
              to="/login"
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Already on TennisAI? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10">
        <div className="container max-w-5xl flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TennisAI</span>
          <nav className="flex items-center gap-6">
            <Link to="/signup" className="hover:text-foreground">Get started</Link>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <span className="cursor-default">Privacy</span>
            <span className="cursor-default">Terms</span>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
