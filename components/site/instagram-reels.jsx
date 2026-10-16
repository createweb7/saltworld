'use client';

import { useEffect } from 'react';
import { Instagram } from 'lucide-react';

// Real reel permalinks pulled from the gift-guide pages you downloaded
// (saltworld.in's own Instagram posts). Rendered via Instagram's own
// official embed widget (embed.js, loaded below) — not a custom
// reconstruction of their post UI — so the real post, real like/comment
// counts and real profile link come straight from Instagram itself.
const REELS = [
  'https://www.instagram.com/reel/CoQ4Utxjq58/',
  'https://www.instagram.com/reel/CrxJ-KGuuFd/',
  'https://www.instagram.com/reel/CtOqZYysK7Y/',
  'https://www.instagram.com/reel/CvM2enVN6pY/',
  'https://www.instagram.com/reel/CvTvjNRLJTG/',
  'https://www.instagram.com/reel/CyQfBHpLA9G/',
];

export default function InstagramReels() {
  useEffect(() => {
    function process() {
      if (window.instgrm?.Embeds) window.instgrm.Embeds.process();
    }
    if (window.instgrm?.Embeds) {
      process();
      return;
    }
    const existing = document.getElementById('instagram-embed-js');
    if (existing) {
      existing.addEventListener('load', process);
      return () => existing.removeEventListener('load', process);
    }
    const script = document.createElement('script');
    script.id = 'instagram-embed-js';
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = process;
    document.body.appendChild(script);
  }, []);

  return (
    <section className="py-14 md:py-20 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          <Instagram className="h-3.5 w-3.5" /> Some feel-good gifting stories
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {REELS.map((url) => (
            <blockquote
              key={url}
              className="instagram-media"
              data-instgrm-captioned
              data-instgrm-permalink={url}
              data-instgrm-version="14"
              style={{ background: '#FFF', border: 0, borderRadius: 3, boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)', margin: '0 auto', maxWidth: 400, minWidth: 280, padding: 0, width: '99%' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
