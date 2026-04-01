import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, type Variants, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Trophy, Brain, Calendar, Users, Zap, Shield, BarChart3, Globe } from "lucide-react";
import { useRef } from "react";

const fade: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const slideUp: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

const features = [
  { icon: <Trophy className="h-5 w-5" />, title: "Tournaments", desc: "Explore, filter, and plan your competition calendar worldwide." },
  { icon: <Calendar className="h-5 w-5" />, title: "Smart Schedule", desc: "Unified calendar for training, matches, travel, and recovery." },
  { icon: <Brain className="h-5 w-5" />, title: "AI Insights", desc: "Match preparation powered by conditions, equipment, and style analysis." },
  { icon: <Users className="h-5 w-5" />, title: "Team Hub", desc: "Role-based connections between players, coaches, and supporters." },
  { icon: <BarChart3 className="h-5 w-5" />, title: "Performance", desc: "Track progress with detailed stats, trends, and improvement metrics." },
  { icon: <Shield className="h-5 w-5" />, title: "Equipment", desc: "Monitor gear condition and get AI-powered upgrade suggestions." },
];

const stats = [
  { value: "10K+", label: "Active Players" },
  { value: "500+", label: "Tournaments" },
  { value: "98%", label: "Satisfaction" },
  { value: "24/7", label: "AI Support" },
];

const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <>
      {/* ─── Hero ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated background elements */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary blur-[180px]"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-primary blur-[160px]"
          />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black_20%,transparent_100%)]" />
        </div>

        <motion.div style={{ opacity: heroOpacity, scale: heroScale, y: heroY }} className="container relative flex flex-col items-center gap-8 py-24 text-center">
          <motion.div initial="hidden" animate="visible" variants={fade} custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <Zap className="h-3 w-3" />
              </motion.span>
              AI-powered tennis platform
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fade}
            custom={1}
            className="max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight text-foreground sm:text-7xl lg:text-8xl xl:text-9xl"
          >
            Your edge
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              on court.
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fade}
            custom={2}
            className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Tournament planning, training management, and AI match insights — built for players, coaches, and their teams.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fade}
            custom={3}
            className="mt-6 flex items-center gap-4"
          >
            <Button size="lg" className="group h-13 gap-2 px-8 text-sm shadow-xl shadow-primary/25 transition-all hover:shadow-2xl hover:shadow-primary/30" asChild>
              <Link to="/signup">
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-13 px-8 text-sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Scroll</span>
              <div className="h-8 w-5 rounded-full border border-border/60 p-1">
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="h-1.5 w-1.5 rounded-full bg-primary/60"
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Stats bar ─── */}
      <section className="relative z-10 border-y border-border bg-card/80 backdrop-blur-md">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4"
          >
            {stats.map((s) => (
              <motion.div key={s.label} variants={scaleIn} className="flex flex-col items-center gap-1 py-8 sm:py-10">
                <span className="text-2xl font-bold text-foreground sm:text-3xl">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-28 md:py-40">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fade}
            custom={0}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Features</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">compete</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              A complete suite of tools designed for the modern tennis player and coaching team.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={slideUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Roles section ─── */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/30 py-28 md:py-36">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-primary/5 to-transparent" />
        </div>
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fade}
            custom={0}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built for everyone</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One platform, three perspectives
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
            className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3"
          >
            {[
              { role: "Player", desc: "Track your progress, plan tournaments, and get AI-powered match insights.", icon: <Trophy className="h-6 w-6" /> },
              { role: "Coach", desc: "Manage multiple players, schedule training, and monitor performance.", icon: <Users className="h-6 w-6" /> },
              { role: "Fan", desc: "Follow players, view upcoming events, and stay connected to the game.", icon: <Globe className="h-6 w-6" /> },
            ].map((r) => (
              <motion.div
                key={r.role}
                variants={scaleIn}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center transition-colors hover:border-primary/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  {r.icon}
                </div>
                <h3 className="text-lg font-bold text-foreground">{r.role}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-28 md:py-40">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary blur-[200px]"
          />
        </div>
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fade}
            custom={0}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Ready to level up
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                your game?
              </span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Join thousands of players and coaches already using TennisAI. Start free — no credit card required.
            </p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fade}
              custom={1}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <Button size="lg" className="group h-14 gap-2 px-10 text-base shadow-xl shadow-primary/25 transition-all hover:shadow-2xl hover:shadow-primary/30" asChild>
                <Link to="/signup">
                  Create Free Account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-base" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="container flex flex-col items-center justify-between gap-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-sm font-bold text-foreground">TennisAI</span>
          </div>
          <nav className="flex gap-8 text-xs text-muted-foreground">
            <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
            <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
            <span className="cursor-default hover:text-foreground transition-colors">Privacy</span>
            <span className="cursor-default hover:text-foreground transition-colors">Terms</span>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TennisAI. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default Index;
