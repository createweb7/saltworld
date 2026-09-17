// Salt World — outcome data records.
// One source of truth. The OutcomeTemplate component renders this 1:1.
// In Module 9 (Admin CMS) these move to MongoDB with the same shape.
//
// Categories follow the "functionality categories" taxonomy (therapy →
// wellness-goal mapping) — see the ops sheet for the source mapping of
// which therapies serve which goal. Couple Activities and Corporate
// Wellness sit outside that taxonomy (different purpose: a date-night
// offering and a B2B leads funnel) and are kept as-is alongside it.
// Better Sleep and Mental Wellness were merged into one "Sleep
// Optimization & Mental Clarity" category per that mapping — old links to
// /outcomes/better-sleep and /outcomes/mental-wellness redirect here
// (see next.config.js).

import {
  Wind, Moon, Dumbbell, Activity, Heart, Infinity as InfinityIcon,
  Sun, Users, Sprout, Droplets, Sparkles,
} from 'lucide-react';

const HERO_IMG = 'https://images.unsplash.com/photo-1580291339839-e2d207553b81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHw0fHxtaW5pbWFsaXN0JTIwcG9vbHxlbnwwfHx8d2hpdGV8MTc4MzUxMjI5Mnww&ixlib=rb-4.1.0&q=85&w=2400&h=1600&fit=crop';
const WATER_IMG = 'https://images.unsplash.com/photo-1615529328331-f8917597711f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHx3YXRlciUyMHN1cmZhY2V8ZW58MHx8fHdoaXRlfDE3ODM1MTIyNzN8MA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const BED_IMG   = 'https://images.unsplash.com/photo-1609940170579-60f916a78e56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwYmVkfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const HANDS_IMG = 'https://images.unsplash.com/photo-1486382630970-831dcf080d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHJlY292ZXJ5fGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const COUPLE_IMG= 'https://images.unsplash.com/photo-1635425291333-8484fc42dc13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxjb3VwbGUlMjBzaWxob3VldHRlfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjczfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';

const commonFirstVisit = [
  { step: 1, title: 'Arrive five minutes early', body: 'We’ll settle you in with a warm herbal tea. No paperwork on arrival day.' },
  { step: 2, title: 'Change and orient',         body: 'Simple lockers, robes, sandals. Your therapist walks you through what to expect.' },
  { step: 3, title: 'Your protocol',             body: 'Forty-five to sixty quiet minutes. We handle time-keeping so you don’t have to.' },
  { step: 4, title: 'Post-session lounge',       body: 'A calm space to come back slowly. Water, hot tea, and no rush to leave.' },
];

const commonPricing = (packageName, packagePrice, packageDesc) => ({
  single:     { name: 'Single visit',       price: '₹1,499', period: '/ session', features: ['One full session', 'Full room & lounge access', 'Herbal tea post-session'], cta: 'Book once', featured: false },
  pack:       { name: packageName,          price: packagePrice, period: '',           features: packageDesc,                                                                     cta: 'Start package', featured: true },
  membership: { name: 'Wellness membership',price: '₹3,499', period: '/ month',    features: ['8 sessions across any therapy', 'Priority slot booking', '20% off retail & guest passes', 'Quarterly wellness consult'], cta: 'Join', featured: false },
});

export const OUTCOMES = [
  {
    slug: 'stress-relief',
    icon: Wind,
    title: 'Relaxation & Stress Relief',
    eyebrow: 'For deep calm and a reset nervous system',
    hero: {
      headline: 'A quieter mind, in an hour.',
      subhead: 'Not another meditation app. A physical protocol for the body that resets the mind — halotherapy, infrared warmth, and float-tank stillness, rotated to match how wound-up you are that day.',
    },
    feltResult: {
      lead: 'What members report after four sessions:',
      stats: [
        { label: 'Perceived stress (PSS-10)', delta: '−28%' },
        { label: 'Sleep latency',              delta: '−34%' },
        { label: 'Resting heart rate',         delta: '−6 bpm' },
      ],
      quote: 'I stopped grinding my teeth at night by session six. My wife noticed before I did.',
      author: 'Karan V., Founder',
    },
    science: {
      title: 'Why it works',
      body: 'Salt therapy in a controlled micro-climate downshifts the sympathetic nervous system within twenty minutes. Infrared warmth and float-tank stillness deepen that downshift on the days you need more. The effect compounds — sleep, morning heart rate, and reactivity all shift over four weeks.',
      citation: 'Chervinskaya, 2019 · Journal of Alternative Medicine',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Halotherapy + Infrared Sauna + Float',
      duration: '45 minutes',
      frequency: '2× per week for 4 weeks',
      image: HERO_IMG,
      therapies: [
        { slug: 'salt-therapy',    label: 'Salt therapy',    role: 'Primary' },
        { slug: 'infrared-sauna',  label: 'Infrared sauna',  role: 'Adjunct' },
        { slug: 'float-therapy',   label: 'Float therapy',   role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'How soon will I feel a difference?',      a: 'Most members feel a shift the same evening — usually a longer, deeper first sleep. Compounding effects are measurable by week two.' },
      { q: 'Do I need to prepare?',                    a: 'No. Come as you are. Hydrate through the day; skip caffeine within four hours of your session for best effect.' },
      { q: 'Is it safe for high blood pressure?',      a: 'Yes, and often beneficial. Please share any conditions on your first-visit form; we adjust protocol accordingly.' },
      { q: 'What if I fall asleep?',                   a: 'Excellent. That’s the nervous system doing what it needed.' },
      { q: 'Can I come more often than 2×/week?', a: 'Yes. Our members with the deepest benefit typically settle into 3× in the first month, then 1– 2× for maintenance.' },
      { q: 'Do you accept walk-ins?',                  a: 'Sometimes, but slots often fill 3–5 days out. Book ahead.' },
    ],
    pricing: commonPricing('Four-week reset', '₹4,999', ['8 sessions over 4 weeks', 'Sleep-log tracking', 'Weekly check-in with your therapist', 'Personalised evening ritual']),
    related: ['sleep-mental-clarity', 'longevity'],
  },
  {
    slug: 'sleep-mental-clarity',
    icon: Moon,
    title: 'Sleep Optimization & Mental Clarity',
    eyebrow: 'For deeper nights and a quieter, sharper mind',
    hero: {
      headline: 'Sleep, restored. Mind, clear.',
      subhead: 'A protocol combining evening float therapy and halotherapy — sensory stillness that resets the nervous system, the sleep cycle, and the noise in your head, together.',
    },
    feltResult: {
      lead: 'Members using this protocol report:',
      stats: [
        { label: 'Sleep latency',           delta: '−40%' },
        { label: 'Nighttime wake-ups',       delta: '−48%' },
        { label: 'Rumination episodes',      delta: '−30%' },
      ],
      quote: 'I sleep the same night as my session — and it’s the only place my brain actually stops.',
      author: 'Devika S., Analyst',
    },
    science: {
      title: 'Why it works',
      body: 'Sixty minutes of body-temperature float triggers a measurable drop in beta brainwave activity and has shown anxiolytic effects in controlled trials. The nervous system rehearses the state it needs at night — and remembers. Paired with halotherapy and a fixed evening ritual, sleep quality and rumination both shift inside two weeks.',
      citation: 'Feinstein et al., 2018 · PLOS One',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Evening Float + Halotherapy',
      duration: '60 minutes',
      frequency: '1–2× per week for 4 weeks · evenings',
      image: BED_IMG,
      therapies: [
        { slug: 'float-therapy', label: 'Float therapy', role: 'Primary' },
        { slug: 'salt-therapy',  label: 'Salt therapy',  role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Can I bring my own sleep tracker data?',      a: 'Yes — we’ll baseline against your first two weeks. Oura, Whoop, and Apple Watch all work.' },
      { q: 'Is floating safe if I don’t swim?',       a: 'The salt density (Epsom, 500kg) makes floating effortless. The water is 25cm deep and you cannot sink.' },
      { q: 'Is this a substitute for therapy?',            a: 'No. We work alongside your therapist or psychiatrist, never in place of one. If you’re not yet in care, we can refer.' },
      { q: 'What if I have a panic attack in the tank?',   a: 'The door is unlocked and open on request. Our therapist can stay within earshot for your first session.' },
      { q: 'How long before bed should I book?',           a: 'A session 2–4 hours before your bedtime is ideal. We reserve the last slots of the day for this protocol.' },
      { q: 'Discretion?',                                  a: 'Complete. We never share who you are or that you’re here.' },
    ],
    pricing: commonPricing('Four-week sleep & clarity program', '₹10,999', ['8 evening sessions', 'Personalised evening ritual guide', 'Sleep specialist consult at week 2', 'Sleep-log review at week 4']),
    related: ['stress-relief', 'longevity'],
  },
  {
    slug: 'muscle-recovery',
    icon: Dumbbell,
    title: 'Performance & Recovery',
    eyebrow: 'For athletes, weekend runners, and anyone chasing VO2 max',
    hero: {
      headline: 'Train hard. Recover harder.',
      subhead: 'A recovery protocol built around infrared sauna, cold plunge, red-light, and float. Reduces soreness and inflammation, improves circulation and lung capacity — designed with local marathoners, CrossFit boxes, and triathletes.',
    },
    feltResult: {
      lead: 'Athlete members typically see, within 3 weeks:',
      stats: [
        { label: 'Perceived soreness (DOMS)',          delta: '−37%' },
        { label: 'Time to return-to-training',         delta: '−24%' },
        { label: 'Session RPE at same load',           delta: '−0.8' },
      ],
      quote: 'I ran my sub-45 10K after eight weeks. First time in three years.',
      author: 'Anagha S., Runners High',
    },
    science: {
      title: 'Why it works',
      body: 'Contrast therapy — heat then cold — accelerates lactate clearance and downregulates inflammation. Red-light adds cellular repair on top; float finishes by putting the parasympathetic system in charge, so recovery continues through the night. This is the same protocol elite endurance coaches use, minus the ice bath in your bathroom.',
      citation: 'Ihsan et al., 2016 · Journal of Sports Sciences',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Infrared Sauna → Cold Plunge → Red-light → Float',
      duration: '90 minutes',
      frequency: '1–2× per week, ideally within 24h of hard sessions',
      image: HANDS_IMG,
      therapies: [
        { slug: 'infrared-sauna',    label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',       label: 'Cold plunge',    role: 'Primary' },
        { slug: 'red-light-therapy', label: 'Red-light',      role: 'Adjunct' },
        { slug: 'salt-therapy',      label: 'Salt therapy',   role: 'Adjunct' },
        { slug: 'float-therapy',     label: 'Float therapy',  role: 'Finisher' },
      ],
    },
    faq: [
      { q: 'How cold is the plunge?',                        a: '8–10°C. We start you at 4–6 minutes and progress. Never mandatory.' },
      { q: 'What about heart conditions?',                  a: 'We screen for cardiovascular risk on your first-visit form. Cold plunge can be replaced with a milder contrast if needed.' },
      { q: 'Can I come on race week?',                       a: 'Yes — we’ll modify to sauna + float only, no cold, 48–72h before an event.' },
      { q: 'Is there a discount for local run clubs?',       a: 'Yes. Run clubs of five or more get a shared 20% rate. Contact us via WhatsApp.' },
      { q: 'Do you work with coaches?',                       a: 'We share session notes with your coach on request. Standard practice for our team-plan members.' },
      { q: 'How does this fit with strength training?',      a: 'Best on rest days or 12+ hours post-lift. Hard sauna directly after heavy lifting can blunt hypertrophy.' },
    ],
    pricing: commonPricing('Athlete pack (8 sessions)', '₹9,999', ['8 recovery protocols over 8 weeks', 'Coach-friendly scheduling', 'Post-session electrolyte drink', 'Body composition scan at week 4']),
    related: ['pain-relief', 'longevity'],
  },
  {
    slug: 'pain-relief',
    icon: Activity,
    title: 'Pain Relief & Inflammation Reduction',
    eyebrow: 'For chronic pain, joint issues, and post-injury recovery',
    hero: {
      headline: 'Gentle, drug-free, measurable.',
      subhead: 'A calming protocol for back, joint, and post-injury pain — combining infrared heat, cold-plunge contrast, and buoyant float support.',
    },
    feltResult: {
      lead: 'Members on this protocol report, at week 6:',
      stats: [
        { label: 'Pain intensity (VAS)',        delta: '−31%' },
        { label: 'Sleep-disrupting pain nights', delta: '−44%' },
        { label: 'NSAID use',                   delta: '−26%' },
      ],
      quote: 'My back stopped waking me at 3 AM. Simple as that.',
      author: 'Ashwin M., 52',
    },
    science: {
      title: 'Why it works',
      body: 'Infrared heat increases circulation and loosens stiff tissue; cold-plunge contrast blunts the inflammatory response that follows. Floatation removes gravitational load from injured joints entirely. Together they compound, without pharmacology.',
      citation: 'Hamblin, 2017 · Photobiomodulation reviews',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Infrared Sauna + Cold Plunge + Float',
      duration: '75 minutes',
      frequency: '2× per week for 6 weeks',
      image: HERO_IMG,
      therapies: [
        { slug: 'infrared-sauna', label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',    label: 'Cold plunge',    role: 'Primary' },
        { slug: 'float-therapy',  label: 'Float therapy',  role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Is this a substitute for physio?',           a: 'No — complementary. Members typically continue physio and use us to reduce pain flare-ups between sessions.' },
      { q: 'Can I come post-surgery?',                    a: 'After your surgeon clears you for immersion. We’ll adapt protocol accordingly.' },
      { q: 'What about back pain during pregnancy?',      a: 'Float is exceptional for late pregnancy back pain. Heat protocols are adjusted — tell us on your first-visit form.' },
      { q: 'Do you accept insurance?',                    a: 'We provide invoices with therapy codes. Reimbursement depends on your plan.' },
      { q: 'How is progress tracked?',                    a: 'A 30-second VAS score each visit, plus a wellness-lead check-in at week 3.' },
      { q: 'Can I bring my TENS unit or brace?',          a: 'Yes to braces during salt or float sessions. TENS is not compatible with float or sauna.' },
    ],
    pricing: commonPricing('Six-week pain program', '₹13,999', ['12 sessions over 6 weeks', 'Weekly VAS pain tracking', 'Bi-weekly wellness-lead review', 'Ergonomic guide for home']),
    related: ['muscle-recovery', 'longevity'],
  },
  {
    slug: 'couple-activities',
    icon: Heart,
    title: 'Couple Activities',
    eyebrow: 'For date nights that stay with you',
    hero: {
      headline: 'A date, without the noise.',
      subhead: 'Ninety minutes together, without a phone in sight. Anniversary, first date, or just Wednesday — the best couples wellness experience in Bengaluru.',
    },
    feltResult: {
      lead: 'What couples tell us afterwards:',
      stats: [
        { label: 'Would return',                delta: '96%' },
        { label: 'Chose it for anniversary',    delta: '38%' },
        { label: 'Booked again within 60 days', delta: '61%' },
      ],
      quote: 'Best anniversary idea in years. We’ve started a monthly ritual.',
      author: 'Aditi &amp; Kabir, Indiranagar',
    },
    science: {
      title: 'Why it works',
      body: 'Shared parasympathetic downshift is measurably synchronising. Couples who float or salt together show heart-rate coherence that persists for hours. It’s the opposite of a loud restaurant — the setup literally lets you sync.',
      citation: 'HeartMath Institute, 2020 · biofeedback studies',
    },
    protocol: {
      title: 'The experience',
      primary: 'Twin salt cave + shared post-session lounge',
      duration: '90 minutes',
      frequency: 'Anytime. Book 5–10 days ahead for weekends.',
      image: COUPLE_IMG,
      therapies: [
        { slug: 'salt-therapy',   label: 'Salt therapy',    role: 'Primary' },
        { slug: 'float-therapy',  label: 'Float therapy',   role: 'Optional twin cabin' },
      ],
    },
    faq: [
      { q: 'Can we book a private room?',                    a: 'Yes. Our Duo and Ritual packages include a private twin salt cave.' },
      { q: 'Do you handle special occasions?',                a: 'Yes — flowers, a card, or a chilled non-alcoholic option can be added at checkout.' },
      { q: 'What should we wear?',                            a: 'Loose, breathable clothing. We provide robes and sandals.' },
      { q: 'Can we bring gifts to exchange in the lounge?',   a: 'Absolutely. Our lounge is calm, low-lit, and unrushed.' },
      { q: 'Is this good for a first date?',                  a: 'Surprisingly great — no forced conversation, plenty to talk about afterwards.' },
      { q: 'Do you have gift vouchers for this?',             a: 'Yes. Any denomination, delivered instantly by email or WhatsApp.' },
    ],
    pricing: {
      single:     { name: 'Duo',            price: '₹2,999', period: '/ visit',   features: ['45-min shared salt cave', 'Post-session herbal tea', 'For two'],                     cta: 'Book duo',       featured: false },
      pack:       { name: 'Evening ritual', price: '₹4,999', period: '/ visit',   features: ['60-min salt + aroma', 'Private twin cabin', 'Wellness pairing', 'Take-home kit'],   cta: 'Book ritual',    featured: true },
      membership: { name: 'Weekend escape', price: '₹7,999', period: '/ package', features: ['3 sessions over a weekend', 'Priority slots', 'Complimentary consult'],              cta: 'Book weekend',   featured: false },
    },
    related: ['stress-relief', 'sleep-mental-clarity'],
  },
  {
    slug: 'longevity',
    icon: InfinityIcon,
    title: 'Longevity & Anti-Aging',
    eyebrow: 'For lifelong practice and cellular health',
    hero: {
      headline: 'Small habits.\nCompounded over years.',
      subhead: 'Longevity is not a supplement. It’s a weekly rhythm across heat, cold, light, and stillness that trains resilience and keeps skin, circulation, and cognition young. Ours is built on evidence from Blue-Zone lifestyle research and clinical hormesis studies.',
    },
    feltResult: {
      lead: 'Twelve-month member indicators:',
      stats: [
        { label: 'HRV (average)',                    delta: '+18%' },
        { label: 'VO2 max (subset with tracking)',    delta: '+9%' },
        { label: 'Days-per-month feeling “on”', delta: '+7' },
      ],
      quote: 'This is the first health thing I’ve actually kept for a full year.',
      author: 'Vikram R., 46',
    },
    science: {
      title: 'Why it works',
      body: 'Hormesis — short, dosed stress that trains the body — is the mechanism behind sauna, cold, red-light, and salt therapy longevity data. Do it weekly, do it forever. The compounding is the point.',
      citation: 'Laukkanen et al., 2018 · Mayo Clinic Proceedings',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Sauna + Cold + Red-light + Salt (rotating)',
      duration: '75 minutes',
      frequency: '1– 2× per week, indefinitely',
      image: WATER_IMG,
      therapies: [
        { slug: 'infrared-sauna',    label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',       label: 'Cold plunge',    role: 'Primary' },
        { slug: 'red-light-therapy', label: 'Red-light',      role: 'Adjunct' },
        { slug: 'salt-therapy',      label: 'Salt therapy',   role: 'Adjunct' },
        { slug: 'float-therapy',     label: 'Float therapy',  role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'What’s the minimum frequency to see benefit?', a: 'Consistent weekly practice. Twice-weekly is where compounding gets visible.' },
      { q: 'Best age to start?',                                a: 'Any. Members range 22 to 71.' },
      { q: 'Do you do blood-panel tracking?',                    a: 'Not in-house. We refer to a partner clinician for baseline & 6-month labs.' },
      { q: 'Is this for me if I already work out?',              a: 'Especially so. Weekly recovery protects your training over decades.' },
      { q: 'Can I do this while travelling?',                    a: 'Sessions can be frozen without cost during travel months.' },
      { q: 'Do you share member data anonymously?',              a: 'Only aggregate, never identifiable. Members opt-in to our annual retrospective.' },
    ],
    pricing: commonPricing('Annual longevity plan', '₹33,999', ['52 sessions in 12 months', 'Bi-annual wellness lead consult', 'Priority evening slots', 'Guest pass every quarter']),
    related: ['muscle-recovery', 'skin-rejuvenation'],
  },
  {
    slug: 'respiratory-wellness',
    icon: Sprout,
    title: 'Respiratory & Immune Support',
    eyebrow: 'For asthma, allergies, city air, and immune resilience',
    hero: {
      headline: 'Breathe easier.',
      subhead: 'Halotherapy is the core protocol — paired with infrared sauna sessions that support circulation and immunity — designed for Bengaluru air, allergy seasons, and childhood asthma.',
    },
    feltResult: {
      lead: 'Parents and adult members report, at week 4:',
      stats: [
        { label: 'Inhaler-use days per month', delta: '−37%' },
        { label: 'Sinus congestion (self-rated)', delta: '−44%' },
        { label: 'Nighttime cough episodes',     delta: '−52%' },
      ],
      quote: 'My five-year-old’s inhaler use is down to almost zero. This place is real.',
      author: 'Priya Nair, Parent',
    },
    science: {
      title: 'Why it works',
      body: 'Micro-particles of dry salt reduce inflammation, thin mucus, and antibacterialise the respiratory tract. Infrared sessions add circulatory and immune support alongside it. The salt caves in Poland where this originated saw 90% remission in miners’ lung disease. In our modern rooms, the same effect — minus the mine.',
      citation: 'Chervinskaya, 2013 · Halotherapy indexed studies',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Halotherapy + Infrared Sauna',
      duration: '45 minutes',
      frequency: '2× per week for 4 weeks, then maintenance',
      image: HERO_IMG,
      therapies: [
        { slug: 'salt-therapy',   label: 'Salt therapy',   role: 'Primary' },
        { slug: 'infrared-sauna', label: 'Infrared sauna', role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Is this safe for children?',              a: 'Yes, from age 3. Our salt caves have quiet games and books; kids often fall asleep.' },
      { q: 'Do we need to bring a prescription?',      a: 'No. This is a wellness protocol, not a medical treatment. Continue any prescribed medication.' },
      { q: 'How soon before we notice a difference?',  a: 'Usually 3–4 sessions. Peak improvement around 6 weeks.' },
      { q: 'What about severe asthma?',                a: 'Please share with us. We coordinate with your pulmonologist and never replace prescribed care.' },
      { q: 'Any allergies to be aware of?',            a: 'Pure Himalayan salt — no additives. No known contraindications.' },
      { q: 'Can pets come?',                            a: 'Only service animals, given the shared micro-climate.' },
    ],
    pricing: commonPricing('Four-week breathing program', '₹4,999', ['8 salt sessions', 'Family rate for 2+', 'Progress check-in at week 3', 'Take-home breathing routine']),
    related: ['stress-relief', 'longevity'],
  },
  {
    slug: 'skin-rejuvenation',
    icon: Sun,
    title: 'Skin Health & Beauty Glow',
    eyebrow: 'For glow, texture, hydration, and repair',
    hero: {
      headline: 'The glow, from the inside.',
      subhead: 'Red-light collagen stimulation, salt exfoliation, and magnesium-rich float therapy — the stack our members use ahead of weddings, milestone birthdays, and long trips.',
    },
    feltResult: {
      lead: 'After a six-week course, members report:',
      stats: [
        { label: 'Skin brightness (self-rated)',      delta: '+41%' },
        { label: 'Blemish frequency',                  delta: '−28%' },
        { label: 'Fine-line visibility (subset)',      delta: '−14%' },
      ],
      quote: 'Two friends asked what I was doing differently. I finally told them.',
      author: 'Meera I., Designer',
    },
    science: {
      title: 'Why it works',
      body: 'Red-light (660nm) and near-infrared (850nm) stimulate collagen synthesis and mitochondrial repair at the dermal layer. Salt exfoliation removes dulling surface cells so the light penetrates cleanly. Float-tank magnesium supports skin hydration on top. Three mechanisms, one very clear result.',
      citation: 'Wunsch &amp; Matuschka, 2014 · Photomedicine and Laser Surgery',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Red-light + Salt polish + Float',
      duration: '60 minutes',
      frequency: '2× per week for 6 weeks',
      image: WATER_IMG,
      therapies: [
        { slug: 'red-light-therapy', label: 'Red-light',     role: 'Primary' },
        { slug: 'salt-therapy',      label: 'Salt therapy',  role: 'Prep' },
        { slug: 'float-therapy',     label: 'Float therapy', role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Is this laser?',                       a: 'No. Red-light is non-ablative and non-thermal. Zero downtime, no peeling.' },
      { q: 'How does it compare to a facial?',     a: 'Complementary. Facials work topically; red-light works cellularly. Members often do both.' },
      { q: 'Any pigmentation risk?',                a: 'No. Red-light is safe on all skin tones. We adjust distance for sensitive skin.' },
      { q: 'What about pregnancy?',                a: 'Face-only red-light is considered safe. We avoid direct abdomen protocols during pregnancy.' },
      { q: 'Do I need to change my skincare?',     a: 'Bring what you already use. We’ll simply flag any actives (retinol, glycolic) that interact with light protocols.' },
      { q: 'How long do results hold?',            a: 'Peak at week 8. Maintenance is one session per fortnight.' },
    ],
    pricing: commonPricing('Six-week glow program', '₹8,999', ['12 sessions over 6 weeks', 'Salt polish included', 'Before/after review', 'Home routine PDF']),
    related: ['longevity', 'stress-relief'],
  },
  {
    slug: 'detox-circulation',
    icon: Droplets,
    title: 'Detox & Circulation Boost',
    eyebrow: 'For sweating out toxins and better blood flow',
    hero: {
      headline: 'Sweat it out. Flow it forward.',
      subhead: 'Infrared heat, cold-plunge contrast, and halotherapy — the core stack for detoxification, circulation, and a full-body reset.',
    },
    feltResult: {
      lead: 'Members on this protocol report, after 4 weeks:',
      stats: [
        { label: 'Perceived energy levels',        delta: '+22%' },
        { label: 'Post-sauna heart-rate recovery',  delta: '−15%' },
        { label: 'Self-rated skin clarity',         delta: '+19%' },
      ],
      quote: 'I leave lighter every single time — not just physically.',
      author: 'Nikhil D., Founder',
    },
    science: {
      title: 'Why it works',
      body: 'Infrared heat raises core temperature and drives a deep sweat response, mobilising surface toxins and boosting peripheral circulation. Cold-plunge contrast immediately after closes blood vessels rapidly, pumping blood back toward the core — the alternating dilation and constriction is the circulation engine. Halotherapy supports the respiratory side of detox.',
      citation: 'Crinnion, 2011 · Alternative Medicine Review',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Infrared Sauna → Cold Plunge + Halotherapy',
      duration: '75 minutes',
      frequency: '1–2× per week',
      image: HANDS_IMG,
      therapies: [
        { slug: 'infrared-sauna', label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',    label: 'Cold plunge',    role: 'Primary' },
        { slug: 'salt-therapy',   label: 'Salt therapy',   role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'How much should I expect to sweat?',           a: 'A lot — infrared runs deeper than a dry sauna. We keep water and electrolytes on hand throughout.' },
      { q: 'Is this safe if I have low blood pressure?',   a: 'Please flag it on your first-visit form; we’ll moderate heat and cold exposure accordingly.' },
      { q: 'How is this different from just sweating at the gym?',  a: 'Infrared heats tissue directly rather than the air, so the sweat response is deeper at a lower ambient temperature — easier to sustain.' },
      { q: 'Can I do this the morning after a heavy meal or drinks?', a: 'Yes — it’s a popular reset for exactly that. Hydrate well beforehand.' },
      { q: 'Do I need to be an athlete for the cold plunge?', a: 'No. We start everyone at 4–6 minutes and build from there. Never mandatory.' },
      { q: 'How often should I do this for real results?',   a: 'Weekly for the first month, then every 1–2 weeks for maintenance.' },
    ],
    pricing: commonPricing('Four-week detox program', '₹8,999', ['8 sessions over 4 weeks', 'Sauna + cold + salt rotation', 'Hydration & electrolyte guide', 'Progress check-in at week 3']),
    related: ['muscle-recovery', 'longevity'],
  },
  {
    slug: 'unique-experience',
    icon: Sparkles,
    title: 'Just Curious & Unique Experience',
    eyebrow: 'For first-timers, gifts, and one-off sensory journeys',
    hero: {
      headline: 'One visit. Every sense, reset.',
      subhead: 'A guided, synergistic flow across all five therapies — salt cave, infrared sauna, cold plunge, float tank, and red-light. Built for first-timers, bucket-list spa days, gifts, and special occasions.',
    },
    feltResult: {
      lead: 'What first-time members tell us:',
      stats: [
        { label: 'Would book a full journey again',   delta: '93%' },
        { label: 'Said it exceeded expectations',      delta: '88%' },
        { label: 'Booked as a gift for someone else',  delta: '41%' },
      ],
      quote: 'I went in curious and left recalibrated. Didn’t expect the cold plunge to be the best part.',
      author: 'Arjun K., First-time visitor',
    },
    science: {
      title: 'Why it works',
      body: 'There’s no single mechanism here — that’s the point. Each therapy hits a different system: salt calms the respiratory tract, infrared heat and cold plunge run the full contrast cycle, float empties the nervous system, and red-light closes with cellular repair. Sequenced correctly, the whole visit compounds into one long, layered reset.',
    },
    protocol: {
      title: 'The journey',
      primary: 'Salt Cave → Infrared Sauna → Cold Plunge → Float → Red-light',
      duration: '2.5–3 hours',
      frequency: 'One-time, or whenever curiosity strikes',
      image: HERO_IMG,
      therapies: [
        { slug: 'salt-therapy',      label: 'Salt therapy',    role: 'Leg 1' },
        { slug: 'infrared-sauna',    label: 'Infrared sauna',  role: 'Leg 2' },
        { slug: 'cold-plunge',       label: 'Cold plunge',     role: 'Leg 3' },
        { slug: 'float-therapy',     label: 'Float therapy',   role: 'Leg 4' },
        { slug: 'red-light-therapy', label: 'Red-light',       role: 'Leg 5' },
      ],
    },
    faq: [
      { q: 'Can I customise the order or skip a therapy?',  a: 'Yes — the sequence above is our recommended flow, but you can drop or reorder any leg when you book.' },
      { q: 'Is this too much for a total first-timer?',      a: 'Not at all — it’s designed as the gentlest possible introduction to all five, each in a short dose.' },
      { q: 'Can I book this as a gift for someone else?',    a: 'Yes. We issue an instant gift card, or you can book directly in their name with your card.' },
      { q: 'Is it good for a corporate outing or small group?', a: 'Yes — this is our most popular group and offsite booking. Contact us for group scheduling.' },
      { q: 'Can kids do the full journey?',                   a: 'Salt cave and float are kid-friendly from age 3+. Sauna, cold plunge, and red-light are adults-only.' },
      { q: 'How far ahead should I book?',                    a: '3–5 days for a solo slot; 7–10 days for a group, since it holds multiple rooms at once.' },
    ],
    pricing: {
      single:     { name: 'Taster',            price: '₹2,499', period: '/ visit',   features: ['Any 2 therapies, 60 minutes', 'Full room & lounge access', 'Herbal tea post-session'],                       cta: 'Book a taster',      featured: false },
      pack:       { name: 'Signature journey', price: '₹4,999', period: '/ visit',   features: ['All 5 therapies, 2.5–3 hours', 'Guided sequencing by your therapist', 'Post-journey lounge & light meal'], cta: 'Book the journey',   featured: true },
      membership: { name: 'Gift the journey',  price: '₹4,999', period: '/ gift card', features: ['Instant delivery by email or WhatsApp', 'Valid 12 months', 'Redeemable for the full journey or à la carte'], cta: 'Send as a gift',     featured: false },
    },
    related: ['stress-relief', 'muscle-recovery'],
  },
  {
    slug: 'corporate-wellness',
    icon: Users,
    title: 'Corporate Wellness',
    eyebrow: 'For teams that ship',
    hero: {
      headline: 'The wellness benefit your team will actually use.',
      subhead: 'Programmes for founders, engineering teams, and studios who want their people rested, focused, and here for the long run. Delivered in Bengaluru.',
    },
    feltResult: {
      lead: 'Across 24 corporate cohorts we’ve delivered:',
      stats: [
        { label: 'Programme utilisation',           delta: '82%' },
        { label: 'Reported sleep improvement',       delta: '68%' },
        { label: 'Would recommend to colleagues',    delta: '94%' },
      ],
      quote: 'Better than the gym benefit we tried three times. Team actually uses it.',
      author: 'Head of People · Series B startup',
    },
    science: {
      title: 'Why it works',
      body: 'Corporate wellness fails when it’s generic. Ours is outcomes-first: each member chooses their track (sleep, stress, recovery). We report anonymised utilisation to your HR lead. No steps to compete on. No gimmicks.',
    },
    protocol: {
      title: 'How it works for teams',
      primary: 'Custom cohort programs',
      duration: 'Flexible',
      frequency: 'Weekly team days, individual visits, or hybrid',
      image: HANDS_IMG,
      therapies: [
        { slug: 'salt-therapy',    label: 'Salt therapy',    role: 'Track' },
        { slug: 'float-therapy',    label: 'Float therapy',   role: 'Track' },
        { slug: 'infrared-sauna',   label: 'Infrared sauna',  role: 'Track' },
      ],
    },
    faq: [
      { q: 'Team size we work with?',                 a: 'Best fit is 15–150. Larger enterprises: our team-plan lead will design a phased rollout.' },
      { q: 'Do you invoice on net-30?',                a: 'Yes. Standard for our corporate clients.' },
      { q: 'GST invoicing?',                            a: 'Yes. Full GST-compliant invoices with therapy codes.' },
      { q: 'Anonymised reporting?',                     a: 'Monthly utilisation dashboard for your HR lead. Never individual usage.' },
      { q: 'On-site workshops?',                        a: 'Yes — breathwork and sleep-hygiene workshops at your office, quarterly.' },
      { q: 'Trial cohort?',                              a: 'Start with 10 members for 4 weeks, full outcomes report, then commit.' },
    ],
    pricing: {
      single:     { name: 'Team trial',         price: 'From ₹99,000', period: '/ 4 weeks',  features: ['10 members, 4 sessions each', 'Outcomes report', 'Dedicated coordinator'], cta: 'Start a trial',   featured: false },
      pack:       { name: 'Annual programme',   price: 'From ₹4.8L',   period: '/ year',     features: ['30 members, unlimited eligible sessions', 'Quarterly workshops on-site', 'Anonymised utilisation dashboard', 'Named team lead'], cta: 'Design a programme', featured: true },
      membership: { name: 'Enterprise',         price: 'Custom',            period: '',           features: ['150+ members', 'Multi-city coordination', 'Custom SLAs', 'C-suite quarterly reviews'], cta: 'Talk to us',         featured: false },
    },
    related: ['stress-relief', 'muscle-recovery'],
  },
];

export const OUTCOMES_BY_SLUG = Object.fromEntries(OUTCOMES.map((o) => [o.slug, o]));

export const getOutcome = (slug) => OUTCOMES_BY_SLUG[slug];

export const getRelated = (slug) => {
  const o = getOutcome(slug);
  if (!o) return [];
  return (o.related || []).map((s) => OUTCOMES_BY_SLUG[s]).filter(Boolean);
};

/** Returns every outcome that uses a given therapy anywhere in its protocol. */
export const outcomesUsing = (therapySlug) =>
  OUTCOMES.filter((o) => (o.protocol?.therapies || []).some((t) => t.slug === therapySlug));

/** Returns the "primary" outcome for a therapy — the one where the therapy is
 *  marked role='Primary'. Falls back to the first outcome that uses it. Used
 *  by the direct-therapy booking flow so we can borrow a sensible price + label
 *  without forcing the customer to pick an outcome first.
 */
export const primaryOutcomeForTherapy = (therapySlug) => {
  const users = outcomesUsing(therapySlug);
  return (
    users.find((o) =>
      (o.protocol?.therapies || []).some(
        (t) => t.slug === therapySlug && String(t.role || '').toLowerCase() === 'primary',
      ),
    ) || users[0] || null
  );
};
