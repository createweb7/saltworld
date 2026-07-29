// Salt World — outcome data records.
// One source of truth. The OutcomeTemplate component renders this 1:1.
// In Module 9 (Admin CMS) these move to MongoDB with the same shape.

import {
  Wind, Moon, Dumbbell, Activity, Heart, Infinity as InfinityIcon,
  Sun, Users, Brain, Sprout,
} from 'lucide-react';

const HERO_IMG = 'https://images.unsplash.com/photo-1580291339839-e2d207553b81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHw0fHxtaW5pbWFsaXN0JTIwcG9vbHxlbnwwfHx8d2hpdGV8MTc4MzUxMjI5Mnww&ixlib=rb-4.1.0&q=85&w=2400&h=1600&fit=crop';
const WATER_IMG = 'https://images.unsplash.com/photo-1615529328331-f8917597711f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHx3YXRlciUyMHN1cmZhY2V8ZW58MHx8fHdoaXRlfDE3ODM1MTIyNzN8MA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const BED_IMG   = 'https://images.unsplash.com/photo-1609940170579-60f916a78e56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwYmVkfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const HANDS_IMG = 'https://images.unsplash.com/photo-1486382630970-831dcf080d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHJlY292ZXJ5fGVufDB8fHx3aGl0ZXwxNzgzNTEyMjgyfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';
const COUPLE_IMG= 'https://images.unsplash.com/photo-1635425291333-8484fc42dc13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxjb3VwbGUlMjBzaWxob3VldHRlfGVufDB8fHx3aGl0ZXwxNzgzNTEyMjczfDA&ixlib=rb-4.1.0&q=85&w=1600&h=1200&fit=crop';

const commonFirstVisit = [
  { step: 1, title: 'Arrive five minutes early', body: 'We\u2019ll settle you in with a warm herbal tea. No paperwork on arrival day.' },
  { step: 2, title: 'Change and orient',         body: 'Simple lockers, robes, sandals. Your therapist walks you through what to expect.' },
  { step: 3, title: 'Your protocol',             body: 'Forty-five to sixty quiet minutes. We handle time-keeping so you don\u2019t have to.' },
  { step: 4, title: 'Post-session lounge',       body: 'A calm space to come back slowly. Water, hot tea, and no rush to leave.' },
];

const commonPricing = (packageName, packagePrice, packageDesc) => ({
  single:     { name: 'Single visit',       price: '\u20B91,499', period: '/ session', features: ['One full session', 'Full room & lounge access', 'Herbal tea post-session'], cta: 'Book once', featured: false },
  pack:       { name: packageName,          price: packagePrice, period: '',           features: packageDesc,                                                                     cta: 'Start package', featured: true },
  membership: { name: 'Wellness membership',price: '\u20B93,499', period: '/ month',    features: ['8 sessions across any therapy', 'Priority slot booking', '20% off retail & guest passes', 'Quarterly wellness consult'], cta: 'Join', featured: false },
});

export const OUTCOMES = [
  {
    slug: 'stress-relief',
    icon: Wind,
    title: 'Stress Relief',
    eyebrow: 'For high-stress lifestyles',
    hero: {
      headline: 'A quieter mind, in an hour.',
      subhead: 'Not another meditation app. A physical protocol for the body that resets the mind. Forty-five minutes, twice a week, for four weeks.',
    },
    feltResult: {
      lead: 'What members report after four sessions:',
      stats: [
        { label: 'Perceived stress (PSS-10)', delta: '\u221228%' },
        { label: 'Sleep latency',              delta: '\u221234%' },
        { label: 'Resting heart rate',         delta: '\u22126 bpm' },
      ],
      quote: 'I stopped grinding my teeth at night by session six. My wife noticed before I did.',
      author: 'Karan V., Founder',
    },
    science: {
      title: 'Why it works',
      body: 'Salt therapy in a controlled micro-climate downshifts the sympathetic nervous system within twenty minutes. Combined with red-light on the second half of the session, cortisol drops measurably. The effect compounds \u2014 sleep, morning heart rate, and reactivity all shift over four weeks.',
      citation: 'Chervinskaya, 2019 · Journal of Alternative Medicine',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Halotherapy + Red-light',
      duration: '45 minutes',
      frequency: '2\u00d7 per week for 4 weeks',
      image: HERO_IMG,
      therapies: [
        { slug: 'salt-therapy',      label: 'Salt therapy',      role: 'Primary' },
        { slug: 'red-light-therapy', label: 'Red-light',         role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'How soon will I feel a difference?',      a: 'Most members feel a shift the same evening \u2014 usually a longer, deeper first sleep. Compounding effects are measurable by week two.' },
      { q: 'Do I need to prepare?',                    a: 'No. Come as you are. Hydrate through the day; skip caffeine within four hours of your session for best effect.' },
      { q: 'Is it safe for high blood pressure?',      a: 'Yes, and often beneficial. Please share any conditions on your first-visit form; we adjust protocol accordingly.' },
      { q: 'What if I fall asleep?',                   a: 'Excellent. That\u2019s the nervous system doing what it needed.' },
      { q: 'Can I come more often than 2\u00d7/week?', a: 'Yes. Our members with the deepest benefit typically settle into 3\u00d7 in the first month, then 1\u2013 2\u00d7 for maintenance.' },
      { q: 'Do you accept walk-ins?',                  a: 'Sometimes, but slots often fill 3\u20135 days out. Book ahead.' },
    ],
    pricing: commonPricing('Four-week reset', '\u20B94,999', ['8 sessions over 4 weeks', 'Sleep-log tracking', 'Weekly check-in with your therapist', 'Personalised evening ritual']),
    related: ['better-sleep', 'mental-wellness'],
  },
  {
    slug: 'better-sleep',
    icon: Moon,
    title: 'Better Sleep',
    eyebrow: 'For deeper, more consistent nights',
    hero: {
      headline: 'Sleep, restored.',
      subhead: 'A four-week program combining evening float therapy, breathwork, and a repeatable wind-down ritual. Sleep improves the same night for most members.',
    },
    feltResult: {
      lead: 'Members using this protocol report:',
      stats: [
        { label: 'Sleep latency',           delta: '\u221240%' },
        { label: 'Nighttime wake-ups',       delta: '\u221248%' },
        { label: 'Morning grogginess',       delta: '\u221252%' },
      ],
      quote: 'I sleep the same night as my session. I don\u2019t know a faster reset.',
      author: 'Sneha Kulkarni, Founder',
    },
    science: {
      title: 'Why it works',
      body: 'Sixty minutes of body-temperature float triggers a measurable drop in beta brainwave activity. The nervous system rehearses the state it needs at night \u2014 and remembers. Paired with a fixed evening ritual, the effect compounds inside two weeks.',
      citation: 'Feinstein et al., 2018 · PLOS One',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Evening Float + Breathwork',
      duration: '60 minutes',
      frequency: '2\u00d7 per week for 4 weeks · evenings',
      image: BED_IMG,
      therapies: [
        { slug: 'float-therapy', label: 'Float therapy', role: 'Primary' },
        { slug: 'salt-therapy',  label: 'Salt therapy',  role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Can I bring my own sleep tracker data?',   a: 'Yes \u2014 we\u2019ll baseline against your first two weeks. Oura, Whoop, and Apple Watch all work.' },
      { q: 'Is floating safe if I don\u2019t swim?',    a: 'The salt density (Epsom, 500kg) makes floating effortless. The water is 25cm deep and you cannot sink.' },
      { q: 'What if I\u2019m claustrophobic?',          a: 'Our cabins are open, softly lit, and door-optional. Most members leave the door ajar their first session.' },
      { q: 'How long before bed should I book?',       a: 'A session 2\u20134 hours before your bedtime is ideal. We reserve the last slots of the day for sleep protocol members.' },
      { q: 'Does the program include diet or supplements?', a: 'No. If nutritional support is relevant, we\u2019ll refer you to a partner clinician \u2014 never sell it in-house.' },
      { q: 'Can partners share cabins?',                 a: 'Not for this protocol. Sleep programs are single-occupancy so the nervous system has full space.' },
    ],
    pricing: commonPricing('Four-week sleep program', '\u20B910,999', ['8 evening sessions', 'Personalised evening ritual guide', 'Sleep specialist consult at week 2', 'Sleep-log review at week 4']),
    related: ['stress-relief', 'longevity'],
  },
  {
    slug: 'muscle-recovery',
    icon: Dumbbell,
    title: 'Muscle Recovery',
    eyebrow: 'For athletes and weekend runners',
    hero: {
      headline: 'Train hard. Recover harder.',
      subhead: 'A 90-minute recovery protocol built around infrared sauna, cold plunge, and float. Designed with local marathoners, CrossFit boxes, and triathletes.',
    },
    feltResult: {
      lead: 'Athlete members typically see, within 3 weeks:',
      stats: [
        { label: 'Perceived soreness (DOMS)',          delta: '\u221237%' },
        { label: 'Time to return-to-training',         delta: '\u221224%' },
        { label: 'Session RPE at same load',           delta: '\u22120.8' },
      ],
      quote: 'I ran my sub-45 10K after eight weeks. First time in three years.',
      author: 'Anagha S., Runners High',
    },
    science: {
      title: 'Why it works',
      body: 'Contrast therapy \u2014 heat then cold \u2014 accelerates lactate clearance and downregulates inflammation. Float finishes by putting the parasympathetic system in charge, so recovery continues through the night. This is the same protocol elite endurance coaches use, minus the ice bath in your bathroom.',
      citation: 'Ihsan et al., 2016 · Journal of Sports Sciences',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Infrared Sauna \u2192 Cold Plunge \u2192 Float',
      duration: '90 minutes',
      frequency: '1\u20132\u00d7 per week, ideally within 24h of hard sessions',
      image: HANDS_IMG,
      therapies: [
        { slug: 'infrared-sauna', label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',    label: 'Cold plunge',    role: 'Primary' },
        { slug: 'float-therapy',  label: 'Float therapy',  role: 'Finisher' },
      ],
    },
    faq: [
      { q: 'How cold is the plunge?',                        a: '8\u201310\u00b0C. We start you at 4\u20136 minutes and progress. Never mandatory.' },
      { q: 'What about heart conditions?',                  a: 'We screen for cardiovascular risk on your first-visit form. Cold plunge can be replaced with a milder contrast if needed.' },
      { q: 'Can I come on race week?',                       a: 'Yes \u2014 we\u2019ll modify to sauna + float only, no cold, 48\u201372h before an event.' },
      { q: 'Is there a discount for local run clubs?',       a: 'Yes. Run clubs of five or more get a shared 20% rate. Contact us via WhatsApp.' },
      { q: 'Do you work with coaches?',                       a: 'We share session notes with your coach on request. Standard practice for our team-plan members.' },
      { q: 'How does this fit with strength training?',      a: 'Best on rest days or 12+ hours post-lift. Hard sauna directly after heavy lifting can blunt hypertrophy.' },
    ],
    pricing: commonPricing('Athlete pack (8 sessions)', '\u20B99,999', ['8 recovery protocols over 8 weeks', 'Coach-friendly scheduling', 'Post-session electrolyte drink', 'Body composition scan at week 4']),
    related: ['pain-relief', 'longevity'],
  },
  {
    slug: 'pain-relief',
    icon: Activity,
    title: 'Pain Relief',
    eyebrow: 'For chronic and post-injury pain',
    hero: {
      headline: 'Gentle, drug-free, measurable.',
      subhead: 'A calming protocol for back, joint, and post-surgery pain \u2014 combining red-light therapy with warm salt inhalation and buoyant float support.',
    },
    feltResult: {
      lead: 'Members on this protocol report, at week 6:',
      stats: [
        { label: 'Pain intensity (VAS)',        delta: '\u221231%' },
        { label: 'Sleep-disrupting pain nights', delta: '\u221244%' },
        { label: 'NSAID use',                   delta: '\u221226%' },
      ],
      quote: 'My back stopped waking me at 3 AM. Simple as that.',
      author: 'Ashwin M., 52',
    },
    science: {
      title: 'Why it works',
      body: 'Red-light (660nm + 850nm) reduces inflammatory cytokines at the mitochondrial level. Floatation removes gravitational load from injured joints. Warm salt inhalation calms systemic inflammation. Together they compound, without pharmacology.',
      citation: 'Hamblin, 2017 · Photobiomodulation reviews',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Red-light + Float + Salt',
      duration: '75 minutes',
      frequency: '2\u00d7 per week for 6 weeks',
      image: HERO_IMG,
      therapies: [
        { slug: 'red-light-therapy', label: 'Red-light',      role: 'Primary' },
        { slug: 'float-therapy',     label: 'Float therapy',   role: 'Primary' },
        { slug: 'salt-therapy',      label: 'Salt therapy',    role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Is this a substitute for physio?',           a: 'No \u2014 complementary. Members typically continue physio and use us to reduce pain flare-ups between sessions.' },
      { q: 'Can I come post-surgery?',                    a: 'After your surgeon clears you for immersion. We\u2019ll adapt protocol accordingly.' },
      { q: 'What about back pain during pregnancy?',      a: 'Float is exceptional for late pregnancy back pain. Red-light is avoided over the abdomen.' },
      { q: 'Do you accept insurance?',                    a: 'We provide invoices with therapy codes. Reimbursement depends on your plan.' },
      { q: 'How is progress tracked?',                    a: 'A 30-second VAS score each visit, plus a wellness-lead check-in at week 3.' },
      { q: 'Can I bring my TENS unit or brace?',          a: 'Yes to braces during salt sessions. TENS is not compatible with float or sauna.' },
    ],
    pricing: commonPricing('Six-week pain program', '\u20B913,999', ['12 sessions over 6 weeks', 'Weekly VAS pain tracking', 'Bi-weekly wellness-lead review', 'Ergonomic guide for home']),
    related: ['muscle-recovery', 'longevity'],
  },
  {
    slug: 'couple-activities',
    icon: Heart,
    title: 'Couple Activities',
    eyebrow: 'For date nights that stay with you',
    hero: {
      headline: 'A date, without the noise.',
      subhead: 'Ninety minutes together, without a phone in sight. Anniversary, first date, or just Wednesday \u2014 the best couples wellness experience in Bengaluru.',
    },
    feltResult: {
      lead: 'What couples tell us afterwards:',
      stats: [
        { label: 'Would return',                delta: '96%' },
        { label: 'Chose it for anniversary',    delta: '38%' },
        { label: 'Booked again within 60 days', delta: '61%' },
      ],
      quote: 'Best anniversary idea in years. We\u2019ve started a monthly ritual.',
      author: 'Aditi &amp; Kabir, Indiranagar',
    },
    science: {
      title: 'Why it works',
      body: 'Shared parasympathetic downshift is measurably synchronising. Couples who float or salt together show heart-rate coherence that persists for hours. It\u2019s the opposite of a loud restaurant \u2014 the setup literally lets you sync.',
      citation: 'HeartMath Institute, 2020 · biofeedback studies',
    },
    protocol: {
      title: 'The experience',
      primary: 'Twin salt cave + shared post-session lounge',
      duration: '90 minutes',
      frequency: 'Anytime. Book 5\u201310 days ahead for weekends.',
      image: COUPLE_IMG,
      therapies: [
        { slug: 'salt-therapy',   label: 'Salt therapy',    role: 'Primary' },
        { slug: 'float-therapy',  label: 'Float therapy',   role: 'Optional twin cabin' },
      ],
    },
    faq: [
      { q: 'Can we book a private room?',                    a: 'Yes. Our Duo and Ritual packages include a private twin salt cave.' },
      { q: 'Do you handle special occasions?',                a: 'Yes \u2014 flowers, a card, or a chilled non-alcoholic option can be added at checkout.' },
      { q: 'What should we wear?',                            a: 'Loose, breathable clothing. We provide robes and sandals.' },
      { q: 'Can we bring gifts to exchange in the lounge?',   a: 'Absolutely. Our lounge is calm, low-lit, and unrushed.' },
      { q: 'Is this good for a first date?',                  a: 'Surprisingly great \u2014 no forced conversation, plenty to talk about afterwards.' },
      { q: 'Do you have gift vouchers for this?',             a: 'Yes. Any denomination, delivered instantly by email or WhatsApp.' },
    ],
    pricing: {
      single:     { name: 'Duo',            price: '\u20B92,999', period: '/ visit',   features: ['45-min shared salt cave', 'Post-session herbal tea', 'For two'],                     cta: 'Book duo',       featured: false },
      pack:       { name: 'Evening ritual', price: '\u20B94,999', period: '/ visit',   features: ['60-min salt + aroma', 'Private twin cabin', 'Wellness pairing', 'Take-home kit'],   cta: 'Book ritual',    featured: true },
      membership: { name: 'Weekend escape', price: '\u20B97,999', period: '/ package', features: ['3 sessions over a weekend', 'Priority slots', 'Complimentary consult'],              cta: 'Book weekend',   featured: false },
    },
    related: ['stress-relief', 'better-sleep'],
  },
  {
    slug: 'longevity',
    icon: InfinityIcon,
    title: 'Longevity',
    eyebrow: 'For lifelong practice',
    hero: {
      headline: 'Small habits.\nCompounded over years.',
      subhead: 'Longevity is not a supplement. It\u2019s a weekly rhythm you can hold for a decade. Ours is built on evidence from Blue-Zone lifestyle research and clinical hormesis studies.',
    },
    feltResult: {
      lead: 'Twelve-month member indicators:',
      stats: [
        { label: 'HRV (average)',                    delta: '+18%' },
        { label: 'VO2 max (subset with tracking)',    delta: '+9%' },
        { label: 'Days-per-month feeling \u201con\u201d', delta: '+7' },
      ],
      quote: 'This is the first health thing I\u2019ve actually kept for a full year.',
      author: 'Vikram R., 46',
    },
    science: {
      title: 'Why it works',
      body: 'Hormesis \u2014 short, dosed stress that trains the body \u2014 is the mechanism behind sauna, cold, and salt therapy longevity data. Do it weekly, do it forever. The compounding is the point.',
      citation: 'Laukkanen et al., 2018 · Mayo Clinic Proceedings',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Sauna + Cold + Salt (rotating)',
      duration: '75 minutes',
      frequency: '1\u2013 2\u00d7 per week, indefinitely',
      image: WATER_IMG,
      therapies: [
        { slug: 'infrared-sauna',    label: 'Infrared sauna', role: 'Primary' },
        { slug: 'cold-plunge',       label: 'Cold plunge',    role: 'Primary' },
        { slug: 'salt-therapy',      label: 'Salt therapy',    role: 'Adjunct' },
        { slug: 'red-light-therapy', label: 'Red-light',       role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'What\u2019s the minimum frequency to see benefit?', a: 'Consistent weekly practice. Twice-weekly is where compounding gets visible.' },
      { q: 'Best age to start?',                                a: 'Any. Members range 22 to 71.' },
      { q: 'Do you do blood-panel tracking?',                    a: 'Not in-house. We refer to a partner clinician for baseline & 6-month labs.' },
      { q: 'Is this for me if I already work out?',              a: 'Especially so. Weekly recovery protects your training over decades.' },
      { q: 'Can I do this while travelling?',                    a: 'Sessions can be frozen without cost during travel months.' },
      { q: 'Do you share member data anonymously?',              a: 'Only aggregate, never identifiable. Members opt-in to our annual retrospective.' },
    ],
    pricing: commonPricing('Annual longevity plan', '\u20B933,999', ['52 sessions in 12 months', 'Bi-annual wellness lead consult', 'Priority evening slots', 'Guest pass every quarter']),
    related: ['muscle-recovery', 'skin-rejuvenation'],
  },
  {
    slug: 'respiratory-wellness',
    icon: Sprout,
    title: 'Respiratory Wellness',
    eyebrow: 'For asthma, allergies, and Bengaluru air',
    hero: {
      headline: 'Breathe easier.',
      subhead: 'Salt therapy is a century-old European respiratory practice, revived here in Bengaluru \u2014 designed for city air, allergy seasons, and childhood asthma.',
    },
    feltResult: {
      lead: 'Parents and adult members report, at week 4:',
      stats: [
        { label: 'Inhaler-use days per month', delta: '\u221237%' },
        { label: 'Sinus congestion (self-rated)', delta: '\u221244%' },
        { label: 'Nighttime cough episodes',     delta: '\u221252%' },
      ],
      quote: 'My five-year-old\u2019s inhaler use is down to almost zero. This place is real.',
      author: 'Priya Nair, Parent',
    },
    science: {
      title: 'Why it works',
      body: 'Micro-particles of dry salt reduce inflammation, thin mucus, and antibacterialise the respiratory tract. The salt caves in Poland where this originated saw 90% remission in miners\u2019 lung disease. In our modern rooms, the same effect \u2014 minus the mine.',
      citation: 'Chervinskaya, 2013 · Halotherapy indexed studies',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Halotherapy (salt cave)',
      duration: '45 minutes',
      frequency: '2\u00d7 per week for 4 weeks, then maintenance',
      image: HERO_IMG,
      therapies: [{ slug: 'salt-therapy', label: 'Salt therapy', role: 'Primary' }],
    },
    faq: [
      { q: 'Is this safe for children?',              a: 'Yes, from age 3. Our salt caves have quiet games and books; kids often fall asleep.' },
      { q: 'Do we need to bring a prescription?',      a: 'No. This is a wellness protocol, not a medical treatment. Continue any prescribed medication.' },
      { q: 'How soon before we notice a difference?',  a: 'Usually 3\u20134 sessions. Peak improvement around 6 weeks.' },
      { q: 'What about severe asthma?',                a: 'Please share with us. We coordinate with your pulmonologist and never replace prescribed care.' },
      { q: 'Any allergies to be aware of?',            a: 'Pure Himalayan salt \u2014 no additives. No known contraindications.' },
      { q: 'Can pets come?',                            a: 'Only service animals, given the shared micro-climate.' },
    ],
    pricing: commonPricing('Four-week breathing program', '\u20B94,999', ['8 salt sessions', 'Family rate for 2+', 'Progress check-in at week 3', 'Take-home breathing routine']),
    related: ['stress-relief', 'longevity'],
  },
  {
    slug: 'skin-rejuvenation',
    icon: Sun,
    title: 'Skin Rejuvenation',
    eyebrow: 'For glow, texture, and repair',
    hero: {
      headline: 'The glow, from the inside.',
      subhead: 'Red-light plus salt exfoliation \u2014 the exact stack our members use ahead of weddings, milestone birthdays, and long trips.',
    },
    feltResult: {
      lead: 'After a six-week course, members report:',
      stats: [
        { label: 'Skin brightness (self-rated)',      delta: '+41%' },
        { label: 'Blemish frequency',                  delta: '\u221228%' },
        { label: 'Fine-line visibility (subset)',      delta: '\u221214%' },
      ],
      quote: 'Two friends asked what I was doing differently. I finally told them.',
      author: 'Meera I., Designer',
    },
    science: {
      title: 'Why it works',
      body: 'Red-light (660nm) and near-infrared (850nm) stimulate collagen synthesis and mitochondrial repair at the dermal layer. Salt exfoliation removes dulling surface cells so the light penetrates cleanly. Two mechanisms, one very clear result.',
      citation: 'Wunsch &amp; Matuschka, 2014 · Photomedicine and Laser Surgery',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Red-light + Salt polish',
      duration: '60 minutes',
      frequency: '2\u00d7 per week for 6 weeks',
      image: WATER_IMG,
      therapies: [
        { slug: 'red-light-therapy', label: 'Red-light',    role: 'Primary' },
        { slug: 'salt-therapy',      label: 'Salt therapy',  role: 'Prep' },
      ],
    },
    faq: [
      { q: 'Is this laser?',                       a: 'No. Red-light is non-ablative and non-thermal. Zero downtime, no peeling.' },
      { q: 'How does it compare to a facial?',     a: 'Complementary. Facials work topically; red-light works cellularly. Members often do both.' },
      { q: 'Any pigmentation risk?',                a: 'No. Red-light is safe on all skin tones. We adjust distance for sensitive skin.' },
      { q: 'What about pregnancy?',                a: 'Face-only red-light is considered safe. We avoid direct abdomen protocols during pregnancy.' },
      { q: 'Do I need to change my skincare?',     a: 'Bring what you already use. We\u2019ll simply flag any actives (retinol, glycolic) that interact with light protocols.' },
      { q: 'How long do results hold?',            a: 'Peak at week 8. Maintenance is one session per fortnight.' },
    ],
    pricing: commonPricing('Six-week glow program', '\u20B98,999', ['12 sessions over 6 weeks', 'Salt polish included', 'Before/after review', 'Home routine PDF']),
    related: ['longevity', 'stress-relief'],
  },
  {
    slug: 'mental-wellness',
    icon: Brain,
    title: 'Mental Wellness',
    eyebrow: 'For anxiety, burnout, and rumination',
    hero: {
      headline: 'A room your thoughts can\u2019t follow you into.',
      subhead: 'For members working through anxiety or burnout \u2014 in tandem with, never replacing, therapy or clinical care.',
    },
    feltResult: {
      lead: 'Members using this protocol alongside therapy report:',
      stats: [
        { label: 'GAD-7 (subset)',      delta: '\u22124.2 pts' },
        { label: 'Rumination episodes',  delta: '\u221230%' },
        { label: 'Focused work-hours per week', delta: '+6' },
      ],
      quote: 'The only place my brain shuts up. I look forward to it more than any coffee.',
      author: 'Devika S., Analyst',
    },
    science: {
      title: 'Why it works',
      body: 'Sensory reduction \u2014 float therapy without light or sound \u2014 has measurable anxiolytic effects in controlled trials. It won\u2019t replace psychotherapy or medication, but it gives the nervous system a training ground the modern day rarely offers.',
      citation: 'Feinstein et al., 2018 · PLOS One (anxiety pilot)',
    },
    protocol: {
      title: 'The protocol',
      primary: 'Float + Breathwork',
      duration: '75 minutes',
      frequency: '1\u20132\u00d7 per week, indefinitely',
      image: BED_IMG,
      therapies: [
        { slug: 'float-therapy', label: 'Float therapy', role: 'Primary' },
        { slug: 'salt-therapy',  label: 'Salt therapy',  role: 'Adjunct' },
      ],
    },
    faq: [
      { q: 'Is this a substitute for therapy?',       a: 'No. We work alongside your therapist or psychiatrist. If you\u2019re not yet in care, we can refer.' },
      { q: 'What if I have a panic attack in the tank?', a: 'The door is unlocked and open on request. Our therapist can stay within earshot for your first session.' },
      { q: 'How does this help focus?',                 a: 'Reduced rumination + better sleep = more usable focus. Members with ADHD report meaningful shifts.' },
      { q: 'Can I journal after?',                       a: 'Yes. Our lounge has a private nook with paper journals; many members do their best thinking here.' },
      { q: 'Discretion?',                                 a: 'Complete. We never share who you are or that you\u2019re here.' },
      { q: 'Does it help with burnout?',                  a: 'Yes \u2014 when paired with real changes to workload. The float is the space you use to make those decisions.' },
    ],
    pricing: commonPricing('Eight-week resilience program', '\u20B914,999', ['12 sessions over 8 weeks', 'Bi-weekly wellness-lead check-in', 'Coordination with your therapist (on consent)', 'Private lounge access']),
    related: ['stress-relief', 'better-sleep'],
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
      lead: 'Across 24 corporate cohorts we\u2019ve delivered:',
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
      body: 'Corporate wellness fails when it\u2019s generic. Ours is outcomes-first: each member chooses their track (sleep, stress, recovery). We report anonymised utilisation to your HR lead. No steps to compete on. No gimmicks.',
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
      { q: 'Team size we work with?',                 a: 'Best fit is 15\u2013150. Larger enterprises: our team-plan lead will design a phased rollout.' },
      { q: 'Do you invoice on net-30?',                a: 'Yes. Standard for our corporate clients.' },
      { q: 'GST invoicing?',                            a: 'Yes. Full GST-compliant invoices with therapy codes.' },
      { q: 'Anonymised reporting?',                     a: 'Monthly utilisation dashboard for your HR lead. Never individual usage.' },
      { q: 'On-site workshops?',                        a: 'Yes \u2014 breathwork and sleep-hygiene workshops at your office, quarterly.' },
      { q: 'Trial cohort?',                              a: 'Start with 10 members for 4 weeks, full outcomes report, then commit.' },
    ],
    pricing: {
      single:     { name: 'Team trial',         price: 'From \u20B999,000', period: '/ 4 weeks',  features: ['10 members, 4 sessions each', 'Outcomes report', 'Dedicated coordinator'], cta: 'Start a trial',   featured: false },
      pack:       { name: 'Annual programme',   price: 'From \u20B94.8L',   period: '/ year',     features: ['30 members, unlimited eligible sessions', 'Quarterly workshops on-site', 'Anonymised utilisation dashboard', 'Named team lead'], cta: 'Design a programme', featured: true },
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
