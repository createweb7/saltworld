import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Clock, Check, XCircle, Sparkles, Gift, Award } from 'lucide-react';
import { TopNav, SiteFooter, StickyBookingBar } from '@/components/site/shell';
import { getTherapy, allTherapies } from '@/lib/therapies';
import { getOutcome } from '@/lib/outcomes';
import { getDb } from '@/lib/mongo';

// Merge DB-configured ops fields (duration/price/description/images/SEO/heroImage)
// with the dev-controlled rich content in lib/therapies.js (whoFor, benefits,
// science, howItWorks, FAQs, gallery, related). DB is the source of truth for
// anything the marketing/ops team can edit; static content is version-controlled
// long-form copy.
async function loadTherapy(slug) {
  const staticData = getTherapy(slug);
  try {
    const db = await getDb();
    const dbDoc = await db.collection('therapies').findOne({ slug, active: { $ne: false } });
    if (!dbDoc) return staticData || null;
    const { _id, ...rest } = dbDoc;
    if (!staticData) {
      // DB-only therapy (added by admin later): synthesize minimal shape.
      return {
        slug: rest.slug,
        label: rest.name,
        eyebrow: 'Therapy',
        heroTagline: rest.description || '',
        heroBody: rest.description || '',
        heroImage: rest.heroImage || null,
        durationMin: rest.durationMin || 60,
        price: `₹${Number(rest.defaultPrice || 0).toLocaleString('en-IN')} / session`,
        seo: rest.seo || null,
        gallery: rest.images || [],
      };
    }
    // Merge: DB overrides for ops fields, static for rich content.
    return {
      ...staticData,
      durationMin: rest.durationMin ?? staticData.durationMin,
      price: rest.defaultPrice ? `₹${Number(rest.defaultPrice).toLocaleString('en-IN')} / session` : staticData.price,
      heroImage: rest.heroImage || staticData.heroImage,
      heroBody: rest.description || staticData.heroBody,
      seo: rest.seo || staticData.seo,
      gallery: (rest.images && rest.images.length) ? rest.images : staticData.gallery,
    };
  } catch (e) {
    console.error('therapy DB load failed, falling back to static', e);
    return staticData || null;
  }
}

export function generateStaticParams() {
  return allTherapies().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const t = await loadTherapy(slug);
  if (!t) return { title: 'Not found' };
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/therapies/${slug}`;
  return {
    title: t.seo?.title || `${t.label} · Salt World`,
    description: t.seo?.description || t.heroBody,
    alternates: { canonical: url },
    openGraph: {
      title: t.seo?.title || t.label,
      description: t.seo?.description || t.heroBody,
      url,
      images: t.heroImage ? [{ url: t.heroImage, alt: t.label }] : undefined,
      type: 'website',
    },
  };
}

export default async function TherapyLandingPage({ params }) {
  const { slug } = await params;
  const t = await loadTherapy(slug);
  if (!t) notFound();

  const journeys = (t.recommendedJourneys || []).map((slug) => getOutcome(slug)).filter(Boolean);

  // Structured data for SEO — MedicalTherapy schema.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalTherapy',
    name: t.label,
    description: t.seo?.description || t.heroBody,
    duration: `PT${t.durationMin}M`,
    provider: { '@type': 'HealthAndBeautyBusiness', name: 'Salt World', telephone: '+917687878793', email: 'info@saltworld.in', address: { '@type': 'PostalAddress', streetAddress: 'HSR Layout, Sector 3', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', postalCode: '560102', addressCountry: 'IN' } },
    offers: { '@type': 'Offer', priceCurrency: 'INR', price: t.price?.replace(/[^\d]/g, '') || '0' },
    mainEntity: t.faqs?.length ? { '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav transparentHero />

      {/* Hero */}
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        {t.heroImage && (
          <div className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.heroImage} alt="" className="h-full w-full object-cover opacity-25" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
          </div>
        )}
        <div className="max-w-[1080px] mx-auto px-5 md:px-8 relative">
          <Link href="/therapies" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> All therapies
          </Link>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{t.eyebrow}</div>
          <h1 className="mt-3 font-serif text-[46px] md:text-[76px] leading-[1.02] tracking-tight text-balance max-w-[900px]">
            {t.label}. <span className="italic">{t.heroTagline}</span>
          </h1>
          <p className="mt-6 text-[17px] md:text-[19px] leading-[1.55] text-muted-foreground max-w-[640px]">{t.heroBody}</p>
          <div className="mt-8 flex flex-wrap gap-3 items-center">
            <Link href={`/book?therapy=${t.slug}`} className="h-12 px-6 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center gap-2">Book a session <ArrowRight className="h-4 w-4" /></Link>
            <Link href={`/gifts?therapy=${t.slug}`} className="h-12 px-5 rounded-full border border-border text-[13.5px] font-medium hover:bg-muted inline-flex items-center gap-2"><Gift className="h-3.5 w-3.5" /> Gift this experience</Link>
            <div className="ml-auto text-[13px] text-muted-foreground flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {t.durationMin} minutes</span>
              <span className="font-mono">{t.price}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Who is it for */}
      {t.whoFor?.length > 0 && <Section eyebrow="Who is it for" title="Right for you if…">
        <ul className="grid gap-3 md:grid-cols-2">
          {t.whoFor.map((p, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="h-6 w-6 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3.5 w-3.5" /></div>
              <span className="text-[14.5px] leading-[1.5]">{p}</span>
            </li>
          ))}
        </ul>
      </Section>}

      {/* Benefits */}
      {t.benefits?.length > 0 && <Section eyebrow="Benefits" title="What lasts, beyond the session" muted>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {t.benefits.map((b, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-5">
              <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand inline-flex items-center justify-center mb-4"><Sparkles className="h-4 w-4" /></div>
              <div className="font-serif text-[19px] leading-tight tracking-tight">{b.title}</div>
              <div className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">{b.body}</div>
            </div>
          ))}
        </div>
      </Section>}

      {/* Science */}
      {t.science && <Section eyebrow="The science" title="Grounded in research">
        <p className="text-[16px] md:text-[17px] leading-[1.7] text-foreground/90 max-w-[820px]">{t.science}</p>
      </Section>}

      {/* How it works */}
      {t.howItWorks?.length > 0 && <Section eyebrow="How it works" title="Your session, hour by moment" muted>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {t.howItWorks.map((s) => (
            <div key={s.step} className="rounded-2xl bg-card border border-border p-5">
              <div className="font-mono text-[11px] text-muted-foreground tracking-widest">{s.step}</div>
              <div className="mt-2 font-serif text-[19px] leading-tight tracking-tight">{s.title}</div>
              <div className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">{s.body}</div>
            </div>
          ))}
        </div>
      </Section>}

      {/* Before / After */}
      {(t.beforeVisit?.length || t.afterVisit?.length) && <Section eyebrow="Your visit" title="Before &amp; after">
        <div className="grid gap-8 md:grid-cols-2">
          {t.beforeVisit && <BeforeAfterCard title="Before your visit" items={t.beforeVisit} />}
          {t.afterVisit  && <BeforeAfterCard title="After your visit"  items={t.afterVisit} />}
        </div>
      </Section>}

      {/* Contraindications */}
      {t.contraindications?.length > 0 && <Section eyebrow="Safety" title="Not recommended if you have" muted>
        <ul className="grid gap-2.5 md:grid-cols-2">
          {t.contraindications.map((c, i) => (
            <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.5]">
              <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[13px] text-muted-foreground">If in doubt, WhatsApp us at <a href="https://wa.me/917687878793" className="underline underline-offset-2">+91 76878 78793</a>. We’ll walk through your medical history and confirm suitability.</p>
      </Section>}

      {/* FAQs */}
      {t.faqs?.length > 0 && <Section eyebrow="FAQ" title="Common questions">
        <div className="max-w-[820px] divide-y divide-border rounded-2xl border border-border bg-card">
          {t.faqs.map((f, i) => (
            <details key={i} className="group p-5 md:p-6 open:bg-muted/30">
              <summary className="cursor-pointer list-none font-serif text-[18px] leading-tight tracking-tight flex items-center justify-between gap-4">
                {f.q} <span className="text-muted-foreground group-open:rotate-45 transition-transform text-[24px] leading-none">+</span>
              </summary>
              <p className="mt-3 text-[14.5px] leading-[1.65] text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>}

      {/* Gallery */}
      {t.gallery?.length > 0 && <Section eyebrow="Inside the sanctuary" title="A place, not just a service" muted>
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3">
          {t.gallery.map((src, i) => (
            <div key={i} className={`rounded-2xl overflow-hidden bg-muted ${i === 0 ? 'row-span-2 aspect-[3/4] md:aspect-[3/5]' : 'aspect-[4/3]'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </Section>}

      {/* Recommended journeys */}
      {journeys.length > 0 && <Section eyebrow="Recommended for" title="Best inside a full wellness journey">
        <div className="grid gap-4 md:grid-cols-3">
          {journeys.map((j) => (
            <Link key={j.slug} href={`/outcomes/${j.slug}`} className="group rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors">
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{j.eyebrow}</div>
              <div className="mt-2 font-serif text-[24px] leading-tight tracking-tight">{j.title}</div>
              <div className="mt-3 text-[13px] text-muted-foreground line-clamp-2">{j.hero?.subhead}</div>
              <div className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium group-hover:gap-1.5 transition-all">See the journey <ArrowRight className="h-3 w-3" /></div>
            </Link>
          ))}
        </div>
      </Section>}

      {/* Related therapies */}
      {t.relatedTherapies?.length > 0 && <Section eyebrow="Pairs well with" title="Combine for a compound effect" muted>
        <div className="grid gap-4 md:grid-cols-3">
          {t.relatedTherapies.slice(0, 3).map((s) => {
            const r = getTherapy(s); if (!r) return null;
            return (
              <Link key={s} href={`/therapies/${s}`} className="group rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition-colors">
                <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{r.eyebrow}</div>
                <div className="mt-2 font-serif text-[22px] leading-tight tracking-tight">{r.label}</div>
                <div className="mt-2 text-[12.5px] text-muted-foreground line-clamp-2">{r.heroTagline}</div>
                <div className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium group-hover:gap-1.5 transition-all">Read <ArrowRight className="h-3 w-3" /></div>
              </Link>
            );
          })}
        </div>
      </Section>}

      {/* Membership CTA */}
      <section className="py-16 md:py-24 border-t border-border">
        <div className="max-w-[900px] mx-auto text-center px-5 md:px-8">
          <div className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-brand/10 text-brand text-[10.5px] font-semibold uppercase tracking-[0.16em]"><Award className="h-3 w-3" /> Members save 60%</div>
          <h3 className="mt-4 font-serif text-[34px] md:text-[46px] leading-[1.05] tracking-tight">Rituals compound. Memberships too.</h3>
          <p className="mt-4 text-[15px] md:text-[16.5px] text-muted-foreground max-w-[560px] mx-auto leading-[1.55]">One monthly rhythm. Every therapy. Priority booking, a personalised protocol, and a therapist who knows your name.</p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Link href="/memberships" className="h-11 px-5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 text-[14px] font-semibold">See memberships <ArrowRight className="h-4 w-4" /></Link>
            <Link href={`/book?therapy=${t.slug}`} className="h-11 px-5 rounded-full border border-border text-[14px] font-medium hover:bg-muted transition-colors">Book a single session</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyBookingBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

function Section({ eyebrow, title, muted, children }) {
  return (
    <section className={`py-16 md:py-24 border-t border-border ${muted ? 'bg-muted/30' : ''}`}>
      <div className="max-w-[1080px] mx-auto px-5 md:px-8">
        <div className="mb-8 md:mb-10">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{eyebrow}</div>
          <h2 className="mt-2 font-serif text-[30px] md:text-[42px] leading-[1.05] tracking-tight text-balance">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function BeforeAfterCard({ title, items }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="font-serif text-[22px] leading-tight tracking-tight mb-4">{title}</div>
      <ul className="space-y-2.5">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-start gap-3 text-[14px] leading-[1.55]">
            <div className="h-5 w-5 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3" /></div>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
