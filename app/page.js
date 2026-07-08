'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, IconButton, Badge, Pill, Card, CardHeader, CardTitle, CardDescription,
  CardBody, CardFooter, StatCard, Divider, Kbd,
} from '@/components/ss/primitives';
import {
  Field, Input, Textarea, Select, Checkbox, Radio, Switch,
} from '@/components/ss/forms';
import {
  HeroSection, CTASection, PricingCard, TestimonialCard,
} from '@/components/ss/marketing';
import {
  COLORS, TYPE_SCALE, SPACING, RADIUS, ELEVATION, MOTION,
} from '@/components/ss/tokens';
import {
  Sparkles, Moon, Sun, Printer, Copy, Check, Search, ArrowRight, Plus,
  Trash2, Mail, Bell, Bookmark, TrendingUp, TrendingDown, Users, IndianRupee,
  Palette, Type, Ruler, Square, Layers, Zap, MousePointerClick,
  ToggleRight, LayoutGrid, ChevronRight, BookOpenText, Copyright,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';

/* ============================== Docs shell ============================== */

const NAV = [
  {
    group: 'Foundations',
    items: [
      { id: 'typography',  title: 'Typography', icon: Type },
      { id: 'colors',      title: 'Colors',     icon: Palette },
      { id: 'spacing',     title: 'Spacing',    icon: Ruler },
      { id: 'radius',      title: 'Radius',     icon: Square },
      { id: 'elevation',   title: 'Elevation',  icon: Layers },
      { id: 'motion',      title: 'Motion',     icon: Zap },
    ],
  },
  {
    group: 'Primitives',
    items: [
      { id: 'buttons',   title: 'Buttons',    icon: MousePointerClick },
      { id: 'badges',    title: 'Badges & Pills', icon: Bookmark },
      { id: 'cards',     title: 'Cards',      icon: LayoutGrid },
      { id: 'statcards', title: 'Stat Cards', icon: TrendingUp },
    ],
  },
  {
    group: 'Forms',
    items: [
      { id: 'inputs',    title: 'Inputs',       icon: Type },
      { id: 'selection', title: 'Selection',    icon: ToggleRight },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { id: 'hero',        title: 'Hero',        icon: Sparkles },
      { id: 'cta',         title: 'CTA',         icon: ArrowRight },
      { id: 'pricing',     title: 'Pricing',     icon: IndianRupee },
      { id: 'testimonial', title: 'Testimonial', icon: Users },
    ],
  },
];
const ALL_IDS = NAV.flatMap(g => g.items.map(i => i.id));

function useActive() {
  const [active, setActive] = useState(ALL_IDS[0]);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-96px 0px -70% 0px', threshold: [0, 1] });
    ALL_IDS.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return active;
}

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

/* ============================== Story block ============================== */

const CodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="font-mono text-[12px] leading-6 bg-[hsl(222,24%,4%)] text-zinc-100 p-4 rounded-lg overflow-x-auto border border-border/60">
{code}
      </pre>
      <button onClick={copy}
        className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 h-7 px-2 rounded-md border border-white/10 bg-white/5 text-zinc-200 text-[11px] hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );
};

const Story = ({ title, description, code, canvasClass, children }) => (
  <div className="my-6 first:mt-0">
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
        {description && <div className="text-[12.5px] text-muted-foreground mt-0.5">{description}</div>}
      </div>
    </div>
    <div className={cn('rounded-xl border border-border bg-card p-6 md:p-8 flex items-center justify-center flex-wrap gap-4 min-h-[120px]', canvasClass)}>
      {children}
    </div>
    {code && <div className="mt-2"><CodeBlock code={code} /></div>}
  </div>
);

const SectionHead = ({ id, eyebrow, title, description }) => (
  <div id={id} className="scroll-mt-24 pt-14 first:pt-2">
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{eyebrow}</div>
    <h2 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
    {description && <p className="mt-2 text-[14.5px] leading-7 text-muted-foreground max-w-2xl">{description}</p>}
    <Divider className="mt-6" />
  </div>
);

/* ============================== Foundations ============================== */

const Typography = () => (
  <>
    <SectionHead id="typography" eyebrow="Foundations" title="Typography"
      description="Inter for UI, JetBrains Mono for code. A single, opinionated type scale. No arbitrary sizes anywhere in the app." />
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <table className="w-full text-left text-[13.5px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Style</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Preview</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Size</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Usage</th>
          </tr>
        </thead>
        <tbody>
          {TYPE_SCALE.map(t => (
            <tr key={t.name} className="border-t border-border">
              <td className="px-4 py-3 font-medium text-foreground w-32">{t.name}</td>
              <td className="px-4 py-3"><span className={t.cls}>Breathe better</span></td>
              <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{t.px}px</td>
              <td className="px-4 py-3 text-muted-foreground">{t.usage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

const Colors = () => (
  <>
    <SectionHead id="colors" eyebrow="Foundations" title="Colors"
      description="HSL tokens map to Tailwind semantic classes. Themes adjust luminance only — never invent new colors in components." />
    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
      {COLORS.map(c => (
        <div key={c.name} className="rounded-lg border border-border overflow-hidden bg-card">
          <div className={cn('h-16 w-full', c.css)} />
          <div className="p-3">
            <div className="font-mono text-[12px] text-foreground">{c.name}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{c.desc}</div>
          </div>
        </div>
      ))}
    </div>
  </>
);

const Spacing = () => (
  <>
    <SectionHead id="spacing" eyebrow="Foundations" title="Spacing"
      description="4-point base grid with an expressive scale for larger rhythms. Use Tailwind numeric utilities (p-1 = 4px, p-4 = 16px)." />
    <div className="mt-6 rounded-xl border border-border p-6 bg-card space-y-2.5">
      {SPACING.map(s => (
        <div key={s.name} className="flex items-center gap-4">
          <div className="w-8 font-mono text-[12px] text-muted-foreground">{s.name}</div>
          <div className="h-2 rounded-full bg-foreground" style={{ width: `${Math.max(s.px, 2)}px` }} />
          <div className="font-mono text-[12px] text-muted-foreground">{s.px}px</div>
        </div>
      ))}
    </div>
  </>
);

const Radii = () => (
  <>
    <SectionHead id="radius" eyebrow="Foundations" title="Radius"
      description="A restrained set of corner radii for consistency across surfaces." />
    <div className="mt-6 grid grid-cols-3 md:grid-cols-6 gap-3">
      {RADIUS.map(r => (
        <div key={r.name} className="flex flex-col items-center gap-2">
          <div className={cn('h-16 w-16 bg-foreground', r.cls)} />
          <div className="font-mono text-[11.5px] text-foreground">{r.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{r.px}px</div>
        </div>
      ))}
    </div>
  </>
);

const Elevation = () => (
  <>
    <SectionHead id="elevation" eyebrow="Foundations" title="Elevation"
      description="Hairlines over shadows. Shadows reserved for interactive lift and modal chrome." />
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      {ELEVATION.map(e => (
        <div key={e.name} className={cn('rounded-xl bg-card p-5 min-h-[110px]', e.cls)}>
          <div className="font-mono text-[12.5px] text-foreground">{e.name}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1">{e.desc}</div>
        </div>
      ))}
    </div>
  </>
);

const Motion = () => (
  <>
    <SectionHead id="motion" eyebrow="Foundations" title="Motion"
      description="Speed is a feature. Ease-out curves for anything driven by user intent." />
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <table className="w-full text-left text-[13.5px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Token</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Duration</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Easing</th>
            <th className="px-4 py-2.5 font-medium text-[12px] uppercase tracking-wider text-muted-foreground">Usage</th>
          </tr>
        </thead>
        <tbody>
          {MOTION.map(m => (
            <tr key={m.name} className="border-t border-border">
              <td className="px-4 py-3 font-mono text-foreground">{m.name}</td>
              <td className="px-4 py-3 font-mono text-muted-foreground">{m.ms}ms</td>
              <td className="px-4 py-3 font-mono text-muted-foreground">{m.ease}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.usage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

/* ============================== Primitives ============================== */

const Buttons = () => (
  <>
    <SectionHead id="buttons" eyebrow="Primitives" title="Buttons"
      description="Seven variants × three sizes. Every button supports loading, iconLeft, iconRight, and disabled states." />
    <Story title="Variants" description="Primary is the app's default. Brand is reserved for high-intent marketing surfaces."
      code={`<Button variant="primary">Book a session</Button>
<Button variant="secondary">Learn more</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Skip</Button>
<Button variant="brand">Claim offer</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">View details</Button>`}>
      <Button variant="primary">Book a session</Button>
      <Button variant="secondary">Learn more</Button>
      <Button variant="outline">Cancel</Button>
      <Button variant="ghost">Skip</Button>
      <Button variant="brand">Claim offer</Button>
      <Button variant="destructive" iconLeft={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
      <Button variant="link">View details</Button>
    </Story>
    <Story title="Sizes" code={`<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </Story>
    <Story title="With icons & loading"
      code={`<Button iconLeft={<Mail />}>Email us</Button>
<Button iconRight={<ArrowRight />}>Continue</Button>
<Button loading>Saving</Button>
<Button disabled>Disabled</Button>`}>
      <Button iconLeft={<Mail className="h-3.5 w-3.5" />}>Email us</Button>
      <Button iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Continue</Button>
      <Button loading>Saving</Button>
      <Button disabled>Disabled</Button>
    </Story>
    <Story title="Icon buttons" code={`<IconButton><Bell /></IconButton>
<IconButton variant="outline"><Plus /></IconButton>`}>
      <IconButton variant="outline"><Bell className="h-3.5 w-3.5" /></IconButton>
      <IconButton variant="outline"><Plus className="h-3.5 w-3.5" /></IconButton>
      <IconButton variant="ghost"><Search className="h-3.5 w-3.5" /></IconButton>
      <IconButton variant="primary"><ArrowRight className="h-3.5 w-3.5" /></IconButton>
    </Story>
  </>
);

const Badges = () => (
  <>
    <SectionHead id="badges" eyebrow="Primitives" title="Badges & Pills"
      description="Semantic status markers. Same tones for both shapes — pick shape by context (badges in tables, pills in hero sections)." />
    <Story title="Tones" code={`<Badge tone="brand">New</Badge>
<Badge tone="success">Confirmed</Badge>
<Badge tone="warn">Pending</Badge>
<Badge tone="danger">Failed</Badge>`}>
      <Badge>Default</Badge>
      <Badge tone="brand">New</Badge>
      <Badge tone="success">Confirmed</Badge>
      <Badge tone="warn">Pending</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="neutral">Draft</Badge>
    </Story>
    <Story title="Pills" code={`<Pill tone="brand"><Sparkles /> Bengaluru</Pill>`}>
      <Pill><Sparkles className="h-3 w-3" /> Salt World</Pill>
      <Pill tone="brand">Bengaluru</Pill>
      <Pill tone="success">Live</Pill>
      <Pill tone="warn">Beta</Pill>
    </Story>
  </>
);

const Cards = () => (
  <>
    <SectionHead id="cards" eyebrow="Primitives" title="Cards"
      description="Composable surfaces. Compose Header / Title / Description / Body / Footer as needed." />
    <Story title="Basic card" canvasClass="!items-stretch"
      code={`<Card>
  <CardHeader>
    <CardTitle>Halotherapy — 45 min</CardTitle>
    <CardDescription>Adult single session</CardDescription>
  </CardHeader>
  <CardBody>Deep salt inhalation in a controlled micro-climate.</CardBody>
  <CardFooter>
    <span className="text-sm font-medium">₹1,499</span>
    <Button size="sm">Book</Button>
  </CardFooter>
</Card>`}>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Halotherapy — 45 min</CardTitle>
          <CardDescription>Adult single session</CardDescription>
        </CardHeader>
        <CardBody>Deep salt inhalation in a controlled micro-climate. Ideal for respiratory wellness and stress relief.</CardBody>
        <CardFooter>
          <span className="text-[15px] font-semibold">₹1,499</span>
          <Button size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Book</Button>
        </CardFooter>
      </Card>
      <Card className="w-full max-w-sm" elevation="raised" interactive>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Family package</CardTitle>
            <Badge tone="brand">Popular</Badge>
          </div>
          <CardDescription>4 sessions · valid 60 days</CardDescription>
        </CardHeader>
        <CardBody>Share the benefits of salt therapy with those closest to you.</CardBody>
        <CardFooter>
          <span className="text-[15px] font-semibold">₹4,999</span>
          <Button size="sm" variant="brand">Choose</Button>
        </CardFooter>
      </Card>
    </Story>
  </>
);

const StatCards = () => (
  <>
    <SectionHead id="statcards" eyebrow="Primitives" title="Stat Cards"
      description="KPI blocks for the admin dashboard. Numbers up front, deltas next to them, secondary context below." />
    <Story title="Dashboard KPIs" canvasClass="!p-0 !bg-transparent !border-0"
      code={`<StatCard label="Revenue" value="₹8.4L" delta="+12.3%" icon={IndianRupee} footer="vs last 30 days" />`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
        <StatCard label="Revenue" value="₹8.4L" delta="+12.3%" icon={IndianRupee} footer="vs last 30 days" />
        <StatCard label="Bookings" value="1,284" delta="+8.1%" icon={BookOpenText} footer="vs last 30 days" />
        <StatCard label="Occupancy" value="72%" delta="-2.4%" deltaTone="danger" icon={TrendingDown} footer="across 3 rooms" />
        <StatCard label="New members" value="93" delta="+21%" icon={Users} footer="this month" />
      </div>
    </Story>
  </>
);

/* ============================== Forms ============================== */

const Inputs = () => (
  <>
    <SectionHead id="inputs" eyebrow="Forms" title="Inputs"
      description="Field wraps every input with label, hint, and error — the only sanctioned way to build forms." />
    <Story title="Text, textarea, select" canvasClass="!items-stretch !justify-start"
      code={`<Field label="Full name" hint="As on ID" required>
  <Input placeholder="Anaya Rao" />
</Field>`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
        <Field label="Full name" hint="As on ID" required>
          <Input placeholder="Anaya Rao" />
        </Field>
        <Field label="Email" required>
          <Input type="email" placeholder="you@saltworld.in" iconLeft={<Mail className="h-3.5 w-3.5" />} />
        </Field>
        <Field label="Preferred therapy">
          <Select defaultValue="halo">
            <option value="halo">Halotherapy</option>
            <option value="floatation">Floatation</option>
            <option value="aroma">Aromatherapy</option>
          </Select>
        </Field>
        <Field label="Phone" error="Enter a valid 10-digit number">
          <Input invalid defaultValue="98" />
        </Field>
        <Field label="Notes for therapist" className="md:col-span-2">
          <Textarea placeholder="Anything we should know before your session?" />
        </Field>
      </div>
    </Story>
  </>
);

const Selection = () => (
  <>
    <SectionHead id="selection" eyebrow="Forms" title="Selection"
      description="Checkbox, Radio, Switch. All support label + description in a single call." />
    <Story title="Choices" canvasClass="!items-stretch !justify-start"
      code={`<Checkbox label="Send WhatsApp reminders" description="24h before your session" defaultChecked />
<Radio name="slot" label="6:00 PM" defaultChecked />
<Switch label="Email receipts" defaultChecked />`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        <div className="space-y-3">
          <div className="text-[11.5px] uppercase tracking-wider font-medium text-muted-foreground">Checkboxes</div>
          <Checkbox label="Send WhatsApp reminders" description="24h before your session" defaultChecked />
          <Checkbox label="Newsletter" description="Weekly wellness tips" />
          <Checkbox label="Terms & conditions" required />
        </div>
        <div className="space-y-3">
          <div className="text-[11.5px] uppercase tracking-wider font-medium text-muted-foreground">Radio group</div>
          <Radio name="slot" label="5:00 PM" description="1 seat left" />
          <Radio name="slot" label="6:00 PM" description="3 seats left" defaultChecked />
          <Radio name="slot" label="7:00 PM" description="Available" />
        </div>
        <div className="space-y-3">
          <div className="text-[11.5px] uppercase tracking-wider font-medium text-muted-foreground">Switches</div>
          <Switch label="Email receipts" description="Sent after each session" defaultChecked />
          <Switch label="Two-factor auth" description="Recommended for admins" />
          <Switch label="Marketing SMS" />
        </div>
      </div>
    </Story>
  </>
);

/* ============================== Marketing ============================== */

const HeroStory = () => (
  <>
    <SectionHead id="hero" eyebrow="Marketing" title="Hero"
      description="The customer website's most important surface. Content-first, restrained chrome, one primary action." />
    <Story title="Default hero" canvasClass="!p-3"
      code={`<HeroSection
  eyebrow="Halotherapy · Bengaluru"
  title="Breathe better. Live lighter."
  subtitle="Book your first session in under a minute."
  primaryCta={{ label: 'Book a session' }}
  secondaryCta={{ label: 'Explore therapies' }}
/>`}>
      <div className="w-full">
        <HeroSection />
      </div>
    </Story>
  </>
);

const CTAStory = () => (
  <>
    <SectionHead id="cta" eyebrow="Marketing" title="CTA"
      description="Reusable conversion block. Default and inverted variants for light/dark page rhythms." />
    <Story title="Default" canvasClass="!p-3"
      code={`<CTASection title="Start your wellness journey today" subtitle="Your first session is on us." />`}>
      <div className="w-full"><CTASection /></div>
    </Story>
    <Story title="Inverted" canvasClass="!p-3"
      code={`<CTASection variant="inverted" />`}>
      <div className="w-full"><CTASection variant="inverted" /></div>
    </Story>
  </>
);

const PricingStory = () => (
  <>
    <SectionHead id="pricing" eyebrow="Marketing" title="Pricing"
      description="Composable pricing tiles. Set featured to elevate the recommended plan." />
    <Story title="Three tiers" canvasClass="!p-3 !items-stretch"
      code={`<PricingCard name="Wellness" price="₹3,499" featured />`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <PricingCard
          name="Essential" price="₹1,499" period="/ session"
          description="Single session, no commitment."
          features={['1 halotherapy session', 'Full room access', 'Post-session herbal tea']}
          cta="Book once"
        />
        <PricingCard featured />
        <PricingCard
          name="Family" price="₹6,999" period="/ month"
          description="Up to 4 members, shared sessions."
          features={['16 sessions per month', 'Up to 4 family members', 'Free wellness consult (monthly)', '15% off retail store']}
          cta="Choose plan"
        />
      </div>
    </Story>
  </>
);

const TestimonialStory = () => (
  <>
    <SectionHead id="testimonial" eyebrow="Marketing" title="Testimonial"
      description="Quote-first card. Author, role, and rating anchor credibility." />
    <Story title="Three testimonials" canvasClass="!p-3 !items-stretch"
      code={`<TestimonialCard quote="..." author="Anaya Rao" role="Member · Indiranagar" />`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <TestimonialCard />
        <TestimonialCard
          quote="The team knows me by name. Sunday sessions have become non-negotiable."
          author="Rohan Menon" role="Member · Koramangala" rating={5}
        />
        <TestimonialCard
          quote="Booking is instant. The space is immaculate. I recommend it to every parent I know."
          author="Divya Iyer" role="Member · HSR Layout" rating={5}
        />
      </div>
    </Story>
  </>
);

/* ============================== Layout ============================== */

const Header = ({ dark, toggle }) => (
  <header className="no-print sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
    <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 h-14">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-md bg-foreground text-background grid place-items-center">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">Salt World · Design System</div>
          <div className="text-[11px] text-muted-foreground -mt-0.5">v1.0 · Phase 1</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Kbd>J</Kbd><Kbd>K</Kbd> navigate
        </div>
        <button onClick={() => window.print()}
          className="hidden sm:inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 h-8 rounded-md border border-border hover:bg-muted transition-colors">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button onClick={toggle} aria-label="Toggle theme"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors">
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  </header>
);

const Sidebar = ({ active }) => (
  <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4">
    {NAV.map(group => (
      <div key={group.group} className="mb-5">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-3">{group.group}</div>
        <nav className="space-y-0.5">
          {group.items.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <a key={item.id} href={`#${item.id}`}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-all',
                  isActive
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.title}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </a>
            );
          })}
        </nav>
      </div>
    ))}
  </aside>
);

const Hero = () => (
  <div className="relative border-b border-border">
    <div className="absolute inset-0 grid-bg pointer-events-none" />
    <div className="relative max-w-4xl mx-auto px-6 pt-14 pb-12">
      <div className="flex items-center gap-2 mb-4">
        <Pill tone="brand"><Sparkles className="h-3 w-3" /> Design System</Pill>
        <Pill>Apple · Stripe · Linear · Airbnb</Pill>
      </div>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">The Salt World library.</h1>
      <p className="mt-4 text-[15.5px] leading-7 text-muted-foreground max-w-2xl">
        Every button, every field, every hero — documented, tokenized, and ready to compose.
        Import from <span className="font-mono text-foreground">@/components/ss</span> and ship any page in minutes, without inventing a single new pixel.
      </p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['4', 'Foundations'],
          ['12+', 'Primitives & forms'],
          ['4', 'Marketing blocks'],
          ['100%', 'Reusable'],
        ].map(([k, v]) => (
          <div key={v} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xl font-semibold tracking-tight">{k}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ============================== Page ============================== */

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
      <div className="max-w-[1400px] mx-auto px-6 flex gap-8">
        <Sidebar active={active} />
        <main className="flex-1 min-w-0 max-w-3xl py-8">
          <Typography /><Colors /><Spacing /><Radii /><Elevation /><Motion />
          <Buttons /><Badges /><Cards /><StatCards />
          <Inputs /><Selection />
          <HeroStory /><CTAStory /><PricingStory /><TestimonialStory />
          <footer className="mt-20 pt-8 border-t border-border text-[12.5px] text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Copyright className="h-3.5 w-3.5" /> Salt World Design System · v1.0</div>
            <div>Bengaluru</div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
