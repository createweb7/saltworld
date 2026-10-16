'use client';
import { HeroSection, CTASection, PricingCard, TestimonialCard } from './marketing';
import { cn } from './utils';

const Section = ({ children, className }) => (
  <section className={cn('py-10 md:py-14 px-4 md:px-8', className)}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

export const BLOCK_META = {
  hero:          { label: 'Hero',        editable: ['eyebrow','title','subtitle','primaryCtaLabel','secondaryCtaLabel','heroImage'] },
  content:       { label: 'Content',     editable: ['title','html'] },
  cta:           { label: 'CTA',         editable: ['title','subtitle','primaryCtaLabel','secondaryCtaLabel','variant'] },
  pricing:       { label: 'Pricing',     editable: ['title','subtitle','tiles'] },
  testimonials:  { label: 'Testimonials',editable: ['title','items'] },
};

export const renderBlock = (b) => {
  const p = b.props || {};
  switch (b.type) {
    case 'hero':
      return (
        <Section>
          <HeroSection
            eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle}
            primaryCta={{ label: p.primaryCtaLabel || 'Get started', href: p.primaryCtaHref }}
            secondaryCta={{ label: p.secondaryCtaLabel || 'Learn more', href: p.secondaryCtaHref }}
            media={p.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.heroImage} alt={p.heroImageAlt || ''} className="h-full w-full object-cover" loading="eager" />
            ) : undefined}
          />
        </Section>
      );
    case 'content':
      return (
        <Section>
          <div className="max-w-[760px] mx-auto">
            {p.title && <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-6">{p.title}</h2>}
            <div
              className="prose prose-sm max-w-none [&_h2]:font-serif [&_h2]:font-bold [&_h2]:mt-8 [&_h3]:font-serif [&_h3]:font-bold [&_h3]:text-[15px] [&_h3]:mt-6 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 text-[13px] leading-[1.65] text-foreground/90"
              dangerouslySetInnerHTML={{ __html: p.html || '' }}
            />
          </div>
        </Section>
      );
    case 'cta':
      return (
        <Section>
          <CTASection
            title={p.title} subtitle={p.subtitle}
            primaryCta={{ label: p.primaryCtaLabel || 'Book', href: p.primaryCtaHref }}
            secondaryCta={{ label: p.secondaryCtaLabel || 'Talk to us', href: p.secondaryCtaHref }}
            variant={p.variant || 'default'}
          />
        </Section>
      );
    case 'pricing':
      return (
        <Section>
          {(p.title || p.subtitle) && (
            <div className="text-center mb-8">
              {p.title && <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{p.title}</h2>}
              {p.subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{p.subtitle}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(p.tiles || []).map((t, i) => (
              <PricingCard key={i} name={t.name} price={t.price} period={t.period}
                description={t.description} features={t.features} cta={t.cta} featured={!!t.featured} />
            ))}
          </div>
        </Section>
      );
    case 'testimonials':
      return (
        <Section>
          {p.title && <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-8">{p.title}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(p.items || []).map((t, i) => (
              <TestimonialCard key={i} quote={t.quote} author={t.author} role={t.role} rating={t.rating || 5} />
            ))}
          </div>
        </Section>
      );
    default:
      return <div className="p-4 text-sm text-muted-foreground">Unknown block: {b.type}</div>;
  }
};

// renderBlock is a plain function, not a component — calling it directly
// from a server component throws ("client function invoked on server").
// SectionList wraps it so a server component can render a subset of a
// page's sections as JSX (<SectionList sections={...} />) instead.
export const SectionList = ({ sections }) => (
  <>{(sections || []).map((b) => <div key={b.id}>{renderBlock(b)}</div>)}</>
);

export const PageRenderer = ({ page }) => (
  <div className="bg-background">
    {(page?.sections || []).map((b) => (
      <div key={b.id} data-block-id={b.id}>{renderBlock(b)}</div>
    ))}
  </div>
);
