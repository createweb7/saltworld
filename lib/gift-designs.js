// Salt World — Gift card designs. Each design is a full-bleed art direction
// (gradient + optional accent image) used across the designer, checkout, confirm
// and recipient-facing views. This is the single source of truth.

export const GIFT_DESIGNS = [
  {
    id: 'halite',
    name: 'Halite',
    subtitle: 'The signature.',
    palette: {
      bg: 'linear-gradient(135deg,#003D3A 0%,#005E58 55%,#00A79A 100%)',
      accent: 'hsl(30, 30%, 92%)',
      ink: '#F5F1EA',
      subInk: 'rgba(245,241,234,0.72)',
    },
    tag: 'Signature',
  },
  {
    id: 'bone',
    name: 'Bone',
    subtitle: 'Warm minimal.',
    palette: {
      bg: 'linear-gradient(135deg,#F5F1EA 0%,#E9E1D2 100%)',
      accent: '#0F3E3A',
      ink: '#0F3E3A',
      subInk: 'rgba(15,62,58,0.65)',
    },
    tag: 'Editorial',
  },
  {
    id: 'driftwood',
    name: 'Driftwood',
    subtitle: 'For milestones.',
    palette: {
      bg: 'linear-gradient(135deg,#B8956A 0%,#8A6E4E 100%)',
      accent: '#F5F1EA',
      ink: '#F5F1EA',
      subInk: 'rgba(245,241,234,0.75)',
    },
    tag: 'Anniversary',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    subtitle: 'For a quieter mind.',
    palette: {
      bg: 'linear-gradient(135deg,#0A1F1E 0%,#12332F 60%,#1E4F49 100%)',
      accent: '#B8956A',
      ink: '#F5F1EA',
      subInk: 'rgba(245,241,234,0.7)',
    },
    tag: 'Sleep · Stress',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    subtitle: 'For celebration.',
    palette: {
      bg: 'linear-gradient(135deg,#D9C6A5 0%,#B8956A 50%,#0F3E3A 100%)',
      accent: '#F5F1EA',
      ink: '#F5F1EA',
      subInk: 'rgba(245,241,234,0.72)',
    },
    tag: 'Birthday',
  },
  {
    id: 'clarity',
    name: 'Clarity',
    subtitle: 'Just the essentials.',
    palette: {
      bg: 'linear-gradient(135deg,#FFFFFF 0%,#F5F1EA 100%)',
      accent: '#0F3E3A',
      ink: '#0F3E3A',
      subInk: 'rgba(15,62,58,0.6)',
    },
    tag: 'Corporate',
  },
];

export const DENOMINATIONS = [1500, 2500, 5000, 10000, 20000, 50000];
export const MIN_GIFT_AMOUNT = 500;

// `icon` is a lucide-react component name — kept as a string here so this
// stays a plain data file; components/site/gift-card-preview.jsx maps it to
// the real icon.
export const OCCASIONS = [
  { id: 'birthday',     label: 'Birthday',       icon: 'Cake' },
  { id: 'anniversary',  label: 'Anniversary',    icon: 'HeartHandshake' },
  { id: 'thank-you',    label: 'Thank you',      icon: 'HandHeart' },
  { id: 'congrats',     label: 'Congratulations',icon: 'PartyPopper' },
  { id: 'just-because', label: 'Just because',   icon: 'Sparkles' },
  { id: 'corporate',    label: 'Corporate',      icon: 'Briefcase' },
];

export const OCCASIONS_BY_LABEL = Object.fromEntries(OCCASIONS.map((o) => [o.label, o]));
export const getOccasionIcon = (label) => OCCASIONS_BY_LABEL[label]?.icon || null;

export const GIFT_DESIGNS_BY_ID = Object.fromEntries(GIFT_DESIGNS.map((d) => [d.id, d]));
export const getDesign = (id) => GIFT_DESIGNS_BY_ID[id] || GIFT_DESIGNS[0];

export const formatINR = (n) => {
  if (typeof n !== 'number') return '\u20B90';
  return '\u20B9' + n.toLocaleString('en-IN');
};
