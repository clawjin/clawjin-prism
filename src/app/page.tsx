import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Calculator,
  Check,
  ChevronDown,
  Database,
  Gauge,
  Layers,
  Plug,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Logo, LogoMark, Badge } from "@/components/ui";
import {
  AuroraBackground,
  FloatingChip,
  Parallax,
  Reveal,
  SpotlightCard,
} from "@/components/effects";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <Nav />
      <Hero />
      <TrustStrip />
      <Problem />
      <HowItWorks />
      <Metrics />
      <Features />
      <Pricing />
      <Faq />
      <CtaBanner />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass mt-4 flex h-16 items-center justify-between rounded-2xl px-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <Link href="/demo" className="transition hover:text-white">Live demo</Link>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-prism px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.35)] transition hover:opacity-90"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const stats = [
    { label: "Gross revenue", value: "$842k", delta: "+12.4%", up: true },
    { label: "Blended ROAS", value: "3.42x", delta: "+0.31", up: true },
    { label: "Blended CAC", value: "$31.40", delta: "-8.1%", up: true },
    { label: "Contribution margin", value: "$214k", delta: "+9.2%", up: true },
  ];

  return (
    <section className="relative">
      <div className="absolute inset-x-0 top-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_28%,transparent_72%)]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="live-dot absolute inline-flex h-full w-full rounded-full" />
              </span>
              <Sparkles className="h-3.5 w-3.5 text-white" />
              Enterprise data stack for e-commerce brands
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Know your <span className="text-gradient-animated">unit economics</span>{" "}
              in real time.
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Clawjin Prism unifies Shopify orders and paid media spend into one
              automated pipeline — blended CAC, ROAS, contribution margin, cohort
              retention and a daily executive briefing. No more spreadsheet
              heroics.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-prism px-7 py-3.5 text-base font-semibold text-black shadow-[0_16px_50px_-16px_rgba(255,255,255,0.4)] transition hover:opacity-90 sm:w-auto"
              >
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="glass inline-flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-white transition hover:border-white/30 hover:bg-white/10 sm:w-auto"
              >
                Explore live demo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-5 text-xs text-zinc-500">
              Free 14-day trial · No credit card required · Cancel anytime
            </p>
          </Reveal>
        </div>

        {/* Floating liquid dashboard */}
        <Reveal delay={200} className="relative mx-auto mt-20 max-w-4xl">
          <div className="absolute -inset-x-8 -top-10 -bottom-12 rounded-[40px] bg-gradient-to-tr from-white/15 via-white/5 to-white/10 blur-3xl" />

          <FloatingChip variant="bob" className="right-[-10px] top-[-22px] hidden md:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
              <TrendingUp className="h-4 w-4" />
            </span>
            <span className="text-left">
              <span className="block text-xs font-semibold text-white">Blended ROAS</span>
              <span className="block text-[11px] text-emerald-400">3.42x · +0.31</span>
            </span>
          </FloatingChip>

          <FloatingChip variant="sway" delay={1.2} className="left-[-26px] top-[34%] hidden lg:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
              <ArrowDownRight className="h-4 w-4" />
            </span>
            <span className="text-left">
              <span className="block text-xs font-semibold text-white">Blended CAC</span>
              <span className="block text-[11px] text-zinc-400">$31.40 · −8.1%</span>
            </span>
          </FloatingChip>

          <FloatingChip variant="bob" delay={2.1} className="bottom-[-18px] right-[16%] hidden md:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <span className="text-left">
              <span className="block text-xs font-semibold text-white">30-day retention</span>
              <span className="block text-[11px] text-zinc-400">34.2% · +3.1pts</span>
            </span>
          </FloatingChip>

          <Parallax strength={18}>
            <div className="float-slow relative">
              <div className="gradient-border relative rounded-3xl">
                <div className="glass-strong prism-glint relative overflow-hidden rounded-3xl">
                  <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                    </div>
                    <span className="text-xs text-zinc-500">
                      clawjin-prism — unit economics
                    </span>
                    <Badge tone="violet">Last 60 days</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                    {stats.map((s) => (
                      <div
                        key={s.label}
                        className="glass-subtle rounded-xl p-3.5 transition-colors hover:border-white/20"
                      >
                        <p className="truncate text-[11px] text-zinc-500">{s.label}</p>
                        <p className="mt-1.5 text-lg font-semibold tabular-nums text-white sm:text-xl">
                          {s.value}
                        </p>
                        <p
                          className={`text-[11px] font-medium ${
                            s.up ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {s.delta}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 pb-6">
                    <div className="glass-subtle rounded-xl p-3.5">
                      <div className="mb-2 flex items-center gap-4 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-white" /> Revenue
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-zinc-500" /> Ad spend
                        </span>
                      </div>
                      <svg viewBox="0 0 600 180" className="h-40 w-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="heroRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,150 C40,140 60,120 90,125 C120,130 140,95 180,100 C220,105 240,70 280,75 C320,80 340,55 380,60 C420,65 440,35 480,42 C520,48 560,25 600,30 L600,180 L0,180 Z"
                          fill="url(#heroRev)"
                        />
                        <path
                          d="M0,150 C40,140 60,120 90,125 C120,130 140,95 180,100 C220,105 240,70 280,75 C320,80 340,55 380,60 C420,65 440,35 480,42 C520,48 560,25 600,30"
                          fill="none" stroke="#fafafa" strokeWidth="2.5"
                        />
                        <path
                          d="M0,175 C60,170 120,160 180,165 C240,170 300,150 360,155 C420,160 480,140 540,145 C570,147 590,140 600,138"
                          fill="none" stroke="#8b8b92" strokeWidth="2.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Parallax>
        </Reveal>
      </div>
    </section>
  );
}

function TrustStrip() {
  const brands = ["Shopify", "Meta Ads", "Google Ads", "TikTok Ads", "Klaviyo", "Stripe"];
  return (
    <section className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl overflow-hidden px-4 py-9 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
          Connects to your existing stack
        </p>
        <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="marquee-track">
            {[...brands, ...brands].map((b, i) => (
              <span
                key={`${b}-${i}`}
                className="mx-8 shrink-0 text-lg font-semibold text-zinc-600"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-zinc-400">{subtitle}</p>}
    </Reveal>
  );
}

function Problem() {
  const points = [
    {
      title: "Data locked in silos",
      body: "Shopify orders, Meta spend, Google ads and retention metrics live in disconnected tools. No single source of truth.",
    },
    {
      title: "15+ hours a week in spreadsheets",
      body: "Founders and operators rebuild blended CAC and margin calculations by hand — and they're always out of date.",
    },
    {
      title: "Decisions made blind",
      body: "Without a daily, verified KPI scorecard, leadership scales spend on gut feel instead of contribution margin.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="The problem"
        title={
          <>
            Modern brands are drowning in <span className="text-gradient">fragmented data</span>
          </>
        }
      />
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {points.map((p, i) => (
          <Reveal key={p.title} delay={i * 90}>
            <SpotlightCard className="glass h-full rounded-3xl p-7">
              <div className="relative z-10">
                <span className="text-3xl font-semibold text-white/20">0{i + 1}</span>
                <p className="mt-4 text-lg font-semibold text-white">{p.title}</p>
                <p className="mt-2 leading-relaxed text-zinc-400">{p.body}</p>
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Database,
      title: "Continuous ingestion",
      body: "High-throughput extraction of Shopify orders, COGS, fulfillment and multi-channel ad spend into your cloud warehouse.",
    },
    {
      icon: Workflow,
      title: "Deterministic modeling",
      body: "Automated dbt transformations build marts for Blended CAC, Contribution Margin 1 & 2, and RFM loyalty segments.",
    },
    {
      icon: Calculator,
      title: "Real-time analysis",
      body: "A monthly cohort repurchase matrix and live unit-economics dashboard replace every spreadsheet you used to maintain.",
    },
    {
      icon: BellRing,
      title: "Executive alerting",
      body: "An automated 8:00 AM briefing delivers a verified KPI scorecard straight to leadership every morning.",
    },
  ];
  return (
    <section id="how" className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From raw data to daily decisions, <span className="text-gradient">fully automated</span>
            </>
          }
        />
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} delay={i * 90}>
                <SpotlightCard className="glass relative h-full rounded-3xl p-7">
                  <div className="absolute -top-3 left-7 rounded-full bg-prism px-2.5 py-0.5 text-xs font-bold text-black shadow-lg">
                    {i + 1}
                  </div>
                  <div className="relative z-10 mt-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-base font-semibold text-white">{s.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Metrics() {
  const metrics = [
    { icon: TrendingUp, name: "Blended CAC", formula: "Total ad spend ÷ completed orders", desc: "True acquisition cost across every blended channel." },
    { icon: Gauge, name: "Blended ROAS", formula: "Gross order revenue ÷ total ad spend", desc: "Advertising return on aggregate revenue." },
    { icon: Layers, name: "Contribution margin", formula: "Gross profit (rev − COGS − shipping) − ad spend", desc: "Net bottom-line cash after fulfillment and ads." },
    { icon: Repeat, name: "Cohort retention", formula: "Active cohort ÷ initial cohort × 100", desc: "30/60/90-day repurchase curves by monthly cohort." },
  ];
  return (
    <section id="product" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="The metrics"
        title={
          <>
            The four numbers that run your <span className="text-gradient">P&amp;L</span>
          </>
        }
      />
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <Reveal key={m.name} delay={i * 90}>
              <SpotlightCard className="glass rounded-3xl p-7">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xl font-semibold text-white">{m.name}</p>
                </div>
                <p className="relative z-10 mt-5 rounded-xl bg-black/40 px-4 py-3 font-mono text-sm text-white ring-1 ring-inset ring-white/10">
                  {m.formula}
                </p>
                <p className="relative z-10 mt-3 text-sm leading-relaxed text-zinc-400">
                  {m.desc}
                </p>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: Plug, title: "Zero-maintenance integrations", desc: "Connect Shopify, Meta, Google, TikTok and Klaviyo in one click." },
    { icon: Database, title: "Cloud data warehouse", desc: "Isolated raw schemas in enterprise PostgreSQL, ready for analysis." },
    { icon: Workflow, title: "dbt transformation core", desc: "Versioned, tested marts for unit economics and loyalty." },
    { icon: Users, title: "RFM VIP segmentation", desc: "Automatically identify your highest-value customers." },
    { icon: BellRing, title: "Daily Slack briefing", desc: "A verified KPI scorecard delivered at 8:00 AM sharp." },
    { icon: ShieldCheck, title: "Proprietary & supported", desc: "Designed, deployed and maintained by Clawjin Engineering." },
    { icon: RefreshCw, title: "Always fresh", desc: "Continuous ingestion keeps every number current, not monthly." },
    { icon: Zap, title: "Built to scale", desc: "Purpose-built for brands scaling from $1M to $50M+ ARR." },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Capabilities"
          title={
            <>
              Everything your finance team <span className="text-gradient">wishes they had</span>
            </>
          }
        />
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={(i % 4) * 70}>
                <SpotlightCard className="glass rounded-2xl p-5">
                  <div className="relative z-10">
                    <Icon className="h-5 w-5 text-white" />
                    <p className="mt-3 text-sm font-semibold text-white">{f.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Trial",
      price: "$0",
      period: "14 days",
      desc: "Prove the value with your own data.",
      features: ["Full pipeline access", "Live unit-economics dashboard", "Cohort retention matrix", "Daily executive briefing"],
      cta: "Start free trial",
      highlight: false,
    },
    {
      name: "Pro",
      price: "$499",
      period: "per month",
      desc: "For growing brands ready to scale on data.",
      features: ["Everything in Trial", "Unlimited channel connections", "RFM VIP segmentation", "Slack briefing dispatch", "Priority support"],
      cta: "Start free trial",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "annual",
      desc: "For $10M+ ARR brands with custom needs.",
      features: ["Everything in Pro", "Dedicated warehouse", "Custom dbt marts", "SSO & audit logs", "99.9% uptime SLA"],
      cta: "Talk to sales",
      highlight: false,
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Pricing"
        title={
          <>
            Pays for itself with <span className="text-gradient">one saved month</span>
          </>
        }
        subtitle="Start free. Upgrade when the numbers prove it."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * 90}>
            <div
              className={
                t.highlight
                  ? "gradient-border relative flex h-full flex-col rounded-3xl"
                  : "relative flex h-full flex-col rounded-3xl"
              }
            >
              <div
                className={`flex h-full flex-col rounded-3xl p-7 ${
                  t.highlight ? "glass-strong glow" : "glass"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-prism px-3 py-1 text-xs font-bold text-black shadow-lg">
                    Most popular
                  </span>
                )}
                <p className="text-sm font-semibold text-zinc-400">{t.name}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight text-white">
                    {t.price}
                  </span>
                  <span className="text-sm text-zinc-500">{t.period}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{t.desc}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    t.highlight
                      ? "btn-shine bg-prism text-black hover:opacity-90"
                      : "border border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
                  }`}
                >
                  {t.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "How long does setup take?", a: "Most brands connect their sources and see a live dashboard in under 10 minutes. We provision your workspace instantly." },
    { q: "Do I need a data team?", a: "No. The engine is fully managed — ingestion, modeling and alerting run automatically. You get the output, not the plumbing." },
    { q: "Which platforms do you support?", a: "Shopify orders, Meta, Google and TikTok ads, Klaviyo, Stripe and Amazon today — with more connectors shipped regularly." },
    { q: "Is my data secure?", a: "Yes. Each workspace runs in an isolated schema with encrypted credentials and role-based access." },
    { q: "Can I cancel anytime?", a: "Absolutely. There are no long-term contracts on Trial or Pro. Enterprise terms are negotiated separately." },
  ];
  return (
    <section id="faq" className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              Frequently asked <span className="text-gradient">questions</span>
            </>
          }
        />
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <details className="glass group rounded-2xl px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <div className="gradient-border relative overflow-hidden rounded-[32px]">
          <div className="prism-glint relative overflow-hidden rounded-[32px] p-10 text-center sm:p-16">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/[0.03] to-white/10" />
            <div className="absolute inset-0 bg-dots opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
            <div className="relative">
              <LogoMark className="mx-auto h-11 w-11 float-slow" />
              <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Stop guessing. Start knowing your numbers every morning.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-zinc-400">
                Join the e-commerce brands automating their unit economics with
                Clawjin Prism.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-prism px-7 py-3.5 text-base font-semibold text-black shadow-[0_16px_50px_-16px_rgba(255,255,255,0.4)] transition hover:opacity-90 sm:w-auto"
                >
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  View live demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
        <Logo className="text-base" />
        <p className="text-sm text-zinc-500">
          © {new Date().getFullYear()} Clawjin Operations & Engineering. All rights reserved.
        </p>
        <div className="flex items-center gap-5 text-sm text-zinc-400">
          <a href="#product" className="transition hover:text-white">Product</a>
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </div>
      </div>
    </footer>
  );
}
