// Salt World — full strategy document content, structured as pure data
// so the page component can render it consistently.

export const NAV = [
  { g: 'Foundation', items: [
    ['ux',        '01 · UX Strategy'],
    ['journey',   '02 · Customer Journey'],
    ['ia',        '03 · Information Architecture'],
    ['sitemap',   '04 · Sitemap'],
  ]},
  { g: 'Product', items: [
    ['homepage',  '05 · Homepage Wireframe'],
    ['landing',   '06 · Landing Page Strategy'],
    ['cms',       '07 · CMS Architecture'],
    ['seo',       '08 · SEO Strategy'],
    ['components','09 · Component Map'],
  ]},
  { g: 'Design', items: [
    ['language',  '10 · Design Language'],
    ['motion',    '11 · Motion Guidelines'],
    ['mobile',    '12 · Mobile UX'],
    ['tablet',    '13 · Tablet UX'],
    ['desktop',   '14 · Desktop UX'],
    ['a11y',      '15 · Accessibility'],
  ]},
  { g: 'Delivery', items: [
    ['perf',      '16 · Performance'],
    ['cwv',       '17 · Core Web Vitals'],
    ['imagery',   '18 · Image Strategy'],
    ['cro',       '19 · CRO Strategy'],
    ['ai',        '20 · Future AI Roadmap'],
  ]},
];

export const ALL_IDS = NAV.flatMap(g => g.items.map(([id]) => id));

// Design tokens proposed for the new brand — derived from the logo teal but
// evolved into a full luxury system.
export const PALETTE = [
  { name: 'Halite',   hex: '#0F766E', role: 'Primary · brand teal (from logo, deepened for premium feel)', text: '#F7F3EC' },
  { name: 'Basalt',   hex: '#0B0F0E', role: 'Text · near-black with a green undertone',                     text: '#F7F3EC' },
  { name: 'Bone',     hex: '#F7F3EC', role: 'Surface · warm off-white, the entire site breathes on this',    text: '#0B0F0E' },
  { name: 'Mist',     hex: '#EBF5F2', role: 'Sub-surface · pale mint, cards & tinted sections',              text: '#0B0F0E' },
  { name: 'Aurora',   hex: '#E9A87A', role: 'Accent · warm apricot, used sparingly for CTAs & moments',      text: '#0B0F0E' },
  { name: 'Kelp',     hex: '#264A46', role: 'Support · deeper teal for editorial contrast',                  text: '#F7F3EC' },
  { name: 'Sand',     hex: '#D9CFBF', role: 'Support · warm neutral for editorial pairing with imagery',     text: '#0B0F0E' },
  { name: 'Signal',   hex: '#B94A3A', role: 'System · error only',                                           text: '#F7F3EC' },
];

export const TYPE = [
  { role: 'Editorial display', font: 'Fraunces (variable serif)',      sample: 'Rest is a practice.',            note: 'Aman/Airbnb editorial voice. Reserved for hero titles and section leads.' },
  { role: 'UI title',          font: 'Inter Display / Inter',           sample: 'What brings you here today?',    note: 'All navigation, product UI, admin.' },
  { role: 'Body',              font: 'Inter',                           sample: 'Sixty minutes of guided salt.',  note: '15–17px, 1.6 line-height.' },
  { role: 'Micro / caption',   font: 'Inter',                           sample: 'HALITE · BENGALURU',             note: '11px, tracking +8%, uppercase.' },
  { role: 'Mono / data',       font: 'JetBrains Mono',                  sample: 'BK-2026-0142',                   note: 'Booking refs, admin IDs, code.' },
];

export const MOTION = [
  { name: 'Instant',  ms: 100, ease: 'linear',                             use: 'Color / focus state changes' },
  { name: 'Fast',     ms: 180, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',  use: 'Buttons, chips, hover' },
  { name: 'Standard', ms: 280, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',  use: 'Cards, popovers' },
  { name: 'Editorial',ms: 620, ease: 'cubic-bezier(0.19, 1, 0.22, 1)',     use: 'Hero reveal, section fades' },
  { name: 'Cinema',   ms: 1200,ease: 'cubic-bezier(0.16, 1, 0.3, 1)',      use: 'Ken Burns on photography' },
];
