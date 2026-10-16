'use client';
import React from 'react';
import { cn } from './utils';
import { Button, Card, Badge, Pill } from './primitives';
import { Check, Star, ArrowRight, Sparkles, Quote } from 'lucide-react';

/* ------------------------------- HeroSection ------------------------------- */
export const HeroSection = ({
  eyebrow = 'Salt World',
  title = 'Breathe better. Live lighter.',
  subtitle = "Bengaluru's premier halotherapy sanctuary. Book your session in under a minute.",
  primaryCta = { label: 'Book a session' },
  secondaryCta = { label: 'Explore therapies' },
  media,
  className,
}) => (
  <section className={cn('relative overflow-hidden rounded-2xl border border-border bg-card', className)}>
    <div className="absolute inset-0 grid-bg pointer-events-none opacity-70" />
    <div className="relative grid md:grid-cols-2 gap-10 p-8 md:p-12 items-center">
      <div>
        <Pill tone="brand"><Sparkles className="h-3 w-3" /> {eyebrow}</Pill>
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">{title}</h1>
        <p className="mt-4 text-[16px] leading-7 text-muted-foreground max-w-md">{subtitle}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" size="lg" href={primaryCta.href} iconRight={<ArrowRight className="h-4 w-4" />}>{primaryCta.label}</Button>
          <Button variant="outline" size="lg" href={secondaryCta.href}>{secondaryCta.label}</Button>
        </div>
        <div className="mt-6 flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <div className="flex items-center gap-1">{[0,1,2,3,4].map(i => <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-500" />)}</div>
          <span>4.9 · 1,200+ sessions delivered</span>
        </div>
      </div>
      <div className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-border bg-gradient-to-br from-brand/20 via-background to-muted">
        {media || (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-full bg-brand/20 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">Hero media slot</div>
          </div>
        )}
      </div>
    </div>
  </section>
);

/* ------------------------------- CTASection ------------------------------- */
export const CTASection = ({
  title = 'Start your wellness journey today',
  subtitle = 'Your first session is on us for new members.',
  primaryCta = { label: 'Claim free session' },
  secondaryCta = { label: 'Talk to us' },
  variant = 'default', // 'default' | 'inverted'
  className,
}) => {
  const inverted = variant === 'inverted';
  return (
    <section className={cn(
      'rounded-2xl p-8 md:p-10 border',
      inverted ? 'bg-foreground text-background border-transparent' : 'bg-card text-card-foreground border-border',
      className
    )}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h3 className={cn('text-2xl md:text-3xl font-semibold tracking-tight', inverted ? 'text-background' : 'text-foreground')}>{title}</h3>
          <p className={cn('mt-2 text-[15px]', inverted ? 'text-background/70' : 'text-muted-foreground')}>{subtitle}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant={inverted ? 'secondary' : 'primary'} size="lg" href={primaryCta.href}>{primaryCta.label}</Button>
          <Button variant={inverted ? 'ghost' : 'outline'} size="lg" href={secondaryCta.href} className={inverted ? 'text-background hover:bg-background/10' : ''}>{secondaryCta.label}</Button>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------- PricingCard ------------------------------- */
export const PricingCard = ({
  name = 'Wellness',
  price = '₹3,499',
  period = '/ month',
  description = '8 sessions per month with priority booking.',
  features = ['8 salt therapy sessions', 'Priority slot booking', '10% off retail wellness store', 'Complimentary wellness consult'],
  cta = 'Choose plan',
  featured = false,
  className,
}) => (
  <Card
    className={cn('p-6 relative', featured && 'border-foreground shadow-lg', className)}
    elevation={featured ? 'raised' : 'flat'}
  >
    {featured && (
      <div className="absolute -top-2.5 left-6">
        <Badge tone="brand">Most popular</Badge>
      </div>
    )}
    <div className="text-[12.5px] font-medium text-muted-foreground uppercase tracking-wider">{name}</div>
    <div className="mt-3 flex items-baseline gap-1">
      <div className="text-4xl font-semibold tracking-tight">{price}</div>
      <div className="text-[13px] text-muted-foreground">{period}</div>
    </div>
    <p className="mt-2 text-[13.5px] text-muted-foreground leading-6">{description}</p>
    <ul className="mt-5 space-y-2">
      {features.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-[13.5px] text-foreground">
          <Check className="h-4 w-4 mt-0.5 text-brand shrink-0" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <Button variant={featured ? 'primary' : 'outline'} className="mt-6 w-full" size="lg">{cta}</Button>
  </Card>
);

/* ------------------------------- TestimonialCard ------------------------------- */
export const TestimonialCard = ({
  quote = 'I sleep deeper and breathe easier. Six weeks in, and my inhaler use is down to almost zero.',
  author = 'Anaya Rao',
  role = 'Member · Indiranagar',
  avatarUrl,
  rating = 5,
  className,
}) => (
  <Card className={cn('p-6', className)}>
    <Quote className="h-5 w-5 text-brand" />
    <p className="mt-3 text-[15px] leading-7 text-foreground">“{quote}”</p>
    <div className="mt-5 flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center text-[12px] font-semibold text-muted-foreground">
        {avatarUrl ? <img src={avatarUrl} alt={author} className="h-full w-full object-cover" /> : author.split(' ').map(x => x[0]).join('').slice(0,2)}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-medium text-foreground leading-tight">{author}</div>
        <div className="text-[11.5px] text-muted-foreground">{role}</div>
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-500" />
        ))}
      </div>
    </div>
  </Card>
);
