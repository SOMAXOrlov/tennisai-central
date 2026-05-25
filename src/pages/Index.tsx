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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 50% at 18% 0%, hsl(var(--emerald-mid) / 0.22), transparent 60%), radial-gradient(ellipse 45% 40% at 92% 12%, hsl(var(--gold) / 0.10), transparent 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 court-lines opacity-[0.14] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black_30%,transparent_100%)]" />

        <motion.div style={{ y: heroY }} className="container relative">
          {/* Issue header — editorial masthead */}
          <motion.div
            initial="visible"
            animate="visible"
            variants={stagger}
            className="mb-10 flex items-end justify-between gap-6 border-b border-border/50 pb-6"
          >
            <motion.div variants={fade}>
              <Marginalia>Vol. IX · The Season Issue</Marginalia>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">No. 026 — 05 / 2026</div>
            </motion.div>
            <motion.div variants={fade} className="hidden text-right sm:block">
              <Marginalia>Filed under</Marginalia>
              <div className="mt-1 text-[11px] text-foreground">Players · Coaches · Supporters</div>
            </motion.div>
          </motion.div>

          {/* Asymmetric hero */}
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            {/* Left margin column — small caps lede */}
            <motion.aside
              initial="visible"
              animate="visible"
              variants={fade}
              className="col-span-12 lg:col-span-2 lg:pt-3"
            >
              <Marginalia>The lede</Marginalia>
              <p className="mt-3 text-[clamp(0.8125rem,0.75rem+0.3vw,0.9375rem)] leading-relaxed text-muted-foreground">
                An operating system for competitive tennis — written for the player who treats the season as a craft.
              </p>
            </motion.aside>

            {/* Headline — drop-cap, oversized */}
            <motion.div
              initial="visible"
              animate="visible"
              variants={stagger}
              className="col-span-12 lg:col-span-7"
            >
              <motion.h1
                variants={fade}
                className="text-balance font-bold leading-[0.95] tracking-tight text-foreground text-[clamp(2.5rem,1.4rem+5.5vw,7.5rem)]"
              >
                Train smart.
                <br />
                Play sharper.
                <br />
                <span className="italic font-normal text-muted-foreground">Win</span>{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--emerald-mid))] bg-clip-text text-transparent">
                  more.
                </span>
              </motion.h1>

              <motion.div variants={fade} className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-5">
                <p className="sm:col-span-3 text-pretty leading-relaxed text-muted-foreground text-[clamp(0.9375rem,0.85rem+0.4vw,1.125rem)]">
                  Tournament planning, training coordination and AI-driven match insights — assembled into a single,
                  quiet workspace for the modern competitive player and their team.
                </p>
                <div className="sm:col-span-2 flex flex-col gap-3">
                  <Button size="lg" className="group h-12 justify-between gap-2 px-5 text-sm shadow-lg shadow-[hsl(var(--emerald-mid)/0.3)] hover:shadow-xl hover:shadow-[hsl(var(--emerald-mid)/0.45)]" asChild>
                    <Link to="/signup">
                      Start free
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="ghost" className="h-12 justify-between px-5 text-sm" asChild>
                    <Link to="/login">
                      Sign in
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </motion.div>

            {/* Right rail — live rally + meta */}
            <motion.div
              initial="visible"
              animate="visible"
              variants={fade}
              className="col-span-12 lg:col-span-3"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <Marginalia>Live rally</Marginalia>
                <span className="font-mono text-[10px] text-[hsl(var(--gold))]">Court 1 · 30–15</span>
              </div>
              <div
                role="img"
                aria-label="Live tennis rally — stylized top-down court with a ball bouncing baseline to baseline"
                className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl ring-1 ring-border/50"
              >
                <TennisRallyScene className="absolute inset-0 h-full w-full" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3 w-3 text-[hsl(var(--gold))]" /> Streaming
                </span>
                <span className="font-mono">— Set 1 · 5–4</span>
              </div>
            </motion.div>
          </div>

          {/* Stat strip — newspaper-style numbers across the bottom */}
          <motion.div
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-16 grid grid-cols-2 gap-y-8 border-t border-border/50 pt-8 sm:grid-cols-4"
          >
            {[
              { v: "500+", l: "Tournaments tracked", note: "ATP · WTA · ITF · National" },
              { v: "24/7", l: "AI co-pilot", note: "Always-on match prep" },
              { v: "3", l: "Court surfaces", note: "Clay · Grass · Hard" },
              { v: "13+", l: "Age & up", note: "Junior to pro" },
            ].map((s) => (
              <motion.div key={s.l} variants={fade} className="px-4">
                <div className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{s.v}</div>
                <Marginalia>{s.l}</Marginalia>
                <div className="mt-1 text-[10px] text-muted-foreground/70">{s.note}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ─────────── Featured spread: AI insight ─────────── */}
      <section className="relative py-24 md:py-28">
        <div className="container">
          <Rule />
          <div className="grid grid-cols-12 gap-x-6 gap-y-10 pt-10">
            <div className="col-span-12 lg:col-span-3">
              <Marginalia>Section I</Marginalia>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">The Edge Report</div>
            </div>
            <motion.div
              initial="visible"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="col-span-12 lg:col-span-9"
            >
              <motion.h2
                variants={fade}
                className="text-balance font-bold leading-[1.05] tracking-tight text-foreground text-[clamp(1.875rem,1.2rem+3vw,3.75rem)]"
              >
                Read your opponent before the
                <span className="italic text-muted-foreground"> first ball</span> is in play.
              </motion.h2>

              <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-12">
                <motion.div variants={fade} className="md:col-span-7">
                  <div className="rounded-xl border-l-2 border-[hsl(var(--gold))] bg-secondary/20 p-6">
                    <p className="text-xl font-medium leading-snug text-foreground">
                      “Opponent serves <span className="text-[hsl(var(--gold))]">68% wide</span> on deuce —
                      protect the alley early and pull them off the T.”
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      <Brain className="h-3 w-3 text-[hsl(var(--gold))]" /> AI scouting · Clay · Last 12 matches
                    </div>
                  </div>
                </motion.div>
                <motion.div variants={fade} className="md:col-span-5">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <Marginalia>Season form</Marginalia>
                    <span className="font-mono text-xs text-[hsl(var(--gold))]">+24%</span>
                  </div>
                  <div className="mt-3 h-24 w-full">
                    <FormSpark />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between border-t border-border/50 pt-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">12–3</span>
                    <Marginalia>Last 15</Marginalia>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────── Capabilities — editorial index ─────────── */}
      <section className="relative py-24 md:py-28">
        <div className="container">
          <Rule />
          <div className="grid grid-cols-12 gap-x-6 gap-y-10 pt-10">
            <div className="col-span-12 lg:col-span-3">
              <Marginalia>Section II</Marginalia>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">The Catalogue</div>
              <p className="mt-6 max-w-[22ch] text-[13px] leading-relaxed text-muted-foreground">
                Six surfaces of the same workspace — built to disappear behind the work.
              </p>
            </div>

            <motion.h2
              initial="visible"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fade}
              className="col-span-12 lg:col-span-9 text-balance font-bold leading-[1.05] tracking-tight text-foreground text-[clamp(1.875rem,1.2rem+3vw,3.75rem)]"
            >
              Everything between{" "}
              <span className="italic font-normal text-muted-foreground">first serve</span>{" "}
              and match point.
            </motion.h2>

            <motion.ol
              initial="visible"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={stagger}
              className="col-span-12 lg:col-start-4 lg:col-span-9 mt-4 divide-y divide-border/50 border-y border-border/50"
            >
              {capabilities.map((c) => {
                const Icon = c.icon;
                return (
                  <motion.li
                    key={c.title}
                    variants={fade}
                    className="group grid grid-cols-12 items-baseline gap-x-6 gap-y-3 py-7 transition-colors hover:bg-[hsl(var(--emerald-mid)/0.04)]"
                  >
                    <span className="col-span-2 sm:col-span-1 font-mono text-xs text-muted-foreground">{c.n}</span>
                    <div className="col-span-10 sm:col-span-4 flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[hsl(var(--gold))]" />
                      <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{c.title}</h3>
                    </div>
                    <p className="col-span-12 sm:col-span-6 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                      {c.desc}
                    </p>
                    <ArrowUpRight className="hidden sm:block col-span-1 h-4 w-4 justify-self-end text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--gold))]" />
                  </motion.li>
                );
              })}
            </motion.ol>
          </div>
        </div>
      </section>

      {/* ─────────── Surfaces — full-width plate ─────────── */}
      <section className="relative py-24 md:py-28">
        <div className="container">
          <Rule />
          <div className="grid grid-cols-12 gap-x-6 gap-y-10 pt-10">
            <div className="col-span-12 lg:col-span-3">
              <Marginalia>Section III</Marginalia>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">The Plates</div>
            </div>
            <motion.h2
              initial="visible"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fade}
              className="col-span-12 lg:col-span-9 text-balance font-bold leading-[1.05] tracking-tight text-foreground text-[clamp(1.875rem,1.3rem+2.4vw,3rem)]"
            >
              Clay, grass, hard —{" "}
              <span className="italic font-normal text-muted-foreground">one platform.</span>
            </motion.h2>
          </div>

          <motion.div
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-3"
          >
            {surfaces.map((s, i) => (
              <motion.figure key={s.name} variants={fade} className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-border/50">
                  <SurfaceImage
                    src={s.image}
                    name={s.name}
                    color={s.color}
                    sizes="(min-width: 1024px) 30vw, (min-width: 768px) 33vw, 100vw"
                    lineColor="hsl(0 0% 100%)"
                    lineOpacity={0}
                    className="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
                  />
                  <span aria-hidden className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.28em] text-cream/90">
                    Plate {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-border/50 pt-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">{s.name}</h3>
                    </div>
                    <p className="mt-1 max-w-[28ch] text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--gold))]" />
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────── Workflow ─────────── */}
      <section className="relative py-24 md:py-28">
        <div className="container">
          <Rule />
          <div className="grid grid-cols-12 gap-x-6 gap-y-10 pt-10">
            <div className="col-span-12 lg:col-span-3">
              <Marginalia>Section IV</Marginalia>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">The Match Week</div>
            </div>
            <motion.h2
              initial="visible"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fade}
              className="col-span-12 lg:col-span-9 text-balance font-bold leading-[1.05] tracking-tight text-foreground text-[clamp(1.875rem,1.3rem+2.4vw,3rem)]"
            >
              From practice court to match point —{" "}
              <span className="italic font-normal text-muted-foreground">in four moves.</span>
            </motion.h2>
          </div>

          <motion.ol
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-4"
          >
            {workflow.map((w) => {
              const Icon = w.icon;
              return (
                <motion.li key={w.step} variants={fade} className="relative">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl text-[hsl(var(--gold))]">{w.step}</span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-4 h-px w-full bg-border/60" />
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
                </motion.li>
              );
            })}
          </motion.ol>
        </div>
      </section>

      {/* ─────────── Closing CTA ─────────── */}
      <section className="relative overflow-hidden py-28 md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 50%, hsl(var(--emerald-mid) / 0.20), transparent 60%), radial-gradient(circle at 70% 40%, hsl(var(--gold) / 0.10), transparent 60%)",
          }}
        />
        <div className="container relative">
          <Rule />
          <motion.div
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="grid grid-cols-12 gap-x-6 gap-y-10 pt-14"
          >
            <motion.div variants={fade} className="col-span-12 lg:col-span-3">
              <Marginalia>Colophon</Marginalia>
              <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-muted-foreground">
                Free to start, built to scale with your season. No credit card required.
              </p>
            </motion.div>
            <motion.div variants={fade} className="col-span-12 lg:col-span-9">
              <h2 className="text-balance font-bold leading-[1.0] tracking-tight text-foreground text-[clamp(2.25rem,1.4rem+4vw,5.25rem)]">
                Step on court{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--emerald-mid))] to-[hsl(var(--gold))] bg-clip-text text-transparent">
                  with an edge.
                </span>
              </h2>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button size="lg" className="group h-12 gap-2 px-7 text-sm shadow-lg shadow-[hsl(var(--emerald-mid)/0.3)] hover:shadow-xl hover:shadow-[hsl(var(--emerald-mid)/0.45)]" asChild>
                  <Link to="/signup">
                    Create free account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Link to="/login" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                  Already on TennisAI? Sign in →
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="border-t border-border/70 py-12">
        <div className="container">
          <div className="grid grid-cols-12 gap-6 items-end">
            <div className="col-span-12 sm:col-span-4 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--emerald-mid))] shadow-md shadow-[hsl(var(--emerald-mid)/0.3)]">
                <span className="text-xs font-bold text-cream">T</span>
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--gold))] ring-2 ring-background" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">TennisAI</div>
                <Marginalia>Est. 2026 · Global</Marginalia>
              </div>
            </div>
            <nav className="col-span-12 sm:col-span-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
              <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
              <span className="cursor-default transition-colors hover:text-foreground">Privacy</span>
              <span className="cursor-default transition-colors hover:text-foreground">Terms</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-3 w-3" /> Global</span>
            </nav>
            <p className="col-span-12 sm:col-span-3 text-right text-xs text-muted-foreground">
              © {new Date().getFullYear()} TennisAI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;