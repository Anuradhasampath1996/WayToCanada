"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const asset = (name: string) => `/figma-assets/${name}`;

const faqItems = [
  ["What is RCICMASTER and who is it for?", "RCICMASTER is the practice management platform built for Canadian immigration professionals and regulated RCIC practices."],
  ["How does it help with CICC compliance?", "Trust ledger milestones, document records, and activity audit trails keep your practice organized and ready for review."],
  ["Is there a mobile app?", "Yes. The consultant app keeps cases, notifications, messages, and deadlines available wherever you work."],
  ["Can I invite clients for free?", "Yes. Client portals are included in every plan, so you can invite clients and manage their workspace from day one."],
  ["Is my data secure and PIPEDA-compliant?", "RCICMASTER is designed around secure access, Canadian hosting, and privacy-conscious workflows."],
];

const integrationItems = [
  ["google.svg", "Google Workspace", "Docs, Drive, Gmail & more"],
  ["microsoft.svg", "Microsoft 365", "Outlook, Word, Excel & more"],
  ["dropbox.svg", "Dropbox", "Secure file storage"],
  ["docusign.svg", "DocuSign", "eSignature made easy"],
  ["xero.svg", "Xero", "Accounting software"],
  ["zapier.svg", "Zapier", "Automate your workflows"],
];

const plans = [
  {
    name: "Solo",
    description: "Perfect for independent RCICs just starting out",
    price: "$69",
    features: ["Up to 20 active cases", "Client portal (5 clients)", "Trust ledger", "Mobile app", "Email support"],
  },
  {
    name: "Practice",
    description: "The full platform for established consultants",
    price: "$149",
    features: ["Unlimited active cases", "Unlimited client portals", "Compliance Hub + audit trails", "Reporting & analytics", "Priority support"],
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Multi-consultant firms and large practices",
    price: "$319",
    features: ["Everything in Practice", "Up to 5 consultants", "Custom branding & domain", "Dedicated account manager", "SLA + phone support"],
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="fl-eyebrow">{children}</p>;
}

function RedButton({ children, href = "/register", secondary = false }: { children: ReactNode; href?: string; secondary?: boolean }) {
  return (
    <Link href={href} className={`fl-button ${secondary ? "fl-button-secondary" : ""}`}>
      {children}
      {!secondary && <ArrowRight aria-hidden="true" size={18} />}
    </Link>
  );
}

function ArrowLink({ children }: { children: ReactNode }) {
  return (
    <Link href="/register" className="fl-arrow-link">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

function CheckList({ items, red = false, negative = false }: { items: string[]; red?: boolean; negative?: boolean }) {
  return (
    <ul className={`fl-check-list ${red ? "fl-check-list-red" : ""}`}>
      {items.map((item) => (
        <li key={item}>
          <span className="fl-check-icon">{negative ? <X size={12} strokeWidth={2} /> : <Check size={13} strokeWidth={3} />}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BrowserPreview() {
  return (
    <div className="fl-browser">
      <Image src={asset("dashboard.png")} alt="RCICMASTER consultant dashboard" width={1362} height={894} priority />
    </div>
  );
}

export function FigmaLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [testimonial, setTestimonial] = useState(0);

  return (
    <div className="figma-landing">
      <header className="fl-header">
        <div className="fl-header-inner">
          <Link href="/" className="fl-logo"><Image src={asset("logo-header.svg")} alt="RCICMASTER" width={200} height={44} priority /></Link>
          <nav className={menuOpen ? "fl-nav is-open" : "fl-nav"}>
            <Link href="#home" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link href="#features" onClick={() => setMenuOpen(false)}>Features</Link>
            <Link href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link href="#testimonials" onClick={() => setMenuOpen(false)}>Testimonials</Link>
            <Link href="#faq" onClick={() => setMenuOpen(false)}>FAQ</Link>
          </nav>
          <div className="fl-header-actions"><Link href="/login">Sign in</Link><RedButton>Start free trial</RedButton></div>
          <button className="fl-menu-button" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main>
        <section id="home" className="fl-hero fl-section">
          <div className="fl-orb fl-orb-orange" /><div className="fl-orb fl-orb-red" />
          <div className="fl-hero-inner">
            <div className="fl-hero-pill"><Sparkles size={16} /> Professional platform for RCICs across Canada</div>
            <h1>The Complete Operating System<br />for <span>Modern Immigration Practices</span></h1>
            <p className="fl-hero-subtitle">One secure platform to manage clients, retainers, compliance, documents,<br className="desktop-only" /> legislation and your entire immigration workflow.</p>
            <div className="fl-hero-actions"><RedButton>Start free trial</RedButton><Link className="fl-watch-link" href="#demo"><span><Play size={14} fill="currentColor" /></span>Watch demo</Link></div>
            <div className="fl-trust-line"><span className="fl-stars">★★★★★</span> Trusted by Canadian RCICs</div>
            <div className="fl-hero-browser"><BrowserPreview /><button className="fl-play-button" type="button" aria-label="Watch demo"><Play fill="white" size={24} /></button></div>
          </div>
        </section>

        <section id="pricing" className="fl-pricing fl-section"><div className="fl-container"><Eyebrow>Pricing</Eyebrow><h2>Simple, transparent pricing</h2><div className="fl-billing"><button className={billing === "monthly" ? "is-active" : ""} onClick={() => setBilling("monthly")}>Monthly</button><button className={billing === "yearly" ? "is-active" : ""} onClick={() => setBilling("yearly")}>Yearly <span>Save 15%</span></button></div><div className="fl-plans">{plans.map((plan) => <article className={`fl-plan ${plan.popular ? "is-popular" : ""}`} key={plan.name}>{plan.popular && <span className="fl-popular">Most Popular</span>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="fl-price">{billing === "yearly" ? plan.price.replace(/\d+/, (value) => String(Math.round(Number(value) * 10))) : plan.price}<small>/mo</small></div><CheckList items={plan.features} red /><RedButton secondary={!plan.popular}>Start free trial</RedButton></article>)}</div><p className="fl-plan-note">All plans include consultant dashboard, client portal, and mobile app · Secure payments · Cancel anytime · GST/HST added at checkout</p></div></section>

        <section id="mobile-app" className="fl-mobile fl-section">
          <div className="fl-mobile-card"><div className="fl-mobile-orb" /><div className="fl-mobile-image"><Image src={asset("mobile-app.png")} alt="RCICMASTER mobile app" fill sizes="500px" /></div><div className="fl-mobile-content"><h2>Your practice at your fingertips: mobile app for on-the-go management.</h2><p>Stay connected with clients, cases, and deadlines — whether you&apos;re in the office or on the move.</p><CheckList items={["Real-time client & case notifications", "Approve invites and messages on the go", "Meeting reminders & payment alerts", "Secure access with the same RCIC account"]} /><small>AVAILABLE ON</small><div className="fl-store-badges"><Image src={asset("google-play-badge.svg")} alt="Get it on Google Play" width={150} height={44} /><Image src={asset("app-store-badge.svg")} alt="Download on the App Store" width={150} height={44} /></div></div></div>
        </section>

        <section id="testimonials" className="fl-testimonials fl-section"><div className="fl-container"><Eyebrow>Trusted by immigration professionals</Eyebrow><h2>What our clients are saying</h2><p className="fl-section-lead">Join hundreds of consultants and firms across Canada who trust RCICMASTER to run their practice more efficiently.</p><div className="fl-testimonial-carousel"><button aria-label="Previous testimonial" onClick={() => setTestimonial((testimonial + 2) % 3)}><ChevronLeft /></button><div className="fl-testimonial-track">{[["RCICMASTER has completely transformed how I manage my cases. Everything I need is in one place — secure, organized and easy to use.", "sarah.png", "Sarah Mitchell, RCIC", "Maple Leaf Immigration"], ["The client portal and document management are game changers. My clients love the transparency and communication.", "daniel.png", "Daniel Kim, RCIC", "NorthStar Immigration"], ["Maple AI saves me hours every week. It helps me draft emails, find deadlines and stay compliant with ease.", "maria.png", "Maria Garcia, RCIC", "Garcia Immigration Services"]].map(([quote, image, name, company]) => <article key={name}><span className="fl-quote">“</span><div className="fl-testimonial-stars">★★★★★</div><p>{quote}</p><footer><Image src={asset(image)} alt="" width={40} height={40} /><span><b>{name}</b><small>{company}</small></span></footer></article>)}</div><button aria-label="Next testimonial" onClick={() => setTestimonial((testimonial + 1) % 3)}><ChevronRight /></button></div><div className="fl-carousel-dots">{[0, 1, 2, 3].map((dot) => <button aria-label={`Testimonial ${dot + 1}`} className={dot === testimonial ? "is-active" : ""} key={dot} onClick={() => setTestimonial(dot % 3)} />)}</div></div></section>

        <section className="fl-maple fl-section"><div className="fl-container fl-maple-grid"><div className="fl-maple-copy"><Eyebrow>Work smarter with Maple AI</Eyebrow><h2>Your AI assistant for faster, smarter decisions</h2><p>Ask questions, get instant insights and let Maple AI handle the busy work for you.</p><div className="fl-maple-list">{["Summarize client documents", "Find expiring documents and deadlines", "Draft emails and letters", "Get compliance suggestions"].map((item) => <div key={item}><span><Sparkles size={18} /></span>{item}</div>)}</div><RedButton>Meet Maple AI</RedButton></div><div className="fl-maple-art"><Image src={asset("maple-ai.png")} alt="Maple AI assistant" fill sizes="300px" /><div className="fl-maple-bubble">Hello! I&apos;m Maple AI. How can I<br />help you today?</div></div></div></section>

        <section className="fl-security fl-section"><div className="fl-container fl-security-card"><div className="fl-security-logos"><Eyebrow>Proudly follow rules and regulations</Eyebrow><div><article><Image src={asset("cicc.png")} alt="CICC" width={120} height={80} /><strong>CICC / CCIC</strong><small>College of Immigration and<br />Citizenship Consultants</small></article><article><Image src={asset("iccrc.png")} alt="ICCRC" width={120} height={80} /><strong>ICCRC / CRIC</strong><small>Immigration Consultants of<br />Canada Regulatory Council</small></article><article><Image src={asset("pipeda.png")} alt="PIPEDA" width={72} height={80} /><strong>PIPEDA</strong><small>Personal Information<br />Protection and Electronic<br />Documents Act</small></article></div></div><div className="fl-security-copy"><Eyebrow>Built on trust.</Eyebrow><h2>Backed by security. Built for excellence.</h2><p>We follow the highest standards to protect your data and help your practice grow.</p><ArrowLink>Learn more about security</ArrowLink></div></div></section>

        <section className="fl-workflow fl-section"><div className="fl-container"><div className="fl-centered-heading"><Eyebrow>Built for the way you work</Eyebrow><h2>Everything connected around your practice</h2><p>Clients, cases, documents, compliance, calendar and reports — all linked in one secure workspace.</p></div><div className="fl-hub"><div className="fl-hub-side left"><span className="fl-hub-node clients"><i><Users size={21} aria-hidden="true" /></i>Clients</span><span className="fl-hub-node cases"><i><FolderKanban size={21} aria-hidden="true" /></i>Cases</span><span className="fl-hub-node compliance"><i><ShieldCheck size={21} aria-hidden="true" /></i>Compliance</span></div><div className="fl-hub-center"><div className="fl-hub-ring fl-hub-ring-outer" /><div className="fl-hub-ring fl-hub-ring-inner" /><span><Image src={asset("hub-shield.svg")} alt="RCICMASTER" width={64} height={82} /></span></div><div className="fl-hub-side right"><span className="fl-hub-node reports"><i><BarChart3 size={21} aria-hidden="true" /></i>Reports</span><span className="fl-hub-node calendar"><i><CalendarDays size={21} aria-hidden="true" /></i>Calendar</span><span className="fl-hub-node documents"><i><FileText size={21} aria-hidden="true" /></i>Documents</span></div></div></div></section>

        <section className="fl-integrations fl-section"><div className="fl-container fl-integration-card"><div className="fl-integration-copy"><Eyebrow>Built to integrate</Eyebrow><h2>Works seamlessly with the tools you already use</h2><p>RCICMASTER integrates with the tools you rely on every day to save time and reduce manual work.</p><ArrowLink>View all integrations</ArrowLink></div><div className="fl-integration-grid">{integrationItems.map(([logo, name, text]) => <article key={name}><Image src={asset(logo)} alt="" width={22} height={22} /><strong>{name}</strong><small>{text}</small></article>)}</div></div></section>


        <section id="faq" className="fl-faq fl-section"><div className="fl-container"><Eyebrow>FAQ</Eyebrow><h2>Common questions</h2><div className="fl-faq-list">{faqItems.map(([question, answer], i) => <article className={openFaq === i ? "is-open" : ""} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{question}</span><ChevronDown size={20} /></button>{openFaq === i && <p>{answer}</p>}</article>)}</div></div></section>

      </main>

      <footer className="fl-footer"><div className="fl-container"><div className="fl-footer-top"><div className="fl-footer-brand"><Image src={asset("logo-footer.svg")} alt="RCICMASTER" width={167} height={36} /><p>The all-in-one practice management platform for Canadian immigration professionals.</p><div className="fl-socials"><a href="#" aria-label="LinkedIn">in</a><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="YouTube">▶</a></div></div><div className="fl-footer-links"><div><h3>Explore</h3><Link href="#features">Features</Link><Link href="#pricing">Pricing</Link><Link href="#testimonials">Testimonials</Link><Link href="#faq">FAQ</Link></div><div><h3>Legal</h3><span>Privacy Policy</span><span>Terms of Service</span><span>Data Processing Addendum</span></div><div><h3>Contact</h3><a href="mailto:support@rcicmaster.com">✉ support@rcicmaster.com</a><a href="tel:+16475551234">☎ +1 (647) 555-1234</a><span>◷ Mon – Fri: 9AM – 6PM EST</span></div></div></div><div className="fl-footer-bottom"><span>© 2026 RCICMASTER. All rights reserved.</span><strong>Proudly Canadian</strong></div></div></footer>
    </div>
  );
}
