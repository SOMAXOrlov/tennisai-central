import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, type Variants } from "framer-motion";
import {
  Trophy,
  Calendar,
  Brain,
  Users,
  Eye,
  Shield,
  Zap,
  TrendingUp,
  Target,
  BarChart3,
  Globe,
  Dumbbell,
} from "lucide-react";

// ──────────────────────────────────────────────
// Animation helpers
// ──────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// ──────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────

const roles = [
  {
    icon: <Target className="h-6 w-6" />,
    title: "Player",
    description:
      "Track your stats, plan tournaments, manage equipment, and get AI-powered match insights — all in one place.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Coach",
    description:
      "Manage connected players, build teams, plan trainings, and monitor tournament performance across your roster.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Observer",
    description:
      "Follow a player's journey with read-only access to their calendar, tournaments, stats, and financial overview.",
    badge: "Read-only",
    color: "bg-muted text-muted-foreground",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Admin",
    description:
      "Manage users, moderate tournament records, oversee platform activity, and maintain system integrity.",
    color: "bg-muted text-muted-foreground",
  },
];

const features = [
  {
    icon: <Trophy className="h-5 w-5" />,
    title: "Tournament Explorer",
    description:
      "Browse tournaments worldwide with rich filters — surface, altitude, weather, ball brand, and more. Plan your season with confidence.",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Unified Calendar",
    description:
      "One calendar for everything: trainings, tournaments, matches, travel, and recovery. Role-based visibility keeps everyone in sync.",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "AI Match Insights",
    description:
      "Get AI-powered analysis based on tournament conditions, your equipment, playing style, and recent training load.",
  },
  {
    icon: <Dumbbell className="h-5 w-5" />,
    title: "Training Planning",
    description:
      "Coaches create structured training sessions for connected players and teams. Players see everything on their calendar.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Stats & Finance",
    description:
      "Track performance statistics alongside training, travel, tournament, and equipment costs in one clear dashboard.",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Connection System",
    description:
      "Players control who sees their data. Coaches and observers send requests — nothing is shared until approved.",
  },
];

const stats = [
  { value: "50+", label: "Tournament filters" },
  { value: "4", label: "User roles" },
  { value: "AI", label: "Powered insights" },
  { value: "100%", label: "Privacy-first" },
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const Index = () => {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-[300px] w-[400px] rounded-full bg-primary/5 blur-3xl" />

        <div className="container relative flex flex-col items-center gap-8 pb-20 pt-24 text-center md:pt-32 lg:pt-40">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground"
          >
            <Zap className="h-3.5 w-3.5 text-primary" />
            The intelligent tennis platform
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            Elevate Your Tennis
            <span className="text-primary"> Game</span> with AI
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            TennisAI connects players, coaches, and supporters with powerful tools for tournament planning, training management, and AI-driven match preparation.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link to="/signup">Start Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-8 grid w-full max-w-lg grid-cols-2 gap-6 sm:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Roles ─── */}
      <section className="border-t border-border bg-secondary/30 py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-14 max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for Every Role
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Whether you play, coach, or support — TennisAI gives you the right tools with the right level of access.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role, i) => (
              <motion.div
                key={role.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <div className={`mb-4 inline-flex rounded-lg p-2.5 ${role.color}`}>
                  {role.icon}
                </div>
                <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                  {role.title}
                  {role.badge && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {role.badge}
                    </span>
                  )}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{role.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-14 max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From tournament scouting to AI-powered preparation — TennisAI covers every aspect of competitive tennis.
            </p>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-border bg-secondary/30 py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto max-w-2xl text-center"
          >
            <TrendingUp className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ready to Level Up?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              Join TennisAI today. Create your account in seconds and start planning your path to the top.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link to="/signup">Create Free Account</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <span className="text-xs font-bold text-primary-foreground">T</span>
              </div>
              <span className="text-sm font-semibold text-foreground">TennisAI</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
              <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
              <span className="cursor-default">Privacy</span>
              <span className="cursor-default">Terms</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} TennisAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Index;
