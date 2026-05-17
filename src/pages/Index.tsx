import { Link } from "react-router-dom";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  motion,
  type Variants,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Trophy,
  Brain,
  Calendar,
  Users,
  Shield,
  BarChart3,
  Target,
  Sparkles,
  CheckCircle2,
  Activity,
  Globe,
} from "lucide-react";
import surfaceClay from "@/assets/surface-clay.jpg";
import surfaceGrass from "@/assets/surface-grass.jpg";
import surfaceHard from "@/assets/surface-hard.jpg";
import { SurfaceImage } from "@/components/SurfaceImage";
import { TennisRallyScene } from "@/components/TennisRallyScene";

/* ─── Motion presets (medium register, 3/5) ─── */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.6, ease: EASE },
  }),
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const tileIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
};

/* ─── Data ─── */

const features = [
  { icon: Trophy, title: "Tournaments", desc: "One global calendar across federations, surfaces and categories." },
  { icon: Calendar, title: "Smart schedule", desc: "Trainings, matches, travel and recovery on a single timeline." },
  { icon: Brain, title: "AI match insights", desc: "Pre-match prep tuned to opponent, surface and conditions." },
  { icon: Users, title: "Team hub", desc: "Role-aware connections between players, coaches and supporters." },
  { icon: BarChart3, title: "Performance", desc: "Win-rate trends and improvement signals across the season." },
  { icon: Shield, title: "Equipment", desc: "Track string tension, racquet wear and shoe mileage with nudges." },
];

const workflow = [
  { step: "01", title: "Plan", desc: "Build a season around the tournaments that matter.", icon: Calendar },
  { step: "02", title: "Train", desc: "Coordinate sessions and review structured feedback.", icon: Target },
  { step: "03", title: "Compete", desc: "Step on court with AI-powered match scouting.", icon: Trophy },
  { step: "04", title: "Improve", desc: "Turn every match into measurable progress.", icon: BarChart3 },
];

const surfaces = [
  { name: "Clay", color: "hsl(var(--court-clay))", desc: "Roland-Garros style", image: surfaceClay, lineColor: "hsl(0 0% 100%)", lineOpacity: 0 },
  { name: "Grass", color: "hsl(var(--court-grass))", desc: "Wimbledon style", image: surfaceGrass, lineColor: "hsl(0 0% 100%)", lineOpacity: 0 },
  { name: "Hard", color: "hsl(var(--court-hard))", desc: "US/AO style", image: surfaceHard, lineColor: "hsl(0 0% 100%)", lineOpacity: 0 },
];

/* ─── Decorative bits ─── */

function MiniCourt() {
  const L = "hsl(var(--cream) / 0.85)";
  return (
    <svg viewBox="0 0 400 620" className="h-full w-full" aria-hidden role="img">
      <defs>
        <linearGradient id="bentoCourtFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--emerald-mid))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--emerald-deep))" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <rect x="20" y="30" width="360" height="560" rx="6" fill="url(#bentoCourtFill)" stroke={L} strokeWidth="3" />
      <line x1="62.5" y1="30" x2="62.5" y2="590" stroke={L} strokeWidth="2" />
      <line x1="337.5" y1="30" x2="337.5" y2="590" stroke={L} strokeWidth="2" />
      <line x1="62.5" y1="190" x2="337.5" y2="190" stroke={L} strokeWidth="2" />
      <line x1="62.5" y1="430" x2="337.5" y2="430" stroke={L} strokeWidth="2" />
      <line x1="200" y1="190" x2="200" y2="430" stroke={L} strokeWidth="2" />
      <line x1="10" y1="310" x2="390" y2="310" stroke="hsl(var(--cream) / 0.6)" strokeWidth="1.2" strokeDasharray="3 4" />
      <circle cx="200" cy="190" r="4" fill="hsl(var(--gold))" opacity="0.95" />
    </svg>
  );
}

function StatTicker() {
  // Subtle data viz — gold spark line over emerald grid
  const points = [10, 18, 14, 26, 22, 34, 30, 42, 38, 50, 46, 58];
  const max = 60;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${100 - (p / max) * 90}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="hsl(var(--cream) / 0.08)" strokeWidth="0.4" />
      ))}
      <path d={`${path} L 100 100 L 0 100 Z`} fill="url(#sparkFill)" />
      <path d={path} stroke="hsl(var(--gold))" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={(i / (points.length - 1)) * 100} cy={100 - (p / max) * 90} r={i === points.length - 1 ? 1.6 : 0.8} fill="hsl(var(--gold))" />
      ))}
    </svg>
  );
}

/* ─── Tile wrapper ─── */

function Tile({
  className = "",
  children,
  hoverLift = true,
  bare = true,
}: {
  className?: string;
  children: React.ReactNode;
  hoverLift?: boolean;
  /** When true (default), render without a border/background — a frameless tile. */
  bare?: boolean;
}) {
  return (
    <motion.div
      variants={tileIn}
      whileHover={hoverLift ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`group relative overflow-hidden rounded-2xl transition-colors ${
        bare
          ? ""
          : "border border-border/70 bg-card/80 backdrop-blur-sm hover:border-[hsl(var(--gold)/0.45)]"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── Page ─── */

const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, prefersReduced ? 0 : 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, prefersReduced ? 1 : 0.7]);

  const { scrollYProgress: pageProgress } = useScroll();
  const progressX = useSpring(pageProgress, { stiffness: 120, damping: 30, mass: 0.2 });

  return (
    <>
      {/* Top scroll progress bar — emerald → gold */}
      <motion.div
        style={{ scaleX: progressX }}
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[hsl(var(--emerald-mid))] via-[hsl(var(--emerald-mid))] to-[hsl(var(--gold))]"
      />

      {/* ──────── Hero bento ──────── */}
      <section ref={heroRef} className="relative isolate overflow-hidden pb-16 pt-24 md:pb-24 md:pt-28">
        {/* Ambient — restrained */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 20% 0%, hsl(var(--emerald-mid) / 0.22), transparent 60%), radial-gradient(ellipse 40% 35% at 90% 10%, hsl(var(--gold) / 0.10), transparent 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 court-lines opacity-[0.18] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black_30%,transparent_100%)]" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container relative">
          {/* Eyebrow */}
          <motion.div initial="hidden" animate="visible" variants={rise} custom={0} className="mb-6 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.08)] px-3 py-1 text-[11px] font-medium tracking-wide text-[hsl(var(--gold))]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--gold))] opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--gold))]" />
              </span>
              New season · AI insights v2
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
              For players · coaches · supporters
            </span>
          </motion.div>

          {/* Bento grid — 12 col on desktop, 4 rows */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-12"
          >
            {/* Headline tile — large */}
            <Tile className="sm:col-span-2 md:col-span-6 lg:col-span-8 lg:row-span-2 p-6 sm:p-8 lg:p-11" hoverLift={false}>
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <h1 className="text-balance text-4xl font-bold leading-[0.98] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                    Train smart.<br />
                    Play sharper.{" "}
                    <span className="bg-gradient-to-r from-[hsl(var(--gold))] via-[hsl(var(--gold))] to-[hsl(var(--emerald-mid))] bg-clip-text text-transparent">
                      Win more.
                    </span>
                  </h1>
                  <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                    The all-court operating system for competitive tennis — tournament planning,
                    training management, and AI match insights, built for players, coaches and their teams.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" className="group h-12 gap-2 px-6 text-sm shadow-lg shadow-[hsl(var(--emerald-mid)/0.3)] hover:shadow-xl hover:shadow-[hsl(var(--emerald-mid)/0.45)]" asChild>
                    <Link to="/signup">
                      Start free
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-6 text-sm" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--gold))]" /> No credit card
                  </span>
                </div>
              </div>
              {/* Gold accent corner */}
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--gold)/0.10)] blur-3xl" />
            </Tile>

            {/* Court tile */}
            <Tile className="sm:col-span-2 md:col-span-6 lg:col-span-4 lg:row-span-2 p-0">
              <div className="relative h-full min-h-[260px] sm:min-h-[300px] lg:min-h-[420px] w-full overflow-hidden">
                <div className="absolute inset-0">
                  <MiniCourt />
                </div>
                <div className="absolute inset-0">
                  <TennisRallyScene className="absolute inset-0 h-full w-full opacity-90" />
                </div>
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    <Activity className="h-3 w-3 text-[hsl(var(--gold))]" /> Live rally
                  </div>
                  <span className="text-[10px] font-mono text-foreground/80">Court 1 · 30–15</span>
                </div>
              </div>
            </Tile>

            {/* AI insight tile */}
            <Tile className="sm:col-span-1 md:col-span-3 lg:col-span-4 p-5 sm:p-6 min-h-[150px]">
              <div className="relative flex h-full flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--gold))]">
                    <Brain className="h-3 w-3" /> AI insight
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  Opponent serves <span className="font-semibold text-[hsl(var(--gold))]">68% wide</span> on deuce —
                  protect the alley early and pull them off the T.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded-full bg-secondary/60 px-2 py-0.5">Surface: Clay</span>
                  <span className="rounded-full bg-secondary/60 px-2 py-0.5">Last 12 matches</span>
                </div>
              </div>
            </Tile>

            {/* Stat ticker tile */}
            <Tile className="sm:col-span-1 md:col-span-3 lg:col-span-4 p-5 sm:p-6 min-h-[150px]">
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    <BarChart3 className="h-3 w-3" /> Season form
                  </div>
                  <span className="text-xs font-medium text-[hsl(var(--gold))]">+24%</span>
                </div>
                <div className="h-16 flex-1">
                  <StatTicker />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold tracking-tight text-foreground">12-3</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 15</span>
                </div>
              </div>
            </Tile>

            {/* Stat tiles row */}
            {[
              { v: "500+", l: "Tournaments tracked" },
              { v: "24/7", l: "AI co-pilot" },
              { v: "3", l: "Court surfaces" },
              { v: "13+", l: "Age & up" },
            ].map((s) => (
              <Tile key={s.l} className="sm:col-span-1 md:col-span-3 lg:col-span-3 p-5">
                <div className="flex h-full items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{s.v}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.l}</div>
                  </div>
                  <span className="h-1.5 w-8 rounded-full bg-gradient-to-r from-[hsl(var(--emerald-mid))] to-[hsl(var(--gold))] opacity-70" />
                </div>
              </Tile>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ──────── Features bento ──────── */}
      <section className="relative py-24 md:py-32">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={rise}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--gold))]">
              <Sparkles className="h-3.5 w-3.5" /> Features
            </span>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Everything between{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--emerald-mid))] to-[hsl(var(--gold))] bg-clip-text text-transparent">
                first serve
              </span>{" "}
              and match point.
            </h2>
            <p className="mt-4 text-muted-foreground">
              A complete suite for the modern competitive player and coaching team.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12"
          >
            {features.map((f, i) => {
              const Icon = f.icon;
              // Vary tile spans for bento feel
              const span =
                i === 0 ? "sm:col-span-2 lg:col-span-5"
                : i === 1 ? "sm:col-span-1 lg:col-span-3"
                : i === 2 ? "sm:col-span-1 lg:col-span-4"
                : i === 3 ? "sm:col-span-1 lg:col-span-4"
                : i === 4 ? "sm:col-span-2 lg:col-span-5"
                : "sm:col-span-1 lg:col-span-3";
              return (
                <Tile key={f.title} className={`${span} p-6`}>
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--emerald-mid)/0.12)] text-[hsl(var(--gold))]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--gold))]" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold)/0.5)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </Tile>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ──────── Surface showcase ──────── */}
      <section className="relative border-y border-border bg-secondary/30 py-20">
        <div className="container">
          <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--gold))]">
                Built for every surface
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Clay, grass, hard — one platform.
              </h2>
            </div>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="grid gap-4 sm:grid-cols-3"
          >
            {surfaces.map((s) => (
              <Tile key={s.name} className="p-0">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <SurfaceImage
                    src={s.image}
                    name={s.name}
                    color={s.color}
                    lineColor={s.lineColor}
                    lineOpacity={s.lineOpacity}
                    className="transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/15 to-transparent" />
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold text-foreground">{s.name} courts</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </Tile>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ──────── Workflow ──────── */}
      <section className="relative py-24 md:py-32">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={rise}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--gold))]">Your match week</span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From practice court to match point — in four moves.
            </h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {workflow.map((w, i) => {
              const Icon = w.icon;
              return (
                <Tile key={w.step} className="p-6">
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{w.step}</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--emerald-mid)/0.12)] text-[hsl(var(--gold))]">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{w.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
                  </div>
                  {i < workflow.length - 1 && (
                    <div className="pointer-events-none absolute right-[-10px] top-1/2 hidden -translate-y-1/2 lg:block">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </Tile>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ──────── CTA ──────── */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 40% at 50% 50%, hsl(var(--emerald-mid) / 0.22), transparent 60%), radial-gradient(circle at 70% 40%, hsl(var(--gold) / 0.10), transparent 60%)",
            }}
          />
        </div>
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={rise}
            className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl p-10 text-center md:p-14"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(var(--gold)),hsl(var(--gold)/0.5))] opacity-80 blur-[2px]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--gold))]">Ready up</span>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Step on court{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--emerald-mid))] to-[hsl(var(--gold))] bg-clip-text text-transparent">
                with an edge.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
              Join the players and coaching teams already using TennisAI to plan, train and win.
              Free to start, built to scale with your season.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="group h-12 gap-2 px-7 text-sm shadow-lg shadow-[hsl(var(--emerald-mid)/0.3)] hover:shadow-xl hover:shadow-[hsl(var(--emerald-mid)/0.45)]" asChild>
                <Link to="/signup">
                  Create free account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-7 text-sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────── Footer ──────── */}
      <footer className="border-t border-border bg-card/50 py-10">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--emerald-mid))] shadow-md shadow-[hsl(var(--emerald-mid)/0.3)]">
              <span className="text-xs font-bold text-cream">T</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--gold))] ring-2 ring-background" />
            </div>
            <span className="text-sm font-bold text-foreground">TennisAI</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
            <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
            <span className="cursor-default transition-colors hover:text-foreground">Privacy</span>
            <span className="cursor-default transition-colors hover:text-foreground">Terms</span>
            <span className="hidden items-center gap-1.5 sm:inline-flex"><Globe className="h-3 w-3" /> Global</span>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TennisAI</p>
        </div>
      </footer>
    </>
  );
};

export default Index;