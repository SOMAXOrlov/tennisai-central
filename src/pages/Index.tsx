import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  motion,
  type Variants,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  Trophy,
  Brain,
  Calendar,
  Users,
  Zap,
  Shield,
  BarChart3,
  Globe,
  Target,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useRef } from "react";
import surfaceClay from "@/assets/surface-clay.jpg";
import surfaceGrass from "@/assets/surface-grass.jpg";
import surfaceHard from "@/assets/surface-hard.jpg";

/* ──────────────────────────── Motion presets ──────────────────────────── */

const fade: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

/* ──────────────────────────── Data ──────────────────────────── */

const features = [
  { icon: <Trophy className="h-5 w-5" />, title: "Tournaments", desc: "Discover, filter and plan your competition calendar across federations worldwide.", tag: "Global" },
  { icon: <Calendar className="h-5 w-5" />, title: "Smart Schedule", desc: "One unified timeline for trainings, matches, travel windows, and recovery.", tag: "Daily" },
  { icon: <Brain className="h-5 w-5" />, title: "AI Match Insights", desc: "Pre-match prep tuned to opponent style, surface, weather and your equipment.", tag: "AI" },
  { icon: <Users className="h-5 w-5" />, title: "Team Hub", desc: "Role-based connections between players, coaches, parents and supporters.", tag: "Roles" },
  { icon: <BarChart3 className="h-5 w-5" />, title: "Performance", desc: "Trends, win-rates and improvement signals across surfaces and tournaments.", tag: "Stats" },
  { icon: <Shield className="h-5 w-5" />, title: "Equipment", desc: "Track string tension, racquet wear and shoe mileage. Get upgrade nudges.", tag: "Gear" },
];

const stats = [
  { value: "500+", label: "Tournaments tracked" },
  { value: "24/7", label: "AI co-pilot" },
  { value: "3", label: "Court surfaces" },
  { value: "13+", label: "Age & up" },
];

const surfaces = [
  { name: "Clay", color: "hsl(var(--court-clay))", desc: "Roland-Garros style", image: surfaceClay },
  { name: "Grass", color: "hsl(var(--court-grass))", desc: "Wimbledon style", image: surfaceGrass },
  { name: "Hard", color: "hsl(var(--court-hard))", desc: "US/AO style", image: surfaceHard },
];

const workflow = [
  { step: "01", title: "Plan", desc: "Build a season around the tournaments that matter to you.", icon: <Calendar className="h-4 w-4" /> },
  { step: "02", title: "Train", desc: "Coordinate sessions with your coach and review feedback.", icon: <Target className="h-4 w-4" /> },
  { step: "03", title: "Compete", desc: "Step on court prepared with AI-powered match scouting.", icon: <Trophy className="h-4 w-4" /> },
  { step: "04", title: "Improve", desc: "Translate every match into measurable progress.", icon: <BarChart3 className="h-4 w-4" /> },
];

/* ──────────────────────────── Decorative bits ──────────────────────────── */

function TennisBall({ className = "" }: { className?: string }) {
  return (
    <div className={`relative rounded-full tennis-ball tennis-seam ${className}`} aria-hidden />
  );
}

function CourtDiagram() {
  // Stylized top-down tennis court SVG
  return (
    <svg viewBox="0 0 400 600" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="courtFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="360" height="560" rx="10" fill="url(#courtFill)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
      {/* singles sidelines */}
      <line x1="60" y1="20" x2="60" y2="580" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1" />
      <line x1="340" y1="20" x2="340" y2="580" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1" />
      {/* service boxes */}
      <line x1="60" y1="180" x2="340" y2="180" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1" />
      <line x1="60" y1="420" x2="340" y2="420" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1" />
      <line x1="200" y1="180" x2="200" y2="420" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1" />
      {/* net */}
      <line x1="20" y1="300" x2="380" y2="300" stroke="hsl(var(--foreground) / 0.55)" strokeWidth="2" strokeDasharray="3 3" />
      {/* baseline ticks */}
      <line x1="200" y1="20" x2="200" y2="40" stroke="hsl(var(--primary) / 0.6)" strokeWidth="1.2" />
      <line x1="200" y1="560" x2="200" y2="580" stroke="hsl(var(--primary) / 0.6)" strokeWidth="1.2" />
    </svg>
  );
}

/* ──────────────────────────── Page ──────────────────────────── */

const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  const { scrollYProgress: pageProgress } = useScroll();
  const progressX = useSpring(pageProgress, { stiffness: 120, damping: 30, mass: 0.2 });

  return (
    <>
      {/* Top scroll progress bar */}
      <motion.div
        style={{ scaleX: progressX }}
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-primary via-primary/80 to-[hsl(var(--tennis-ball))]"
      />

      {/* ─────────── Hero ─────────── */}
      <section ref={heroRef} className="relative isolate min-h-screen overflow-hidden">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 court-surface" />
        <div className="pointer-events-none absolute inset-0 court-lines [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)]" />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-[160px]"
        />
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute right-[-120px] top-1/3 h-[380px] w-[380px] rounded-full bg-[hsl(var(--tennis-ball))]/10 blur-[140px]"
        />

        {/* Court diagram on the right */}
        <div className="pointer-events-none absolute right-[-40px] top-1/2 hidden h-[720px] -translate-y-1/2 opacity-60 lg:block xl:right-8 xl:opacity-90">
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full w-[420px]"
          >
            <CourtDiagram />
          </motion.div>
        </div>

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="container relative flex min-h-screen flex-col justify-center py-28"
        >
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              {/* Badge */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={0}>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  New season · AI insights v2
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial="hidden"
                animate="visible"
                variants={fade}
                custom={1}
                className="mt-8 max-w-3xl text-balance text-5xl font-extrabold leading-[0.95] tracking-tight text-foreground sm:text-7xl xl:text-8xl"
              >
                Train smart.
                <br />
                Play sharper.{" "}
                <span className="inline-block align-baseline">
                  <span className="text-shine">Win more.</span>
                </span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                initial="hidden"
                animate="visible"
                variants={fade}
                custom={2}
                className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                The all-court operating system for competitive tennis — tournament planning,
                training management, and AI match insights, built for players, coaches, and their teams.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fade}
                custom={3}
                className="mt-10 flex flex-wrap items-center gap-3"
              >
                <Button
                  size="lg"
                  className="group h-13 gap-2 px-7 text-sm shadow-xl shadow-primary/25 transition-all hover:shadow-2xl hover:shadow-primary/40"
                  asChild
                >
                  <Link to="/signup">
                    Start free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-13 px-7 text-sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <span className="ml-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  No credit card
                </span>
              </motion.div>

              {/* Mini trust row */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fade}
                custom={4}
                className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-border/60 pt-6"
              >
                {stats.slice(0, 3).map((s) => (
                  <div key={s.label}>
                    <div className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{s.value}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Bouncing ball visual (right column on mobile) */}
            <div className="relative lg:col-span-5 lg:hidden">
              <div className="relative mx-auto flex h-64 w-64 items-end justify-center">
                <TennisBall className="h-24 w-24 animate-ball-bounce" />
                <div className="absolute bottom-2 h-2 w-32 rounded-full bg-foreground/20 blur-md" />
              </div>
            </div>
          </div>

          {/* Floating ball (desktop) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute right-[18%] top-[22%] hidden lg:block"
          >
            <TennisBall className="h-28 w-28 animate-ball-bounce" />
          </motion.div>

          {/* Scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">Scroll</span>
              <div className="h-8 w-5 rounded-full border border-border/70 p-1">
                <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─────────── Logo / surface marquee ─────────── */}
      <section className="relative z-10 border-y border-border bg-card/60 py-6 backdrop-blur">
        <div className="container">
          <div className="flex items-center gap-6 overflow-hidden">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Built for every surface
            </span>
            <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
              <div className="flex w-max animate-marquee gap-10 pr-10">
                {[...surfaces, ...surfaces, ...surfaces, ...surfaces].map((s, i) => (
                  <div key={i} className="flex shrink-0 items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                      style={{ background: s.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Features ─────────── */}
      <section className="relative py-28 md:py-36">
        <div className="pointer-events-none absolute inset-0 court-lines [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black_20%,transparent_100%)] opacity-50" />
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fade}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Features
            </span>
            <h2 className="mt-5 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Everything you need between{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(var(--tennis-ball))] bg-clip-text text-transparent">
                first serve
              </span>{" "}
              and match point.
            </h2>
            <p className="mt-5 text-muted-foreground">
              A complete suite of tools designed for the modern tennis player and coaching team.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={slideUp}
                whileHover={{ y: -4 }}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    {f.icon}
                  </div>
                  <span className="rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {f.tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────── Workflow / four steps ─────────── */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/30 py-28">
        <div className="pointer-events-none absolute inset-0 court-lines opacity-40" />
        <div className="container relative">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Your match week</span>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From practice court to match point — in four moves.
            </h2>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {workflow.map((w, i) => (
              <motion.div
                key={w.step}
                variants={slideUp}
                className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{w.step}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {w.icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{w.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
                {i < workflow.length - 1 && (
                  <div className="pointer-events-none absolute right-[-10px] top-1/2 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────── Roles ─────────── */}
      <section className="relative py-28 md:py-36">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fade}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Built for everyone</span>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              One platform. Three perspectives.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Whether you're competing, coaching, or supporting — TennisAI adapts to your role.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-3"
          >
            {[
              { role: "Player", desc: "Track progress, plan tournaments, get AI-powered match insights.", icon: <Trophy className="h-6 w-6" />, accent: "from-primary/20 to-primary/0" },
              { role: "Coach", desc: "Manage multiple players, schedule training, monitor performance.", icon: <Users className="h-6 w-6" />, accent: "from-[hsl(var(--tennis-ball))]/30 to-[hsl(var(--tennis-ball))]/0" },
              { role: "Fan", desc: "Follow players, view upcoming events, stay connected to the game.", icon: <Globe className="h-6 w-6" />, accent: "from-[hsl(var(--court-hard))]/25 to-[hsl(var(--court-hard))]/0" },
            ].map((r) => (
              <motion.div
                key={r.role}
                variants={slideUp}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center transition-colors hover:border-primary/40"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${r.accent}`} />
                <div className="relative flex flex-col items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 ring-1 ring-border text-primary backdrop-blur">
                    {r.icon}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{r.role}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="relative overflow-hidden py-28 md:py-36">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[200px]"
          />
        </div>
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fade}
            className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-card/70 p-12 text-center shadow-2xl shadow-primary/10 backdrop-blur md:p-16"
          >
            <div className="pointer-events-none absolute -right-10 -top-10">
              <TennisBall className="h-24 w-24 opacity-90" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Ready up</span>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Step on court{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(var(--tennis-ball))] bg-clip-text text-transparent">
                with an edge.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
              Join the players and coaching teams already using TennisAI to plan, train, and win.
              Free to start, built to scale with your season.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="group h-13 gap-2 px-8 text-sm shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40" asChild>
                <Link to="/signup">
                  Create free account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-13 px-8 text-sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="container flex flex-col items-center justify-between gap-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20">
              <span className="text-xs font-bold text-primary-foreground">T</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--tennis-ball))] ring-2 ring-background" />
            </div>
            <span className="text-sm font-bold text-foreground">TennisAI</span>
          </div>
          <nav className="flex gap-8 text-xs text-muted-foreground">
            <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
            <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
            <span className="cursor-default transition-colors hover:text-foreground">Privacy</span>
            <span className="cursor-default transition-colors hover:text-foreground">Terms</span>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TennisAI. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default Index;