import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Vacationist — Free Trip App for Group Travel &amp; Vacation Tracking</title>
        <meta name="description" content="The free trip app for group travel planning. Split expenses, track vacation spending, vote on activities, share lists in real time — sustainable travel coordination for any group." />
        <meta name="keywords" content="trip app, vacation tracker, group travel planning, split expenses, vacation tracking, road trip planner, group sharing, sustainable travel, timeshare vacation" />
        <meta name="theme-color" content="#0F0F0F" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
        <link rel="canonical" href="https://web.vacationist.app/" />
        <meta property="og:title" content="Vacationist — Free Trip App for Group Travel &amp; Vacation Tracking" />
        <meta property="og:description" content="The free trip app for group travel planning. Split expenses, track vacation spending, vote on activities, share lists in real time — sustainable travel coordination for any group." />
        <meta property="og:url" content="https://web.vacationist.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://vacationist.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Vacationist" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vacationist — Free Trip App for Group Travel &amp; Vacation Tracking" />
        <meta name="twitter:description" content="Free trip app for groups. Split expenses, vote on activities, track vacation spending — sustainable travel made simple." />
        <meta name="twitter:image" content="https://vacationist.app/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Vacationist",
              "url": "https://web.vacationist.app/",
              "applicationCategory": "TravelApplication",
              "description": "Free trip app for collaborative group travel planning. Split expenses, track vacation spending, vote on activities, share lists in real time.",
              "keywords": "trip app, vacation tracker, group travel planning, split expenses, vacation tracking, group sharing, sustainable travel",
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
            }),
          }}
        />
        {/*
          Apply the stored theme preference to <html> before React mounts so
          react-native-css-interop's MutationObserver reads the correct class
          when the NativeWind stylesheet is injected — preventing FOUC and the
          dark-mode-resets-on-refresh bug.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mmkv:theme_preference');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.backgroundColor=dark?'#0F0F0F':'#FFFFFF';}catch(e){}})();`,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
