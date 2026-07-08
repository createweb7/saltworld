'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles, Sun, Moon, Printer, ChevronRight, Check, ArrowRight,
  Compass, Users, Layers, Map, LayoutDashboard, MousePointerClick,
  BookOpen, Search, Component, Palette, Zap, Smartphone, Tablet, Monitor,
  Accessibility, Gauge, Activity, Image as ImageIcon, TrendingUp, Bot,
} from 'lucide-react';
import { Button, IconButton, Badge, Pill, Card, Divider } from '@/components/ss/primitives';
import { cn } from '@/components/ss/utils';
import { NAV, ALL_IDS, PALETTE, TYPE, MOTION } from '@/lib/strategy-content';

const ICONS = {
  ux: Compass, journey: Users, ia: Layers, sitemap: Map,
  homepage: LayoutDashboard, landing: MousePointerClick, cms: BookOpen, seo: Search, components: Component,
  language: Palette, motion: Zap, mobile: Smartphone, tablet: Tablet, desktop: Monitor, a11y: Accessibility,
  perf: Gauge, cwv: Activity, imagery: ImageIcon, cro: TrendingUp, ai: Bot,
};

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const initial = typeof window !== 'undefined' && (
      localStorage.getItem('sw-theme') === 'dark' ||
      (!localStorage.getItem('sw-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
    setDark(!!initial);
    document.documentElement.classList.toggle('dark', !!initial);
  }, []);
  const toggle = useCallback(() => {
    setDark(d => {
      const nd = !d;
      document.documentElement.classList.toggle('dark', nd);
      localStorage.setItem('sw-theme', nd ? 'dark' : 'light');
      return nd;
    });
  }, []);
  return { dark, toggle };
}

function useActive() {
  const [active, setActive] = useState(ALL_IDS[0]);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: '-96px 0px -70% 0px', threshold: [0, 1] });
    ALL_IDS.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return active;
}

/* -------------------------------- shared bits -------------------------------- */
const Eyebrow = ({ children }) => (
  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{children}</div>
);
const H2 = ({ children }) => (
  <h2 className="mt-1 text-3xl md:text-[38px] font-semibold tracking-tight leading-[1.05]" style={{ fontFamily: 'var(--font-serif, Georgia), serif' }}>{children}</h2>
);
const Lead = ({ children }) => <p className="mt-3 text-[15.5px] leading-8 text-muted-foreground max-w-2xl">{children}</p>;
const H3 = ({ children }) => <h3 className="mt-8 mb-2 text-[17px] font-semibold tracking-tight text-foreground">{children}</h3>;
const P  = ({ children }) => <p className="text-[14.5px] leading-7 text-muted-foreground mb-3">{children}</p>;
const UL = ({ children }) => <ul className="list-disc pl-5 space-y-1.5 text-[14.5px] leading-7 text-muted-foreground mb-3">{children}</ul>;
const OL = ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 text-[14.5px] leading-7 text-muted-foreground mb-3">{children}</ol>;
const Code = ({ children }) => <pre className="font-mono text-[12px] leading-6 bg-[hsl(222,24%,4%)] text-zinc-100 p-4 rounded-lg overflow-x-auto border border-border/60 my-4">{children}</pre>;
const Quote = ({ children }) => <blockquote className="border-l-2 border-brand pl-4 my-4 italic text-foreground/90 text-[15px] leading-7">{children}</blockquote>;

const TableSimple = ({ head, rows }) => (
  <div className="rounded-xl border border-border overflow-hidden my-4">
    <table className="w-full text-[13.5px]">
      <thead className="bg-muted/50">
        <tr>{head.map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-[11.5px] uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border align-top">
            {r.map((c, j) => <td key={j} className="px-4 py-2.5 text-muted-foreground">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SectionHead = ({ id, num, title, tagline }) => (
  <div id={id} className="scroll-mt-24 pt-20 first:pt-4">
    <Eyebrow>{num}</Eyebrow>
    <H2>{title}</H2>
    {tagline && <Lead>{tagline}</Lead>}
    <Divider className="mt-6" />
  </div>
);

/* -------------------------------- sections -------------------------------- */

const S1 = () => (
  <>
    <SectionHead id="ux" num="01 · Foundation" title="UX Strategy" tagline="We don't sell therapies. We sell felt outcomes. Every interface decision follows from that one belief." />
    <H3>Thesis</H3>
    <P>Salt World is not a spa. It is an <b>outcomes destination</b>. A person doesn&apos;t wake up wanting halotherapy — they wake up unable to breathe, unable to sleep, unable to think. The site must meet them at their language, not ours.</P>
    <Quote>We rewrite the whole navigation around the customer&apos;s <em>problem</em>, and treat therapies as an underlying protocol library — not the front door.</Quote>
    <H3>Design principles</H3>
    <TableSimple
      head={['Principle', 'What it means', 'What it kills']}
      rows={[
        ['Outcome-first',     'Nav, hero, landing pages all begin with "I want…"', 'Therapy-first menus'],
        ['Editorial calm',    'Big type, long pauses, single ideas per screen',    'Sales pressure & dense grids'],
        ['One action per view','Every screen has one primary CTA, one secondary',  'Cluttered CTAs, competing offers'],
        ['Show, don\u2019t tell', 'Photography and motion do the heavy lifting',    'Stock icons and generic copy'],
        ['Body-first mobile', 'Booking flows fit the thumb; nothing needs zoom',   'Desktop-scaled forms'],
        ['Whisper, don\u2019t shout','Micro-interactions in ease-out; never bouncy','Playful animation'],
        ['Prove it',          'Reviews, media, science, in that order',            'Anonymous testimonials'],
      ]}
    />
    <H3>Journey model</H3>
    <P>Three-layer descent: <b>Outcome</b> (what you feel) → <b>Protocol</b> (what we do) → <b>Booking</b> (when you come). Users can enter at any layer and are always one tap from the next.</P>
    <Code>{`Outcome  →  Protocol  →  Slot  →  Confirm
 "Better sleep"    "Evening float"   "Fri 8pm"   ✓`}</Code>
    <H3>Success metrics (year 1)</H3>
    <UL>
      <li>Bookings from mobile ≥ <b>72%</b> of all bookings</li>
      <li>Homepage → outcome page conversion ≥ <b>38%</b></li>
      <li>Outcome page → booking start ≥ <b>18%</b></li>
      <li>Booking funnel completion ≥ <b>64%</b></li>
      <li>Repeat rate within 90 days ≥ <b>44%</b></li>
      <li>Membership share of revenue ≥ <b>30%</b></li>
    </UL>
  </>
);

const S2 = () => (
  <>
    <SectionHead id="journey" num="02 · Foundation" title="Customer Journey" tagline="Six primary personas. One journey shape. Different entry doors." />
    <H3>Personas</H3>
    <TableSimple
      head={['Persona', 'Trigger', 'Outcome they want', 'Where they enter']}
      rows={[
        ['Stressed executive',   'Third bad week',      'Stress relief, mental reset', '/outcomes/stress-relief'],
        ['Sleep-deprived parent','2 AM Google',         'Deeper sleep',                '/outcomes/better-sleep'],
        ['Recovery athlete',     'Race in 6 weeks',     'Faster recovery',             '/outcomes/muscle-recovery'],
        ['Date-nighter',         'Anniversary in 5 days','Unique experience',           '/outcomes/couple-activities'],
        ['Corporate HR',         'Q3 wellness budget',  'Team wellness program',       '/for-teams'],
        ['Gifter',               'Birthday tomorrow',   'Instant delivery',            '/gifts'],
      ]}
    />
    <H3>Six stages, one shape</H3>
    <TableSimple
      head={['Stage', 'Question in their head', 'Our job']}
      rows={[
        ['Aware',       '"Something is off."',                        'Meet them at outcomes, not services'],
        ['Curious',     '"What can actually help?"',                  'One protocol page per outcome, editorial'],
        ['Considering', '"Is this legitimate? Will it work for me?"', 'Science card, reviews, media, trust bar'],
        ['Booking',     '"Fri 7pm or Sat morning?"',                  'Slot picker in 2 taps; sticky CTA'],
        ['Post-visit',  '"Was that good enough to return?"',          'WhatsApp check-in at 24h, book-again nudge at 72h'],
        ['Advocate',    '"Who else needs this?"',                     'Gift card in email receipt; referral credit'],
      ]}
    />
    <H3>Anti-patterns we avoid</H3>
    <UL>
      <li>&quot;Choose a therapy&quot; navigation — reversed to &quot;Choose an outcome&quot;</li>
      <li>Popups within 10s of arrival — replaced with sticky booking bar</li>
      <li>Testimonial carousels — replaced with editorial reviews page</li>
      <li>&quot;Book now&quot; that opens a form modal — always inline, contextual</li>
    </UL>
  </>
);

const S3 = () => (
  <>
    <SectionHead id="ia" num="03 · Foundation" title="Information Architecture" tagline="Outcomes are the primary nav. Therapies are a reference library. Everything else is a page type." />
    <H3>Two axes</H3>
    <TableSimple
      head={['Axis', 'Content types', 'Nav placement']}
      rows={[
        ['Outcome axis (front door)',   'Stress relief, Better sleep, Muscle recovery, Couple activities, Longevity, Skin, Mental wellness, Pain relief', 'Primary nav'],
        ['Protocol axis (library)',     'Float therapy, Salt therapy, Infrared sauna, Cold plunge, Red-light',                                              'Secondary nav / footer'],
        ['Commerce axis',               'Memberships, Gift cards, Products, Corporate wellness',                                                            'Utility nav + CTAs'],
        ['Editorial axis',              'Journal (blog), Media, About, Testimonials, FAQ',                                                                  'Footer & inline'],
      ]}
    />
    <H3>Content types (11)</H3>
    <TableSimple
      head={['Type', 'Purpose', 'Ownership']}
      rows={[
        ['Outcome page',       'Ranks for problem-searches; converts to booking',      'Marketing'],
        ['Protocol page',      'Explains one therapy in depth; science + FAQ',         'Marketing + Clinical'],
        ['Landing page',       'Campaign / paid / seasonal',                           'Marketing (AI-drafted)'],
        ['Journal article',    'Long-form editorial, SEO',                             'Content'],
        ['Product page',       'Retail (salt lamps, bath salts, etc.)',                'E-commerce'],
        ['Membership page',    'Tiers, benefits, comparison',                          'Marketing'],
        ['Gift card page',     'Denominations + designer + delivery',                  'Marketing'],
        ['Corporate page',     'B2B wellness lead capture',                            'Sales'],
        ['Booking flow',       'Outcome → slot → checkout',                            'Product'],
        ['Legal/utility',      'About, Contact, Terms, Privacy',                       'Operations'],
        ['System page',        '404, offline, receipt, confirmation',                  'Product'],
      ]}
    />
  </>
);

const S4 = () => (
  <>
    <SectionHead id="sitemap" num="04 · Foundation" title="Sitemap" tagline="Every URL. Kebab-case. Predictable. SEO-optimized." />
    <Code>{`/
├── /outcomes/
│   ├── stress-relief
│   ├── better-sleep
│   ├── muscle-recovery
│   ├── pain-relief
│   ├── couple-activities
│   ├── anniversary-gifts
│   ├── longevity
│   ├── skin-rejuvenation
│   ├── mental-wellness
│   └── breathe-better
├── /therapies/
│   ├── float-therapy
│   ├── salt-therapy
│   ├── infrared-sauna
│   ├── cold-plunge
│   └── red-light-therapy
├── /journal/
│   ├── /                (index)
│   └── /[slug]
├── /memberships
├── /gifts
│   ├── /                (index / gift card designer)
│   └── /[occasion]      (birthday, anniversary, corporate)
├── /shop/
│   ├── /                (product index)
│   └── /[slug]          (product detail)
├── /for-teams           (corporate wellness B2B)
├── /book
│   ├── /                (outcome picker)
│   ├── /[outcome]       (slot & protocol picker)
│   └── /confirm
├── /about
├── /media
├── /reviews
├── /contact
├── /faq
├── /journeys/[slug]     (multi-step programs, e.g., "sleep-reset")
├── /p/[slug]            (CMS marketing / landing pages)
├── /account
│   ├── /                (dashboard)
│   ├── /bookings
│   ├── /membership
│   └── /gifts
├── /legal/{terms,privacy,refunds}
└── /system/{404, offline, receipt/[id], confirm/[id]}`}</Code>
    <H3>URL rules</H3>
    <UL>
      <li>Kebab-case, no trailing slash, no query params for content</li>
      <li>Outcome URLs are the SEO breadwinners — never migrate them</li>
      <li>Localization reserved: <code className="font-mono text-[12px] px-1 rounded bg-muted">/[locale]/*</code></li>
      <li>Legacy therapy URLs 301 → new /therapies/* paths</li>
    </UL>
  </>
);

const S5 = () => (
  <>
    <SectionHead id="homepage" num="05 · Product" title="Homepage Wireframe" tagline="Ten sections. One question. Every block earns its place." />
    <div className="rounded-2xl border border-border overflow-hidden my-6 bg-card">
      {[
        ['00 · Nav',              'Fixed. Ultra-thin. Logo · Outcomes · Therapies · Memberships · Journal · Book (accent).', 'h-14'],
        ['01 · Hero',             'Full-bleed video (10s loop of salt cave slow-mo). Editorial serif headline: "What brings you here today?" Sub: "Bengaluru\u2019s wellness sanctuary." Two chips: I\u2019m stressed · I want better sleep.', 'h-64'],
        ['02 · Outcome picker',   'Eight large tiles \u2014 stress, sleep, recovery, skin, longevity, couple, gift, corporate. Each: minimalist illustration + one line + arrow. Grid 4\u00d72 desktop, 2\u00d74 mobile.', 'h-64'],
        ['03 · Editorial promise','Split: photo left, single sentence right \u2014 "A place engineered to feel like nothing." Read the story → About.', 'h-40'],
        ['04 · Featured outcome', 'Long-form editorial block for one outcome (rotated weekly), pulls from CMS. Photography-led.', 'h-56'],
        ['05 · Members-only',     'Membership tease \u2014 "Members book first, pay less, feel better." Two-column comparison.', 'h-40'],
        ['06 · Reviews',          'Three quotes on a bone background. Real names, roles, star ratings, Google logo. Muted.', 'h-40'],
        ['07 · Journal preview',  'Three latest articles. Editorial cards with wide 3:2 imagery.', 'h-48'],
        ['08 · Gift & Corporate', 'Split CTA row \u2014 "Gift wellness" · "Wellness for teams".', 'h-32'],
        ['09 · Sticky booking bar','Bottom-of-screen bar on mobile (desktop shows at scroll). "Book a session" \u2014 always visible after hero scrolls out.', 'h-10'],
      ].map(([label, desc, h], i) => (
        <div key={i} className={cn('flex border-b border-border last:border-b-0 group', h)}>
          <div className="w-32 shrink-0 border-r border-border bg-muted/50 flex items-center justify-center text-[11px] font-mono text-muted-foreground">{label}</div>
          <div className="flex-1 p-4 flex items-center text-[13px] text-foreground/90">{desc}</div>
        </div>
      ))}
    </div>
    <H3>Rationale</H3>
    <UL>
      <li>Hero commits the entire premise — outcomes over therapies — in one sentence.</li>
      <li>Outcome picker (block 02) is the primary conversion surface, not the hero CTA.</li>
      <li>No pricing on homepage. Price shown after intent (outcome page → slot picker).</li>
      <li>Sticky booking bar appears only after hero scroll — respects the editorial opening.</li>
    </UL>
  </>
);

const S6 = () => (
  <>
    <SectionHead id="landing" num="06 · Product" title="Landing Page Strategy" tagline="One reusable anatomy. Fifty outcome pages. Zero snowflakes." />
    <H3>Anatomy of an outcome page</H3>
    <OL>
      <li><b>Editorial hero</b> — photo + sentence; no CTA above the fold, only a discreet scroll cue.</li>
      <li><b>The felt result</b> — three sentences of what a member reports after 4 sessions.</li>
      <li><b>Why it works</b> — one science card, one plain-English explanation, cited.</li>
      <li><b>The protocol</b> — the specific therapy(s), duration, frequency. Links to protocol pages.</li>
      <li><b>Your first visit</b> — a 4-step timeline. Removes friction.</li>
      <li><b>Reviews for this outcome</b> — filtered testimonials only.</li>
      <li><b>Pricing tile</b> — single-visit + package + membership. Membership highlighted.</li>
      <li><b>FAQ</b> — the 6 real questions people ask before booking. Schema-tagged.</li>
      <li><b>Book</b> — inline slot picker; no modal.</li>
      <li><b>Related outcomes</b> — "People with sleep issues also chose stress relief." Cross-linking.</li>
    </OL>
    <H3>Copy voice</H3>
    <UL>
      <li>Second person, present tense: "You lie back. The room dims. Forty-five minutes passes without you noticing."</li>
      <li>No superlatives, no adjectives-as-decor: "best," "amazing," "life-changing" are banned.</li>
      <li>Numbers over adjectives: "60 minutes," "3× per week," "4 weeks."</li>
      <li>Science cited by name once; not repeated for effect.</li>
    </UL>
    <H3>Programmatic scale</H3>
    <P>Each outcome page is a CMS record composed of blocks. Ten outcomes × 6 sub-variants (city, seasonal, couple, corporate, etc.) = <b>60+ pages</b> from a single template.</P>
  </>
);

const S7 = () => (
  <>
    <SectionHead id="cms" num="07 · Product" title="CMS Architecture" tagline="Framer-grade authoring. Blocks in, pages out. Marketing never touches a developer." />
    <H3>Content model</H3>
    <TableSimple
      head={['Entity', 'Fields (core)', 'Notes']}
      rows={[
        ['Page',            'id, slug, title, status, template, sections[], seo{}, updatedAt, publishedAt', 'Universal page type; templated via `template` key'],
        ['Section (block)', 'id, type, props{}, styles{}, visibility{}',                                     'Composable atoms; validated by Zod schema per type'],
        ['Media asset',     'id, url, alt, focal{x,y}, palette, width, height',                             'Focal point drives responsive crops'],
        ['Template',        'id, name, presetSections[], seoDefaults{}, category',                          'Outcome, Landing, Journal, Product, Corporate'],
        ['Revision',        'id, pageId, actor, diff, createdAt',                                           'Immutable; supports restore'],
        ['CopyBrief',       'id, prompt, outcomeId, generated{...}',                                        'AI copy sessions'],
      ]}
    />
    <H3>Block library (v1)</H3>
    <TableSimple
      head={['Category', 'Blocks']}
      rows={[
        ['Header',   'EditorialHero, ProductHero, MinimalHero, VideoHero'],
        ['Content',  'ProseBlock, TwoColumnStory, PullQuote, Callout, ScienceCard'],
        ['Grid',     'OutcomePicker, ProtocolGrid, ProductGrid, JourneyStepper'],
        ['Social',   'ReviewGrid, MediaLogos, Rating'],
        ['Commerce', 'PricingTable, PackageTile, GiftCardDesigner, MembershipMatrix'],
        ['Media',    'FullBleedImage, Gallery, VideoEmbed, BeforeAfter'],
        ['Trust',    'FAQAccordion, PolicyCard, TeamPortrait'],
        ['Action',   'BookingSlotPicker, WhatsAppCTA, InlineForm, StickyBookingBar'],
      ]}
    />
    <H3>Editor experience</H3>
    <UL>
      <li>3-pane layout (sections tree · canvas · inspector), already built in Phase 2 slice 1.</li>
      <li><b>Autosave</b> every 700ms; version snapshots on Publish and every 10 min of edits.</li>
      <li><b>Preview</b> as a share-link with a signed token (no auth required).</li>
      <li><b>Duplicate</b> at page and block level.</li>
      <li><b>AI copy</b> per block: "Rewrite this hero for corporate audience."</li>
      <li><b>Roles</b>: Editor, Reviewer, Publisher.</li>
      <li><b>Focus mode</b>: keyboard-only editing with `?` help overlay.</li>
    </UL>
    <H3>Governance</H3>
    <UL>
      <li>Every block type ships with a Zod schema; invalid data cannot be saved.</li>
      <li>Design tokens are the only source of color/spacing — no free-form styles.</li>
      <li>Content diffing is per-block for clean review UI.</li>
    </UL>
  </>
);

const S8 = () => (
  <>
    <SectionHead id="seo" num="08 · Product" title="SEO Strategy" tagline="Outcomes are the search terms. We build the internet's clearest outcome pages." />
    <H3>Keyword architecture</H3>
    <TableSimple
      head={['Tier', 'Intent', 'Examples']}
      rows={[
        ['Tier 1 · Outcome',  'Problem-searching',      '"how to sleep better," "stress relief bangalore," "muscle recovery"'],
        ['Tier 2 · Combo',    'Location + problem',     '"couple activities bangalore," "wellness gifts bangalore"'],
        ['Tier 3 · Therapy',  'Solution-aware',         '"float therapy bangalore," "salt therapy for asthma"'],
        ['Tier 4 · Brand',    'Direct',                 '"salt world bangalore," "salt world reviews"'],
      ]}
    />
    <H3>On-page baseline (every page)</H3>
    <UL>
      <li>&lt;title&gt; ≤ 60 chars, meta description ≤ 155</li>
      <li>Open Graph + Twitter cards; per-page OG image auto-generated via <code className="font-mono text-[12px] px-1 rounded bg-muted">@vercel/og</code></li>
      <li>Canonical URL; hreflang reserved</li>
      <li>Breadcrumbs component + <code className="font-mono text-[12px] px-1 rounded bg-muted">BreadcrumbList</code> JSON-LD</li>
      <li>H1 present exactly once, aligned to primary keyword</li>
      <li>Internal linking cluster: outcome ⇄ protocol ⇄ related outcome ⇄ journal</li>
    </UL>
    <H3>Schema.org (JSON-LD)</H3>
    <TableSimple
      head={['Schema', 'Where']}
      rows={[
        ['LocalBusiness / HealthClub', 'Every page (site-wide via layout)'],
        ['Service',                    'Each protocol page'],
        ['FAQPage',                    'Any page with FAQ block'],
        ['Product',                    'Shop products'],
        ['Article',                    'Journal posts'],
        ['BreadcrumbList',             'Every non-home page'],
        ['Review + AggregateRating',   'Reviews page + outcome pages'],
        ['Event',                      'Workshops, seasonal programs'],
      ]}
    />
    <H3>Programmatic SEO</H3>
    <UL>
      <li>Outcome × sub-variant matrix generates 60+ landing pages under <code className="font-mono text-[12px] px-1 rounded bg-muted">/p/[slug]</code></li>
      <li>Automatic <code className="font-mono text-[12px] px-1 rounded bg-muted">sitemap.xml</code> (all published pages + last-mod) and <code className="font-mono text-[12px] px-1 rounded bg-muted">robots.txt</code></li>
      <li>Journal RSS + JSON feed</li>
    </UL>
  </>
);

const S9 = () => (
  <>
    <SectionHead id="components" num="09 · Product" title="Component Map" tagline="Every UI atom, in one place. Marketing composes; engineering never invents." />
    <H3>Layers</H3>
    <TableSimple
      head={['Layer', 'Owns', 'Examples']}
      rows={[
        ['Tokens',        'Colors, spacing, radius, motion, elevation, type', 'Halite, Bone, Aurora, radius-md'],
        ['Primitives',    'Buttons, inputs, badges, cards',                    'Button, Field, Card, Pill, StatCard'],
        ['Composites',    'Multi-part UI',                                     'DataTable, FormField, EmptyState, PageHeader'],
        ['Blocks',        'CMS-authorable page sections',                      'EditorialHero, OutcomePicker, PricingTable, FAQAccordion'],
        ['Domain widgets','Booking-specific',                                  'SlotPicker, ProtocolCard, MembershipMatrix'],
        ['Templates',     'Full page presets',                                 'OutcomeTemplate, ProtocolTemplate, JournalTemplate'],
      ]}
    />
    <H3>Component inventory (v1 target: 74)</H3>
    <UL>
      <li>Navigation (7): TopNav, Footer, Breadcrumbs, MobileDrawer, TabBar, SectionNav, StickyBookingBar</li>
      <li>Form (12): Input, Textarea, Select, Combobox, DatePicker, TimePicker, RangeSlider, Checkbox, Radio, Switch, FileUploader, PhoneInput</li>
      <li>Feedback (9): Toast, Modal, Sheet, Popover, Alert, Skeleton, EmptyState, ErrorState, LoadingState</li>
      <li>Data (8): DataTable, Chart, StatCard, KPI, Timeline, KeyValue, ProgressBar, Rating</li>
      <li>Editorial (14): EditorialHero, MinimalHero, VideoHero, ProseBlock, PullQuote, TwoColumnStory, FullBleedImage, Gallery, VideoEmbed, ScienceCard, Callout, JournalCard, MediaLogos, TeamPortrait</li>
      <li>Commerce (10): PricingTable, PackageTile, MembershipMatrix, GiftCardDesigner, GiftCardPreview, ProductCard, ProductGallery, PriceBadge, Voucher, CheckoutSummary</li>
      <li>Booking (7): SlotPicker, ProtocolCard, BookingSummary, TrustBar, InlineForm, ConfirmationCard, ReceiptViewer</li>
      <li>Trust (7): FAQAccordion, PolicyCard, ReviewCard, ReviewGrid, RatingBar, AggregateRating, StaffCard</li>
    </UL>
  </>
);

const S10 = () => (
  <>
    <SectionHead id="language" num="10 · Design" title="Design Language" tagline="Derived from the logo teal. Evolved into a full luxury system with warm neutrals and one apricot accent." />

    <H3>Colors</H3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
      {PALETTE.map(p => (
        <div key={p.name} className="rounded-xl border border-border overflow-hidden">
          <div className="h-24 flex items-end p-3" style={{ background: p.hex, color: p.text }}>
            <div className="font-mono text-[11px]">{p.hex}</div>
          </div>
          <div className="p-3">
            <div className="text-[13.5px] font-semibold">{p.name}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{p.role}</div>
          </div>
        </div>
      ))}
    </div>
    <P>The logo&apos;s teal becomes <b>Halite</b> (deeper, more sophisticated). Warm neutrals <b>Bone</b> and <b>Sand</b> make the site feel Aman-editorial rather than clinical. A single <b>Aurora</b> apricot is the only saturated color a user meets outside of imagery — reserved for booking CTAs and moments of delight.</P>

    <H3>Typography</H3>
    <TableSimple
      head={['Role', 'Font', 'Sample', 'Notes']}
      rows={TYPE.map(t => [t.role, t.font, <span key={t.role} style={{ fontFamily: t.font.includes('Fraunces') ? 'Georgia, serif' : undefined }} className="text-foreground">{t.sample}</span>, t.note])}
    />
    <P>Serif (Fraunces) is used with restraint — hero headlines and section leads only. Inter carries the entire interface. JetBrains Mono is a whisper for booking references and admin.</P>

    <H3>Spacing & rhythm</H3>
    <P>4-pt base grid. Expressive scale for editorial rhythm: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192. Vertical rhythm on marketing pages targets a 32px baseline.</P>
    <div className="rounded-xl border border-border p-5 bg-card my-4 space-y-2.5">
      {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map(px => (
        <div key={px} className="flex items-center gap-4">
          <div className="w-10 font-mono text-[11.5px] text-muted-foreground">{px}px</div>
          <div className="h-2 rounded-full" style={{ width: `${px * 1.5}px`, background: '#0F766E' }} />
        </div>
      ))}
    </div>

    <H3>Radius, elevation, borders</H3>
    <UL>
      <li>Radius: 6 / 10 / 14 / 20 / full. Never 4.</li>
      <li>Elevation: hairline borders over shadow. Shadow only on modal, popover, and the sticky booking bar.</li>
      <li>Borders: 1px, always tokenized; never invented.</li>
    </UL>

    <H3>Dark mode</H3>
    <P>Dark mode inverts luminance, not hue. Halite deepens; Bone becomes near-black; Aurora holds. Editorial photography is never inverted.</P>
  </>
);

const S11 = () => (
  <>
    <SectionHead id="motion" num="11 · Design" title="Motion Guidelines" tagline="Whisper, don't shout. Ease-out for user intent. Editorial for narrative reveals." />
    <TableSimple
      head={['Token', 'Duration', 'Easing', 'Usage']}
      rows={MOTION.map(m => [m.name, `${m.ms}ms`, <code key={m.name} className="font-mono text-[12px]">{m.ease}</code>, m.use])}
    />
    <H3>Rules</H3>
    <UL>
      <li>No spring physics on primary UI. Reserve springs for playful surfaces (gift card designer only).</li>
      <li>Hero video loops at 24fps, muted, autoplay only above the fold.</li>
      <li>Section reveals: 8px translate + fade, staggered 60ms per element, once per session.</li>
      <li>Page transitions: 220ms opacity + 6px lift. No content shift.</li>
      <li>Ken Burns on editorial imagery: 12s cycle, respects <code className="font-mono text-[12px] px-1 rounded bg-muted">prefers-reduced-motion</code>.</li>
      <li>Loading states never bounce. Skeletons match final layout exactly.</li>
    </UL>
  </>
);

const S12 = () => (
  <>
    <SectionHead id="mobile" num="12 · Design" title="Mobile UX" tagline="72% of bookings come from a thumb. Design for the thumb." />
    <H3>Frame</H3>
    <UL>
      <li>Base viewport: iPhone 14 (390 × 844).</li>
      <li>Top: 56px fixed nav — logo + drawer trigger + phone.</li>
      <li>Bottom: sticky <b>StickyBookingBar</b> that appears after hero scrolls out. Never a modal.</li>
      <li>Editorial hero is full-bleed with 24px inset for typography.</li>
      <li>Thumb-zone: primary CTAs live in the bottom 40% of the screen.</li>
    </UL>
    <H3>Booking flow (mobile)</H3>
    <OL>
      <li>Outcome (tap card) → 1 tap</li>
      <li>Slot (day + time in one screen; segmented control) → 1 tap</li>
      <li>Contact (phone + name only; email optional) → autofill + 1 field</li>
      <li>Confirm (Razorpay / pay-at-visit) → 1 tap</li>
    </OL>
    <P>Total: <b>4 taps + 1 short form</b>. Target funnel completion ≥ 64%.</P>
    <H3>Touch targets, gestures</H3>
    <UL>
      <li>Minimum 44 × 44 pt touch targets; visual hit-area extends to 48.</li>
      <li>Horizontal swipes only in Galleries — never in nav.</li>
      <li>Pull-to-refresh disabled on marketing routes.</li>
    </UL>
  </>
);

const S13 = () => (
  <>
    <SectionHead id="tablet" num="13 · Design" title="Tablet UX" tagline="Hybrid canvas. Not a scaled-up phone. Not a shrunk-down desktop." />
    <UL>
      <li>Base viewport: 834 × 1194 (iPad Air).</li>
      <li>Two-column layouts where they truly help — outcome pages and journal, not booking.</li>
      <li>Sidebar nav collapses to icon-only in landscape admin.</li>
      <li>Booking uses desktop layout (two-column: protocol summary + slot picker).</li>
      <li>Editorial imagery targets 3:2 or 16:10 at tablet; never crop portraits.</li>
    </UL>
  </>
);

const S14 = () => (
  <>
    <SectionHead id="desktop" num="14 · Design" title="Desktop UX" tagline="An editorial magazine that also books. Max content width 1200; hero can go full-bleed." />
    <UL>
      <li>Base viewport: 1440 × 900.</li>
      <li>Content column: max 1200px; hero and gallery blocks may go full-bleed.</li>
      <li>Nav: 64px fixed, translucent-blur over hero, solid after scroll.</li>
      <li>Booking flow: two-column — left protocol summary, right slot picker (persistent).</li>
      <li>Admin canvas: 3-pane builder (already implemented).</li>
      <li>Cursor affordances: subtle magnetic hover on primary CTAs; no cursor customization.</li>
    </UL>
  </>
);

const S15 = () => (
  <>
    <SectionHead id="a11y" num="15 · Design" title="Accessibility" tagline="WCAG 2.2 AA as the floor. Motion-safe by default." />
    <UL>
      <li>Contrast: body 4.5:1 minimum; large type 3:1; UI 3:1. Aurora on Bone tested.</li>
      <li>Focus states: 2px ring in <code className="font-mono text-[12px] px-1 rounded bg-muted">--ring</code>, 2px offset. Always visible.</li>
      <li>Skip-to-content link on every page.</li>
      <li>Semantic HTML: <code className="font-mono text-[12px] px-1 rounded bg-muted">nav</code>, <code className="font-mono text-[12px] px-1 rounded bg-muted">main</code>, <code className="font-mono text-[12px] px-1 rounded bg-muted">article</code>, <code className="font-mono text-[12px] px-1 rounded bg-muted">aside</code> used correctly.</li>
      <li>ARIA only where semantics fall short (custom pickers).</li>
      <li>All form fields have visible labels + programmatic association.</li>
      <li>Motion respects <code className="font-mono text-[12px] px-1 rounded bg-muted">prefers-reduced-motion</code>; hero video pauses.</li>
      <li>Keyboard: full booking flow completable without a mouse. Tab order tested.</li>
      <li>Screen reader passes (VoiceOver, NVDA) as part of PR checklist.</li>
    </UL>
  </>
);

const S16 = () => (
  <>
    <SectionHead id="perf" num="16 · Delivery" title="Performance Strategy" tagline="Speed is a feature we can measure. Every kilobyte is intentional." />
    <TableSimple
      head={['Budget', 'Marketing route', 'Admin route']}
      rows={[
        ['JS (first load)',   '≤ 90 KB gz',       '≤ 200 KB gz'],
        ['CSS',               '≤ 25 KB gz',       '≤ 40 KB gz'],
        ['Image (hero)',      '≤ 180 KB (AVIF)',  '—'],
        ['Font subset',       '≤ 40 KB (WOFF2)',  'Same, shared'],
        ['Third-party scripts','1 (Analytics)',    '2 max'],
      ]}
    />
    <H3>Tactics</H3>
    <UL>
      <li>Marketing pages are RSC + ISR; no client JS for content pages.</li>
      <li>Images via <code className="font-mono text-[12px] px-1 rounded bg-muted">next/image</code> in AVIF; hero uses <code className="font-mono text-[12px] px-1 rounded bg-muted">priority</code> + explicit sizes.</li>
      <li>Fonts: 2 families, subset to Latin, <code className="font-mono text-[12px] px-1 rounded bg-muted">font-display: swap</code>, preconnect.</li>
      <li>Video hero: MP4 (H.264) + WebM, poster frame is the LCP element.</li>
      <li>Route prefetch on hover for outcomes and booking.</li>
      <li>No client-side data fetching on marketing routes (streamed RSC only).</li>
      <li>Edge middleware for auth + geo; everything else server or static.</li>
    </UL>
  </>
);

const S17 = () => (
  <>
    <SectionHead id="cwv" num="17 · Delivery" title="Core Web Vitals Strategy" tagline="Targets that beat industry P75 by 25%." />
    <TableSimple
      head={['Metric', 'P75 target · marketing', 'P75 target · booking']}
      rows={[
        ['LCP',  '≤ 1.8s',   '≤ 2.2s'],
        ['INP',  '≤ 150ms',  '≤ 200ms'],
        ['CLS',  '≤ 0.02',   '≤ 0.05'],
        ['TTFB', '≤ 500ms',  '≤ 700ms'],
      ]}
    />
    <H3>Guardrails</H3>
    <UL>
      <li>Lighthouse CI budget-check on every PR.</li>
      <li>Real-user metrics via <code className="font-mono text-[12px] px-1 rounded bg-muted">web-vitals</code> to a lightweight endpoint.</li>
      <li>Any regression &gt; 5% on LCP or INP blocks deploy to production.</li>
    </UL>
  </>
);

const S18 = () => (
  <>
    <SectionHead id="imagery" num="18 · Delivery" title="Image Strategy" tagline="One editorial photographer. One consistent voice. No stock." />
    <H3>Art direction</H3>
    <UL>
      <li><b>Palette</b>: warm daylight, halite whites, muted greens. Never blue-hour blues.</li>
      <li><b>Subjects</b>: candid moments, not posed. Hands, feet, breath, water surfaces, salt textures.</li>
      <li><b>Framing</b>: negative space on the type side. Editorial (Aman-catalog) not lifestyle.</li>
      <li><b>Faces</b>: age-diverse; three ethnicities per outcome page; no obvious wellness clichés.</li>
      <li><b>Motion</b>: 8–12 second loops for hero video, no cuts.</li>
    </UL>
    <H3>Technical</H3>
    <UL>
      <li>Native aspect ratios: 3:2 editorial, 4:5 portrait, 16:9 video.</li>
      <li>AVIF primary, WebP fallback, JPEG last resort.</li>
      <li>Focal point stored per asset; drives all responsive crops.</li>
      <li>Every image has real alt text (banned: "photo," "image").</li>
      <li>OG image auto-generated at 1200 × 630 via <code className="font-mono text-[12px] px-1 rounded bg-muted">@vercel/og</code> using page title + brand mark.</li>
    </UL>
  </>
);

const S19 = () => (
  <>
    <SectionHead id="cro" num="19 · Delivery" title="CRO Strategy" tagline="Conversion is a byproduct of clarity, not friction." />
    <H3>Primary conversions (ranked)</H3>
    <OL>
      <li><b>Booking</b> — outcome-page slot picker; sticky mobile CTA.</li>
      <li><b>Membership signup</b> — highlighted on every pricing block.</li>
      <li><b>Gift card purchase</b> — dedicated route, one-page checkout.</li>
      <li><b>Corporate lead</b> — /for-teams inline form; auto-routes to sales.</li>
      <li><b>WhatsApp enquiry</b> — persistent chat pill on all outcome pages.</li>
      <li><b>Phone call</b> — click-to-call in nav on mobile.</li>
      <li><b>Newsletter</b> — one placement, footer only. Not intrusive.</li>
    </OL>
    <H3>Levers</H3>
    <UL>
      <li>Sticky booking bar (mobile) after hero scroll — measured to lift conversion 8–12% in similar categories.</li>
      <li>Exit-intent on outcome pages only, once per session, offering &quot;First session on us&quot; when member.</li>
      <li>Reviews with proof — Google logo + real names; no rotating carousels.</li>
      <li>Reciprocity: free 10-day sleep guide on Better Sleep outcome page (email capture, single-field).</li>
      <li>Social proof context: &quot;12 people booked stress relief this week&quot; (dynamic, honest).</li>
      <li>Objection handling: FAQ block on every outcome page, addressing pricing and legitimacy.</li>
    </UL>
    <H3>Experimentation</H3>
    <UL>
      <li>A/B via feature flags at the block level; template stays constant.</li>
      <li>Minimum 2-week runs; two-variant only; one metric per test.</li>
      <li>Winning variants become defaults in the CMS.</li>
    </UL>
  </>
);

const S20 = () => (
  <>
    <SectionHead id="ai" num="20 · Delivery" title="Future AI Roadmap" tagline="AI as a marketing multiplier, not a gimmick." />
    <H3>Immediate (post-launch, first 60 days)</H3>
    <UL>
      <li><b>Generate Landing Page</b>: prompt like &quot;Couple Activities Bangalore&quot; produces a full CMS draft — hero, copy, FAQ, packages, CTA, SEO, suggested imagery. Marketing edits, publishes.</li>
      <li><b>Rewrite this block</b>: any block has a &quot;Rewrite&quot; button with tone dial (editorial / clinical / warm).</li>
      <li><b>Alt-text generation</b> from image content on upload.</li>
      <li><b>FAQ suggestion</b>: given a page's title + outcome, suggest 6 FAQ pairs.</li>
      <li><b>Meta &amp; OG generator</b>: title/description/OG image auto-drafted per page.</li>
    </UL>
    <H3>Quarter 2</H3>
    <UL>
      <li><b>Personalized homepage hero</b>: if returning visitor last viewed &quot;stress relief,&quot; hero centers that outcome.</li>
      <li><b>Smart slot recommendation</b>: given a customer&apos;s history, propose the best next slot.</li>
      <li><b>Review synthesis</b>: turn 400 reviews into one distilled 3-sentence promise, per outcome.</li>
      <li><b>AI concierge (WhatsApp)</b>: books, reschedules, answers FAQs. Human handoff at $ &gt; ₹5,000 spend.</li>
    </UL>
    <H3>Quarter 3+</H3>
    <UL>
      <li>Multi-lingual outcome pages via LLM-authored translations with a native reviewer step.</li>
      <li>Copy quality scoring per page (readability, brand-voice adherence).</li>
      <li>Anomaly detection on booking drop-offs; alerts marketing.</li>
    </UL>
    <H3>Guardrails</H3>
    <UL>
      <li>Every AI output is a draft — never auto-published.</li>
      <li>Every AI output cites the prompt; auditable.</li>
      <li>PII never leaves our infra; anonymize before external LLM calls.</li>
    </UL>
  </>
);

/* -------------------------------- shell -------------------------------- */

const Sidebar = ({ active }) => (
  <aside className="no-print hidden lg:block w-72 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4">
    {NAV.map(g => (
      <div key={g.g} className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2 px-3">{g.g}</div>
        <nav className="space-y-0.5">
          {g.items.map(([id, label]) => {
            const Icon = ICONS[id] || Compass;
            const isActive = active === id;
            return (
              <a key={id} href={`#${id}`}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-all',
                  isActive ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </a>
            );
          })}
        </nav>
      </div>
    ))}
  </aside>
);

const Header = ({ dark, toggle }) => (
  <header className="no-print sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
    <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 h-14">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md grid place-items-center" style={{ background: '#0F766E' }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">Salt World · Strategy</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">v1.0 · Awaiting approval</div>
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Pill tone="warn">Draft — for review</Pill>
        <button onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 h-8 rounded-md border border-border hover:bg-muted transition-colors">
          <Printer className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button onClick={toggle} aria-label="Toggle theme" className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors">
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <Button variant="brand" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Approve & implement</Button>
      </div>
    </div>
  </header>
);

const Hero = () => (
  <div className="relative border-b border-border">
    <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />
    <div className="relative max-w-4xl mx-auto px-6 pt-14 pb-14">
      <div className="flex items-center gap-2 mb-4">
        <Pill tone="brand"><Sparkles className="h-3 w-3" /> Bengaluru · Wellness</Pill>
        <Pill>Apple · Aman · Airbnb · Stripe · Linear · Calm · Headspace</Pill>
      </div>
      <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]" style={{ fontFamily: 'Georgia, serif' }}>
        A wellness destination, <br className="hidden md:block" />
        redrawn from the outcome inward.
      </h1>
      <p className="mt-5 text-[16px] leading-8 text-muted-foreground max-w-2xl">
        Twenty strategic decisions that turn Salt World from a therapy menu into an outcomes destination —
        with a design language derived from the logo, a CMS engineered for velocity, and an AI roadmap
        that lets marketing ship pages without a developer.
      </p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['20',   'Strategic sections'],
          ['74',   'Components mapped'],
          ['60+',  'Programmatic pages'],
          ['≤1.8s','LCP target'],
        ].map(([k, v]) => (
          <div key={v} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-semibold tracking-tight">{k}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const App = () => {
  const { dark, toggle } = useTheme();
  const active = useActive();

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const idx = ALL_IDS.indexOf(active);
      if (e.key === 'j' && idx < ALL_IDS.length - 1) document.getElementById(ALL_IDS[idx + 1])?.scrollIntoView({ behavior: 'smooth' });
      else if (e.key === 'k' && idx > 0) document.getElementById(ALL_IDS[idx - 1])?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div className="min-h-screen">
      <Header dark={dark} toggle={toggle} />
      <Hero />
      <div className="max-w-[1400px] mx-auto px-6 flex gap-10">
        <Sidebar active={active} />
        <main className="flex-1 min-w-0 max-w-3xl py-10">
          <S1 /><S2 /><S3 /><S4 />
          <S5 /><S6 /><S7 /><S8 /><S9 />
          <S10 /><S11 /><S12 /><S13 /><S14 /><S15 />
          <S16 /><S17 /><S18 /><S19 /><S20 />
          <footer className="mt-20 pt-8 border-t border-border flex items-center justify-between text-[12.5px] text-muted-foreground">
            <div>Salt World · Strategy v1.0 · Awaiting approval</div>
            <div>Bengaluru</div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
