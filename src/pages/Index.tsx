import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Trophy, Brain, Calendar, Users, Zap } from "lucide-react";

const fade: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

const features = [
  { icon: <Trophy className="h-5 w-5" />, title: "Tournaments", desc: "Explore, filter, and plan your competition calendar worldwide." },
  { icon: <Calendar className="h-5 w-5" />, title: "Schedule", desc: "Unified calendar for training, matches, travel, and recovery." },
  { icon: <Brain className="h-5 w-5" />, title: "AI Insights", desc: "Match preparation powered by conditions, equipment, and style analysis." },
  { icon: <Users className="h-5 w-5" />, title: "Connections", desc: "Role-based links between players, coaches, and supporters." },
];

const Index = () => (
  <>
    {/* ─── Hero ─── */}
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Single subtle glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/8 blur-[150px]" />

      <div className="container relative flex flex-col items-center gap-6 py-24 text-center">
        <motion.div initial="hidden" animate="visible" variants={fade} custom={0}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Zap className="h-3 w-3 text-primary" />
            AI-powered tennis platform
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={1}
          className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-8xl"
        >
          Your edge
          <br />
          <span className="text-primary">on court.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={2}
          className="max-w-lg text-base text-muted-foreground sm:text-lg"
        >
          Tournament planning, training management, and AI match insights — built for players, coaches, and their teams.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={3}
          className="mt-4 flex items-center gap-3"
        >
          <Button size="lg" className="h-12 gap-2 px-8 text-sm shadow-lg shadow-primary/20" asChild>
            <Link to="/signup">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="h-12 px-6 text-sm text-muted-foreground" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </motion.div>
      </div>
    </section>

    {/* ─── Divider line ─── */}
    <div className="container"><div className="h-px bg-border" /></div>

    {/* ─── Features — ultra clean ─── */}
    <section className="py-28 md:py-36">
      <div className="container">
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fade}
          custom={0}
          className="mb-16 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          What&apos;s inside
        </motion.p>

        <div className="mx-auto grid max-w-3xl gap-px rounded-2xl border border-border bg-border sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={fade}
              custom={i}
              className="flex flex-col gap-3 bg-card p-8 first:rounded-tl-2xl last:rounded-br-2xl sm:[&:nth-child(2)]:rounded-tr-2xl sm:[&:nth-child(3)]:rounded-bl-2xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ─── Roles strip ─── */}
    <section className="border-y border-border bg-secondary/40 py-20">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fade}
          custom={0}
          className="mx-auto flex max-w-3xl flex-col items-center gap-12 md:flex-row md:gap-16"
        >
          {[
            { role: "Player", color: "bg-emerald-500" },
            { role: "Coach", color: "bg-blue-500" },
            { role: "Fan", color: "bg-amber-500" },
          ].map((r) => (
            <div key={r.role} className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${r.color}`} />
              <span className="text-lg font-semibold text-foreground">{r.role}</span>
            </div>
          ))}
          <p className="text-sm text-muted-foreground md:ml-auto">
            One platform, three perspectives.
          </p>
        </motion.div>
      </div>
    </section>

    {/* ─── CTA ─── */}
    <section className="py-28 md:py-36">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fade}
          custom={0}
          className="mx-auto max-w-xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Start free. <span className="text-primary">No credit card.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Create your account in seconds and start planning your path to the top.
          </p>
          <div className="mt-8">
            <Button size="lg" className="h-12 gap-2 px-8 text-sm shadow-lg shadow-primary/20" asChild>
              <Link to="/signup">
                Create Account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>

    {/* ─── Footer ─── */}
    <footer className="border-t border-border py-10">
      <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-bold text-primary-foreground">T</span>
          </div>
          <span className="text-sm font-semibold text-foreground">TennisAI</span>
        </div>
        <nav className="flex gap-6 text-xs text-muted-foreground">
          <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
          <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
          <span className="cursor-default">Privacy</span>
          <span className="cursor-default">Terms</span>
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TennisAI</p>
      </div>
    </footer>
  </>
);

export default Index;
