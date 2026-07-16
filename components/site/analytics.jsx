// Public Analytics injector — pulls the marketing tags configured in
// Admin → Settings → Analytics from /api/analytics-config and injects the
// appropriate <script> tags. No IDs → no scripts loaded (privacy by default).

'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export default function Analytics() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics-config')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (!cancelled) setCfg(d || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!cfg) return null;

  return (
    <>
      {/* Google Tag Manager */}
      {cfg.gtmId && (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${cfg.gtmId}');`}
          </Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${cfg.gtmId}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} title="gtm" />
          </noscript>
        </>
      )}

      {/* Google Analytics 4 */}
      {cfg.ga4Id && (
        <>
          <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${cfg.ga4Id}`} />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${cfg.ga4Id}');`}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {cfg.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${cfg.metaPixelId}'); fbq('track', 'PageView');`}
        </Script>
      )}

      {/* Google Ads conversion */}
      {cfg.googleAdsId && !cfg.ga4Id && (
        <>
          <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${cfg.googleAdsId}`} />
          <Script id="gads-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${cfg.googleAdsId}');`}
          </Script>
        </>
      )}
      {cfg.googleAdsId && cfg.ga4Id && (
        <Script id="gads-init-additional" strategy="afterInteractive">
          {`gtag('config', '${cfg.googleAdsId}');`}
        </Script>
      )}

      {/* Microsoft Clarity */}
      {cfg.clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${cfg.clarityId}");`}
        </Script>
      )}
    </>
  );
}
