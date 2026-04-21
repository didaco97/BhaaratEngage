import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Files,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  Route,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "@/lib/api-client";
import { formatLabel } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";
import PageStateCard from "@/components/PageStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const capabilityCards = [
  {
    icon: Users,
    title: "Workspace and access",
    description:
      "Separate client and internal operations surfaces with auditable launches, pauses, exports, and transcript access.",
  },
  {
    icon: PhoneCall,
    title: "Scripted-first collection",
    description:
      "Voice agents disclose the caller, collect fields in order, answer brief questions, then return to the active step.",
  },
  {
    icon: Route,
    title: "Outcome-based journeys",
    description:
      "Voice leads the flow, while SMS and WhatsApp recover unanswered or partial outcomes without becoming the primary channel.",
  },
  {
    icon: Shield,
    title: "Sensitive by default",
    description:
      "Sensitive fields are flagged in the builder, encrypted at rest, masked in CSV, and redacted in operational transcript views.",
  },
];

const methodologyCards = [
  {
    title: "Clear information hierarchy",
    detail: "Every screen prioritizes the next decision: launch, monitor, review, or export.",
  },
  {
    title: "Progressive disclosure",
    detail: "Complex controls stay grouped into steps so campaign managers do not face the whole system at once.",
  },
  {
    title: "Status visibility",
    detail: "Quiet hours, provider failures, transfer queues, and export state stay visible without digging through tables.",
  },
  {
    title: "Error prevention",
    detail: "Sensitive data markers, policy checks, confirmation review, and launch review reduce operator mistakes.",
  },
];

const launchCards = [
  {
    title: "Client workspace",
    description: "Campaign managers create templates, configure fields, upload CSVs, and launch journeys with confidence.",
  },
  {
    title: "Operations desk",
    description: "Operators and reviewers monitor attempts, inspect transcripts, export results, and manage transfer queues.",
  },
];

export default function Landing() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.getDashboardSnapshot,
  });
  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => api.listCampaigns(),
  });
  const dashboard = dashboardQuery.data;
  const campaigns = campaignsQuery.data;
  const pageError = dashboardQuery.error ?? campaignsQuery.error;

  const primaryCampaign = campaigns?.[0];
  const overview = dashboard?.overview;

  if (dashboardQuery.isPending && !dashboard) {
    return (
      <div className="min-h-screen px-4 py-12 sm:px-6">
        <PageStateCard
          title="Loading product overview"
          description="Fetching the latest workspace metrics and campaign preview for the landing surface."
        />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen px-4 py-12 sm:px-6">
        <PageStateCard
          title="Product overview unavailable"
          description={pageError instanceof Error ? pageError.message : "Landing data could not be loaded."}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden text-landing-fg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/[0.18] blur-[160px]" />
        <div className="absolute right-[-8%] top-[12%] h-[24rem] w-[24rem] rounded-full bg-accent/[0.14] blur-[160px]" />
        <div className="absolute bottom-[-16%] left-[18%] h-[26rem] w-[26rem] rounded-full bg-chart-3/10 blur-[180px]" />
      </div>

      <nav className="fixed inset-x-0 top-0 z-50 px-4 py-4 sm:px-6">
        <div className="panel-strong mx-auto flex max-w-7xl items-center justify-between rounded-[28px] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-foreground text-background">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">BharatVaani Engage</p>
              <p className="text-sm text-muted-foreground">Voice-first campaign operating system</p>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#capabilities" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Capabilities
            </a>
            <a href="#surfaces" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Surfaces
            </a>
            <a href="#methodology" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Methodology
            </a>
          </div>

          <Link to="/dashboard">
            <Button className="gap-2">
              Open product
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative px-4 pb-24 pt-36 sm:px-6 sm:pt-40">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} custom={0}>
              <Badge variant="secondary" className="gap-2 rounded-full px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                PRD-led redesign for outbound structured data collection
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="landing-display-title mt-8 max-w-3xl font-semibold text-foreground"
            >
              Clean, calm product design for voice journeys, data capture, and operational control.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground"
            >
              BharatVaani Engage now reads like a focused operating system: campaign setup, journey orchestration,
              verification, exports, and governance all arranged around the actual v1 workflow in your PRD.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Explore workspace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#methodology">
                <Button variant="outline" size="lg">
                  See design approach
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { value: overview ? `${overview.activeCampaigns}` : "--", label: "Live campaigns" },
                { value: overview ? `${overview.avgAnswerRate}%` : "--", label: "Answer rate" },
                { value: overview ? `${overview.avgConfirmationRate}%` : "--", label: "Confirmed data" },
                { value: overview ? `${overview.maskedExportsToday}` : "--", label: "Masked exports today" },
              ].map((item) => (
                <div key={item.label} className="panel-subtle rounded-[24px] p-4">
                  <p className="metric-value text-3xl text-foreground">{item.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="panel-strong noise rounded-[36px] p-4 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.5)] sm:p-5">
              <div className="rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,255,0.92))] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="section-eyebrow">Launch review</p>
                    <h2 className="mt-3 text-2xl font-semibold text-foreground">
                      {primaryCampaign?.name ?? "Loading campaign preview"}
                    </h2>
                  </div>
                  <Badge>{primaryCampaign?.status ?? "pending"}</Badge>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="inset-surface rounded-[24px] p-4">
                    <p className="section-eyebrow">Builder summary</p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Template</span>
                        <span className="font-medium text-foreground">{primaryCampaign?.template ?? "--"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Language</span>
                        <span className="font-medium text-foreground">
                          {primaryCampaign ? formatLabel(primaryCampaign.language) : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Field steps</span>
                        <span className="font-medium text-foreground">{primaryCampaign?.fields.length ?? "--"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Sensitive markers</span>
                        <span className="font-medium text-foreground">{primaryCampaign?.sensitiveFieldCount ?? "--"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="inset-surface rounded-[24px] p-4">
                    <p className="section-eyebrow">Journey sequence</p>
                    <div className="mt-3 space-y-2">
                      {(primaryCampaign?.sequence ?? ["Preparing journey preview"]).map((step) => (
                        <div key={step} className="flex items-center gap-3 rounded-[18px] bg-white/70 px-3 py-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                            {step.includes("Voice") ? (
                              <PhoneCall className="h-4 w-4" />
                            ) : step.includes("SMS") ? (
                              <MessageSquare className="h-4 w-4" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{step}</p>
                            <p className="text-xs text-muted-foreground">Outcome branch stays linked to the same campaign.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="inset-surface rounded-[24px] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="section-eyebrow">Field collection</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Prompts are linear, verification stays explicit, and each sensitive value is tagged before launch.
                        </p>
                      </div>
                      <Shield className="h-5 w-5 text-primary" />
                    </div>

                    <div className="mt-4 space-y-3">
                      {(primaryCampaign?.fields.slice(0, 3) ?? []).map((field, index) => (
                        <div key={field.field_key} className="flex gap-3 rounded-[18px] bg-white/70 px-4 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-foreground text-background">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{field.label}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{field.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="inset-surface rounded-[24px] p-4">
                    <p className="section-eyebrow">Ops snapshot</p>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: "Answer rate", value: primaryCampaign ? `${primaryCampaign.answerRate}%` : "--" },
                        { label: "Completion", value: primaryCampaign ? `${primaryCampaign.completionRate}%` : "--" },
                        { label: "Confirmed", value: primaryCampaign ? `${primaryCampaign.confirmationRate}%` : "--" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-[18px] bg-white/70 px-4 py-3">
                          <p className="text-sm text-muted-foreground">{item.label}</p>
                          <p className="metric-value mt-2 text-3xl text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="capabilities" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="section-eyebrow">What ships in v1</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              Each product surface now maps directly to the PRD, not just to generic dashboard patterns.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {capabilityCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-120px" }}
                variants={fadeUp}
                custom={index}
                className="panel-surface rounded-[30px] p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="surfaces" className="px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="panel-strong rounded-[34px] p-7">
            <p className="section-eyebrow">Product surfaces</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              One app, two operating modes.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted-foreground">
              The redesign separates the jobs to be done. Campaign managers author journeys and uploads. Operations teams
              monitor attempts, transcripts, exports, and audits without losing the client context.
            </p>

            <div className="mt-8 space-y-3">
              {launchCards.map((card) => (
                <div key={card.title} className="inset-surface rounded-[24px] p-5">
                  <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="panel-surface rounded-[32px] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-eyebrow">Core workflow</p>
                  <h3 className="mt-3 text-2xl font-semibold text-foreground">Create, launch, verify, export</h3>
                </div>
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  "Template-driven builder",
                  "Linear schema configuration",
                  "CSV validation and dedupe",
                  "Outcome-based orchestration",
                  "Redacted transcripts",
                  "Masked CSV exports",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-[20px] bg-white/70 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: PhoneCall, label: "Voice", text: "Primary collection channel" },
                { icon: MessageSquare, label: "SMS", text: "Missed call recovery and reminders" },
                { icon: MessageCircle, label: "WhatsApp", text: "Summary and partial re-engagement" },
              ].map((item) => (
                <div key={item.label} className="panel-surface rounded-[28px] p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h4 className="mt-5 text-lg font-semibold text-foreground">{item.label}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="methodology" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="section-eyebrow">Design methodology</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              The UI is rebuilt around product architecture and software design principles.
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              The interface follows the PRD structure, uses progressive disclosure in the builder, keeps system status
              visible in operations, and treats data sensitivity as a first-class visual state instead of a small label.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {methodologyCards.map((card) => (
              <div key={card.title} className="panel-surface rounded-[30px] p-6">
                <p className="section-eyebrow">Principle</p>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 pt-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="panel-strong rounded-[36px] p-8 text-center sm:p-10">
            <p className="section-eyebrow">Ready to explore the redesign</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              Campaign authoring, live operations, and reporting now feel like one product.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-muted-foreground">
              Open the workspace to review the redesigned dashboard, campaign builder, journeys, records, and settings.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Enter workspace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#capabilities">
                <Button variant="outline" size="lg">
                  Review capabilities
                </Button>
              </a>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {[
                { icon: Files, label: "Masked exports" },
                { icon: Shield, label: "Sensitive field review" },
                { icon: Route, label: "Sequenced journeys" },
              ].map((item) => (
                <div key={item.label} className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm text-foreground">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
