import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  PhoneCall, MessageSquare, MessageCircle, Shield, BarChart3,
  Users, ArrowRight, Flame, Globe, CheckCircle, Zap, Lock, ChevronRight
} from 'lucide-react';
import heroVisual from '@/assets/hero-visual.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-fg overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-landing-surface bg-landing-bg/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Flame className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg tracking-tight">BharatVaani</span>
            <span className="text-[10px] font-mono text-landing-muted tracking-[0.2em] uppercase mt-1">Engage</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-landing-muted">
            <a href="#features" className="hover:text-landing-fg transition-colors">Features</a>
            <a href="#channels" className="hover:text-landing-fg transition-colors">Channels</a>
            <a href="#security" className="hover:text-landing-fg transition-colors">Security</a>
            <a href="#metrics" className="hover:text-landing-fg transition-colors">Results</a>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open Platform <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp} custom={0} className="flex items-center gap-2 mb-8">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              </span>
              <span className="text-xs font-mono text-landing-muted tracking-wider uppercase">India-first voice platform</span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
              Every voice,{' '}
              <span className="italic text-primary">captured.</span>
              <br />
              Every field,{' '}
              <span className="italic text-accent">verified.</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mt-8 max-w-xl text-lg text-landing-muted leading-relaxed font-sans">
              Run large-scale outbound data-collection campaigns across voice, SMS, and WhatsApp — with scripted AI agents that collect, verify, and confirm structured information in any Indian language.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Launch a Campaign
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-xl border border-landing-surface px-6 py-3.5 text-sm font-medium text-landing-fg hover:bg-landing-surface transition-all"
              >
                See How It Works
              </a>
            </motion.div>

            {/* Proof bar */}
            <motion.div variants={fadeUp} custom={4} className="mt-16 flex flex-wrap gap-8 text-sm">
              {[
                { val: '50K+', label: 'Calls / day' },
                { val: '8', label: 'Languages' },
                { val: '82%', label: 'Answer rate' },
                { val: '< 3min', label: 'Avg. handling' },
              ].map(s => (
                <div key={s.label}>
                  <p className="font-display text-2xl text-landing-fg">{s.val}</p>
                  <p className="text-xs text-landing-muted font-mono tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 relative rounded-2xl overflow-hidden border border-landing-surface"
          >
            <img src={heroVisual} alt="BharatVaani voice engagement visualization" width={1920} height={1080} className="w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-landing-bg via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['🇮🇳', '📞', '💬'].map((e, i) => (
                    <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-landing-surface border border-landing-bg text-sm">{e}</span>
                  ))}
                </div>
                <span className="text-xs text-landing-muted font-mono">Voice · SMS · WhatsApp</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-landing-surface">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="text-xs font-mono text-primary tracking-[0.25em] uppercase">Platform Capabilities</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-4xl md:text-5xl mt-4 tracking-tight">
              Built for <span className="italic">scale.</span><br />Designed for <span className="italic text-accent">India.</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[
              { icon: PhoneCall, title: 'Scripted Voice Agent', desc: 'AI follows your collection script, answers brief questions, returns to the flow, reads back and confirms every field.', accent: 'primary' },
              { icon: Users, title: 'Campaign Builder', desc: 'Define fields, set prompts, mark sensitive data, configure calling windows — launch in minutes from a template.', accent: 'accent' },
              { icon: Globe, title: '8 Indian Languages', desc: 'Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, English — with natural multilingual conversation.', accent: 'primary' },
              { icon: Zap, title: 'Journey Orchestration', desc: 'Sequenced voice → SMS → WhatsApp flows with retry logic, pacing controls, and outcome-based branching.', accent: 'accent' },
              { icon: BarChart3, title: 'Live Dashboards', desc: 'Answer rates, completion rates, field-level drop-off, provider uptime — all in real-time.', accent: 'primary' },
              { icon: Lock, title: 'Sensitive Data Handling', desc: 'AES-256 encryption at rest, masked CSV exports, redacted transcripts, and full audit trails.', accent: 'accent' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i}
                className="group rounded-2xl border border-landing-surface bg-landing-surface/50 p-6 hover:bg-landing-surface-hover transition-all duration-300"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.accent === 'primary' ? 'bg-primary/10' : 'bg-accent/10'}`}>
                  <f.icon className={`h-5 w-5 ${f.accent === 'primary' ? 'text-primary' : 'text-accent'}`} />
                </div>
                <h3 className="mt-5 font-display text-xl">{f.title}</h3>
                <p className="mt-3 text-sm text-landing-muted leading-relaxed font-sans">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Channels */}
      <section id="channels" className="py-24 border-t border-landing-surface">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center">
            <motion.p variants={fadeUp} custom={0} className="text-xs font-mono text-primary tracking-[0.25em] uppercase">Multi-Channel</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-4xl md:text-5xl mt-4 tracking-tight">
              One campaign. <span className="italic">Three channels.</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { icon: PhoneCall, name: 'Voice', tag: 'Primary', desc: 'Scripted outbound calls with real-time data collection, verification, and human transfer capability.', status: 'Live' },
              { icon: MessageSquare, name: 'SMS', tag: 'Follow-up', desc: 'Missed call recovery, reminder nudges, callback prompts for unanswered contacts.', status: 'Live' },
              { icon: MessageCircle, name: 'WhatsApp', tag: 'Follow-up', desc: 'Summary messages, incomplete re-engagement, and rich template-based follow-ups.', status: 'Live' },
            ].map((ch, i) => (
              <motion.div
                key={ch.name}
                variants={fadeUp}
                custom={i}
                className="relative rounded-2xl border border-landing-surface bg-landing-surface/30 p-8 text-center group hover:border-primary/30 transition-all duration-500"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <ch.icon className="h-7 w-7 text-primary" />
                </div>
                <p className="mt-1 text-[10px] font-mono text-landing-muted tracking-widest uppercase">{ch.tag}</p>
                <h3 className="mt-4 font-display text-2xl">{ch.name}</h3>
                <p className="mt-3 text-sm text-landing-muted leading-relaxed font-sans">{ch.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[10px] font-mono text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> {ch.status}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Journey flow */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-12 flex items-center justify-center gap-3 text-sm text-landing-muted"
          >
            <span className="rounded-lg bg-landing-surface px-3 py-1.5 font-mono text-xs">Voice Call</span>
            <ChevronRight className="h-4 w-4" />
            <span className="rounded-lg bg-landing-surface px-3 py-1.5 font-mono text-xs">If unanswered → SMS</span>
            <ChevronRight className="h-4 w-4" />
            <span className="rounded-lg bg-landing-surface px-3 py-1.5 font-mono text-xs">If partial → WhatsApp</span>
          </motion.div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 border-t border-landing-surface">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.p variants={fadeUp} custom={0} className="text-xs font-mono text-primary tracking-[0.25em] uppercase">Security & Compliance</motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="font-display text-4xl md:text-5xl mt-4 tracking-tight">
                Sensitive data,{' '}<span className="italic">handled right.</span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="mt-6 text-landing-muted leading-relaxed font-sans">
                Every sensitive field is encrypted at rest, masked in exports, and redacted in transcripts. Full audit trails for every action. Multi-tenant isolation with zero cross-workspace data leakage.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="space-y-3"
            >
              {[
                { icon: Shield, label: 'AES-256 encryption at rest', detail: 'All sensitive field values encrypted before storage' },
                { icon: Lock, label: 'Masked CSV exports', detail: 'PAN, Aadhaar, and sensitive fields auto-masked' },
                { icon: Users, label: 'Tenant isolation', detail: 'Strict workspace boundaries with zero cross-tenant access' },
                { icon: CheckCircle, label: 'Audit logging', detail: 'Every launch, pause, export, and transcript access logged' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  variants={fadeUp}
                  custom={i}
                  className="flex items-start gap-4 rounded-xl border border-landing-surface bg-landing-surface/30 p-5 hover:border-primary/20 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-landing-muted mt-1">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section id="metrics" className="py-24 border-t border-landing-surface">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="text-xs font-mono text-primary tracking-[0.25em] uppercase">Results</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-4xl md:text-5xl mt-4 tracking-tight">
              Numbers that <span className="italic">speak.</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {[
              { val: '82%', label: 'Answer Rate', sub: 'Across all campaigns' },
              { val: '67%', label: 'Completion Rate', sub: 'Full data collected' },
              { val: '72%', label: 'Confirmation Rate', sub: 'User-verified data' },
              { val: '3.2%', label: 'Opt-Out Rate', sub: 'Industry-low churn' },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl border border-landing-surface bg-landing-surface/30 p-8"
              >
                <p className="font-display text-4xl md:text-5xl text-primary">{m.val}</p>
                <p className="mt-3 text-sm font-medium">{m.label}</p>
                <p className="mt-1 text-xs text-landing-muted font-mono">{m.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-landing-surface">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-4xl md:text-6xl tracking-tight">
              Ready to <span className="italic text-primary">engage</span> India?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="mt-6 text-landing-muted text-lg font-sans leading-relaxed">
              Launch your first outbound data-collection campaign in minutes. Voice-first, multilingual, compliant.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-xl border border-landing-surface px-8 py-4 text-sm font-medium text-landing-fg hover:bg-landing-surface transition-all"
              >
                Watch Demo
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-landing-surface py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Flame className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-base">BharatVaani Engage</span>
            </div>
            <div className="flex gap-8 text-xs text-landing-muted">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>API Documentation</span>
              <span>Contact</span>
            </div>
            <p className="text-xs text-landing-muted font-mono">© 2026 BharatVaani</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
