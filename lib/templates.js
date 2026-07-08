// Preset landing-page templates for Salt World.
// Every template = an ordered list of blocks the design-system can render.

const hero = (title, subtitle, eyebrow, primary = 'Book now', secondary = 'Explore') => ({
  type: 'hero', props: { eyebrow, title, subtitle, primaryCtaLabel: primary, secondaryCtaLabel: secondary },
});
const cta = (title, subtitle, variant = 'default') => ({
  type: 'cta', props: { title, subtitle, primaryCtaLabel: 'Book a session', secondaryCtaLabel: 'Talk to us', variant },
});
const pricing = (tiles) => ({ type: 'pricing', props: { title: 'Choose your rhythm', subtitle: 'Simple, transparent pricing.', tiles } });
const tst = (items) => ({ type: 'testimonials', props: { title: 'Loved in Bengaluru', items } });

export const TEMPLATES = [
  {
    id: 'couple-activities',
    name: 'Couple Activities',
    description: 'A shared wellness experience for two.',
    accent: 'Date-night wellness',
    build: () => [
      hero('Bengaluru', 'A wellness date, unlike anything else.', 'Couple Activities · Bengaluru', 'Book for two', 'See what’s included'),
      pricing([
        { name: 'Duo', price: '₹2,999', period: '/ session', features: ['45-min salt session for 2', 'Private room', 'Post-session herbal tea'], cta: 'Book duo' },
        { name: 'Evening ritual', price: '₹4,999', period: '/ session', features: ['60-min salt + aroma', 'Private room', 'Wine-free wellness pairing', 'Take-home wellness kit'], cta: 'Book ritual', featured: true },
        { name: 'Weekend escape', price: '₹7,999', period: '/ package', features: ['3 sessions over a weekend', 'Priority slots', 'Complimentary consult'], cta: 'Book weekend' },
      ]),
      tst([
        { quote: 'Best anniversary idea in years.', author: 'Aditi & Kabir', role: 'Members · Indiranagar', rating: 5 },
        { quote: 'Ninety quiet minutes we didn’t know we needed.', author: 'Priya & Arjun', role: 'Members · Koramangala', rating: 5 },
      ]),
      cta('Reserve your evening', 'Weekend evenings fill up quickly.', 'inverted'),
    ],
    seo: { metaTitle: 'Couple Wellness · Salt World Bengaluru', metaDescription: 'A shared halotherapy experience for two, in the heart of Bengaluru.' },
  },
  {
    id: 'experience-gifts',
    name: 'Experience Gifts',
    description: 'Gift wellness. Sent instantly.',
    accent: 'Give the gift of calm',
    build: () => [
      hero('The gift of calm', 'Digital wellness gift cards. Delivered in seconds.', 'Experience Gifts', 'Send a gift', 'Browse denominations'),
      pricing([
        { name: 'Starter', price: '₹1,499', period: 'gift card', features: ['1 single session', 'Delivered via email + WhatsApp', 'No expiry for 12 months'], cta: 'Send ₹1,499' },
        { name: 'Signature', price: '₹4,999', period: 'gift card', features: ['3 sessions', 'Personalised message', 'Redeemable across all therapies'], cta: 'Send ₹4,999', featured: true },
        { name: 'Grand', price: '₹9,999', period: 'gift card', features: ['7 sessions', 'Two personalised messages', 'Free wellness consult included'], cta: 'Send ₹9,999' },
      ]),
      cta('Need help picking a gift?', 'Our team will guide you — usually within an hour.'),
    ],
    seo: { metaTitle: 'Wellness Gift Cards · Salt World', metaDescription: 'Instantly delivered gift cards for halotherapy sessions and wellness experiences in Bengaluru.' },
  },
  {
    id: 'stress-relief',
    name: 'Stress Relief',
    description: 'A dedicated path for high-stress lifestyles.',
    accent: 'Rest for busy minds',
    build: () => [
      hero('Calmer starts here', 'Forty-five minutes of guided breath and salt — the fastest way back to yourself.', 'Stress Relief', 'Book my reset', 'How it works'),
      tst([
        { quote: 'My Sunday reset. Non-negotiable.', author: 'Rohan Menon', role: 'Product Manager', rating: 5 },
        { quote: 'I sleep the same night as my session.', author: 'Sneha Kulkarni', role: 'Founder', rating: 5 },
        { quote: 'Ninety-nine percent quieter than my inbox.', author: 'Arun Bhat', role: 'Engineer', rating: 5 },
      ]),
      cta('Ready for your first quiet 45 minutes?', 'Your first session is on us.'),
    ],
    seo: { metaTitle: 'Stress Relief · Salt World Bengaluru', metaDescription: 'Guided halotherapy for high-stress lifestyles. Fast, science-backed, deeply calming.' },
  },
  {
    id: 'better-sleep',
    name: 'Better Sleep',
    description: 'Sleep, restored.',
    accent: 'Sleep, restored',
    build: () => [
      hero('Sleep, restored.', 'A four-week program combining halotherapy, breathwork, and evening rituals.', 'Better Sleep Program', 'Start the program', 'Read the science'),
      pricing([
        { name: '2-week trial', price: '₹5,999', period: '', features: ['4 evening sessions', 'Sleep-log tracking', 'Weekly check-in'], cta: 'Try 2 weeks' },
        { name: '4-week program', price: '₹10,999', period: '', features: ['8 evening sessions', 'Personalised evening ritual', 'Sleep specialist consult'], cta: 'Start program', featured: true },
        { name: '12-week deep reset', price: '₹29,999', period: '', features: ['24 sessions', 'Monthly sleep specialist consult', 'Priority evening slots'], cta: 'Start deep reset' },
      ]),
      cta('First session on us', 'Only for new members joining Better Sleep this month.'),
    ],
    seo: { metaTitle: 'Better Sleep Program · Salt World', metaDescription: 'A four-week evening halotherapy program to restore deep, natural sleep.' },
  },
  {
    id: 'athlete-recovery',
    name: 'Athlete Recovery',
    description: 'Recovery for performance athletes.',
    accent: 'Train hard. Recover harder.',
    build: () => [
      hero('Recover like a pro', 'Halotherapy protocols engineered for endurance and strength athletes.', 'Athlete Recovery', 'Book recovery', 'View protocols'),
      pricing([
        { name: 'Single recovery', price: '₹1,799', period: '/ session', features: ['60-min recovery protocol', 'Post-session electrolyte'], cta: 'Book one' },
        { name: 'Weekly athlete', price: '₹6,999', period: '/ month', features: ['4 sessions/month', 'Priority evening slots', 'Coach-friendly scheduling'], cta: 'Start weekly', featured: true },
        { name: 'Team plan', price: 'Custom', period: '', features: ['Team of 5+', 'Dedicated coach line', 'Bulk-hour rates'], cta: 'Talk to us' },
      ]),
      cta('Your race schedule, our recovery', 'We’ll plan sessions around your calendar.', 'inverted'),
    ],
    seo: { metaTitle: 'Athlete Recovery · Salt World', metaDescription: 'Halotherapy recovery protocols for endurance and strength athletes in Bengaluru.' },
  },
  {
    id: 'float-therapy',
    name: 'Float Therapy',
    description: 'Weightless. Silent. Restorative.',
    accent: 'Weightless. Silent. Restorative.',
    build: () => [
      hero('Weightless. Silent.', 'Sixty minutes in body-temperature saltwater. The deepest rest you’ll ever have.', 'Float Therapy', 'Book a float', 'How floating works'),
      pricing([
        { name: 'First float', price: '₹2,499', period: '/ session', features: ['60-min float', 'Post-float lounge access', 'Guided orientation'], cta: 'Try floating' },
        { name: 'Float 4-pack', price: '₹8,999', period: '', features: ['4 float sessions', 'Valid 60 days', 'Priority booking'], cta: 'Get 4-pack', featured: true },
        { name: 'Float 10-pack', price: '₹19,999', period: '', features: ['10 float sessions', 'Valid 120 days', 'Guest pass × 2'], cta: 'Get 10-pack' },
      ]),
      tst([
        { quote: 'I don’t know a faster way to fall asleep.', author: 'Meera Iyer', role: 'Designer', rating: 5 },
      ]),
      cta('Silence is booking fast', 'Weekends often full 10 days out.'),
    ],
    seo: { metaTitle: 'Float Therapy · Salt World Bengaluru', metaDescription: 'Sixty-minute floatation therapy sessions in Bengaluru’s calmest wellness space.' },
  },
];

export const getTemplate = (id) => TEMPLATES.find(t => t.id === id);

export const emptyPage = (title = 'New landing page') => ({
  title, description: '', template: null,
  sections: [
    hero('Salt World', 'Breathe better. Live lighter.', 'Halotherapy · Bengaluru', 'Book a session', 'Explore therapies'),
    cta('Start your wellness journey today', 'Your first session is on us for new members.'),
  ],
  seo: { metaTitle: title, metaDescription: '', ogImage: '', canonical: '' },
});
