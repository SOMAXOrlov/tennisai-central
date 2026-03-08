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
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// ──────────────────────────────────────────────
// Animation helpers
// ──────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
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
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Coach",
    description:
      "Manage connected players, build teams, plan trainings, and monitor tournament performance across your roster.",
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Fan",
    description:
      "Follow a player's journey with read-only access to their calendar, tournaments, stats, and financial overview.",
    badge: "Read-only",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const features = [
  {
    icon: <Trophy className="h-5 w-5" />,
    title: "Tournament Explorer",
    description:
      "Browse tournaments worldwide with rich filters — surface, altitude, weather, ball brand, and more.",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Unified Calendar",
    description:
      "One calendar for trainings, tournaments, matches, travel, and recovery. Role-based visibility keeps everyone in sync.",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "AI Match Insights",
    description:
      "AI-powered analysis based on tournament conditions, your equipment, playing style, and training load.",
  },
  {
    icon: <Dumbbell className="h-5 w-5" />,
    title: "Training Planning",
    description:
      "Coaches create structured sessions for connected players and teams. Players see everything on their calendar.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Stats & Finance",
    description:
      "Track performance statistics alongside training, travel, tournament, and equipment costs in one dashboard.",
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
  { value: "3", label: "User roles" },
  { value: "AI", label: "Powered insights" },
  { value: "100%", label: "Privacy-first" },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "For individual players getting started",
    features: [
      "Personal dashboard & stats",
      "Up to 2 coach connections",
      "Calendar & tournament planning",
      "Basic equipment tracking",
      "Community support",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    description: "For serious players and coaches",
    features: [
      "Everything in Starter",
      "Unlimited connections",
      "AI match insights",
      "Advanced stats & analytics",
      "Finance tracking",
      "Team management (coaches)",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    ctaVariant: "default" as const,
    highlight: true,
  },
  {
    name: "Academy",
    price: "$39",
    period: "/mo",
    description: "For coaching academies and clubs",
    features: [
      "Everything in Pro",
      "Unlimited teams & players",
      "Bulk tournament management",
      "Custom AI training models",
      "Observer accounts included",
      "Admin dashboard",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    highlight: false,
  },
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const Index = () => {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Layered gradient background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/4 h-[500px] w-[700px] rounded-full bg-primary/6 blur-[120px]" />
          <div className="absolute -bottom-32 right-1/4 h-[400px] w-[600px] rounded-full bg-primary/4 blur-[100px]" />
          <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-primary/8 blur-[80px]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black_40%,transparent_100%)]" />

        <div className="container relative flex flex-col items-center gap-8 pb-24 pt-28 text-center md:pt-36 lg:pb-32 lg:pt-48">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            The intelligent tennis platform
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Elevate Your Tennis{" "}
            <span className="relative inline-block text-primary">
              Game
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 8C40 2 100 2 198 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/40" />
              </svg>
            </span>{" "}
            with AI
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
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
            <Button size="lg" className="h-13 gap-2 px-8 text-base shadow-lg shadow-primary/20" asChild>
              <Link to="/signup">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-13 px-8 text-base" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-12 flex w-full max-w-2xl items-center justify-center divide-x divide-border rounded-2xl border border-border bg-card/60 px-2 py-5 shadow-sm backdrop-blur-sm"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex-1 text-center px-4">
                <div className="text-2xl font-extrabold text-foreground md:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Roles ─── */}
      <section className="relative border-t border-border py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-secondary/40" />
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Roles
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Built for Every Role
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Whether you play, coach, or support — TennisAI gives you the right tools with the right level of access.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {roles.map((role, i) => (
              <motion.div
                key={role.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={scaleIn}
                custom={i}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`mb-5 inline-flex rounded-xl p-3 ${role.iconBg}`}>
                    {role.icon}
                  </div>
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                    {role.title}
                    {role.badge && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {role.badge}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{role.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-24 md:py-32">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Features
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From tournament scouting to AI-powered preparation — TennisAI covers every aspect of competitive tennis.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={scaleIn}
                custom={i}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="relative border-t border-border py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-secondary/40" />
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Pricing
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free and upgrade as you grow. No hidden fees, no surprises.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={scaleIn}
                custom={i}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary bg-card shadow-xl shadow-primary/10 lg:-my-2 lg:py-10"
                    : "border-border bg-card hover:border-primary/20 hover:shadow-lg"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-base text-muted-foreground">{plan.period}</span>}
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.ctaVariant}
                  className={`w-full ${plan.highlight ? "shadow-lg shadow-primary/20" : ""}`}
                  asChild
                >
                  <Link to="/signup">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 md:py-32">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 text-center md:p-16"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" />
            <div className="relative">
              <TrendingUp className="mx-auto mb-5 h-12 w-12 text-primary" />
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ready to Level Up?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
                Join TennisAI today. Create your account in seconds and start planning your path to the top.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="h-13 gap-2 px-8 text-base shadow-lg shadow-primary/20" asChild>
                  <Link to="/signup">
                    Create Free Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-13 px-8 text-base" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
                <span className="text-sm font-bold text-primary-foreground">T</span>
              </div>
              <span className="text-base font-bold text-foreground">TennisAI</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <Link to="/signup" className="transition-colors hover:text-foreground">Get Started</Link>
              <Link to="/login" className="transition-colors hover:text-foreground">Sign In</Link>
              <span className="cursor-default">Privacy</span>
              <span className="cursor-default">Terms</span>
              <span className="cursor-default">Support</span>
            </nav>
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
