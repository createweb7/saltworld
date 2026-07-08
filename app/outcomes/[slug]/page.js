import { notFound } from 'next/navigation';
import OutcomeTemplate from '@/components/site/outcome-template';
import { OUTCOMES, getOutcome } from '@/lib/outcomes';

export const dynamicParams = false; // Only pre-defined outcomes.
export const revalidate = 3600;

export function generateStaticParams() {
  return OUTCOMES.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const o = getOutcome(slug);
  if (!o) return { title: 'Not found' };
  const title = `${o.title} in Bengaluru · Salt World`;
  const description = o.hero.subhead;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/outcomes/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type: 'article',
      images: [{ url: o.protocol?.image, width: 1600, height: 1200, alt: o.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [o.protocol?.image] },
  };
}

export default async function OutcomePage({ params }) {
  const { slug } = await params;
  const outcome = getOutcome(slug);
  if (!outcome) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${base}/outcomes/${slug}`,
        name: `${outcome.title} in Bengaluru · Salt World`,
        description: outcome.hero.subhead,
        url: `${base}/outcomes/${slug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',     item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Outcomes', item: `${base}/#outcomes` },
          { '@type': 'ListItem', position: 3, name: outcome.title },
        ],
      },
      {
        '@type': 'Service',
        name: outcome.title,
        provider: { '@type': 'HealthAndBeautyBusiness', name: 'Salt World', areaServed: 'Bengaluru' },
        description: outcome.hero.subhead,
        offers: [
          { '@type': 'Offer', name: outcome.pricing.single.name,     price: outcome.pricing.single.price.replace(/[^\d]/g,''),     priceCurrency: 'INR' },
          { '@type': 'Offer', name: outcome.pricing.pack.name,       price: outcome.pricing.pack.price.replace(/[^\d]/g,''),       priceCurrency: 'INR' },
          { '@type': 'Offer', name: outcome.pricing.membership.name, price: outcome.pricing.membership.price.replace(/[^\d]/g,''), priceCurrency: 'INR' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: outcome.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <OutcomeTemplate slug={slug} />
    </>
  );
}
