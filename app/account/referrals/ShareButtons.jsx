'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle, Mail, Share2, Check } from 'lucide-react';

export default function ShareButtons({ code, shareLink }) {
  const [copied, setCopied] = useState(false);
  const message = `Come try Salt World with me — use my code ${code} and get points off your first session. ${shareLink}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); toast.success('Link copied'); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('Could not copy'); }
  };
  const shareWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  const shareSms      = () => window.open(`sms:?&body=${encodeURIComponent(message)}`);
  const shareEmail    = () => window.open(`mailto:?subject=${encodeURIComponent('Try Salt World with me')}&body=${encodeURIComponent(message)}`);
  const shareNative   = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Salt World', text: message, url: shareLink }); } catch { /* cancelled */ }
    } else copy();
  };

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={copy}          className="h-10 px-4 rounded-full bg-foreground text-background text-[13px] font-semibold inline-flex items-center gap-1.5">{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}</button>
      <button onClick={shareWhatsapp} className="h-10 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
      <button onClick={shareSms}      className="h-10 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted inline-flex items-center gap-1.5">SMS</button>
      <button onClick={shareEmail}    className="h-10 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</button>
      <button onClick={shareNative}   className="h-10 px-4 rounded-full border border-border text-[13px] font-medium hover:bg-muted inline-flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" /> Share</button>
    </div>
  );
}
