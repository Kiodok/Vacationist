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
        <title>Vacationist — Group Trip Planner | Split Expenses &amp; Vote on Activities</title>
        <meta name="description" content="The free group trip planning app. Vote on activities, split travel expenses, share packing lists, and manage accommodations — all in one place. No account needed to join." />
        <meta name="keywords" content="group trip planner, group vacation planning app, split travel expenses, activity voting app, bachelorette trip planning, family vacation app, group road trip planner, vacation tracker, shared trip organizer" />
        <meta name="theme-color" content="#0F0F0F" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
        <link rel="canonical" href="https://web.vacationist.app/" />
        <meta property="og:title" content="Vacationist — Group Trip Planner | Split Expenses &amp; Vote on Activities" />
        <meta property="og:description" content="The free group trip planning app. Vote on activities, split travel expenses, share packing lists, manage accommodations — all in one place. No account needed to join." />
        <meta property="og:url" content="https://web.vacationist.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://vacationist.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Vacationist" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vacationist — Group Trip Planner | Split Expenses &amp; Vote on Activities" />
        <meta name="twitter:description" content="The free group trip planner. Vote on activities, split expenses, share packing lists — perfect for group vacations, road trips, and bachelorette trips." />
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
              "description": "The free group trip planning app. Vote on activities, split travel expenses, share packing lists, and manage accommodations — all in one place.",
              "keywords": "group trip planner, group vacation planning app, split travel expenses, activity voting app, bachelorette trip planning, family vacation app, shared trip organizer",
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
            __html: `(function(){try{var t=localStorage.getItem('mmkv:theme_preference');var colorful=t===null||t==='colorful';var dark=!colorful&&(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches));document.documentElement.classList.toggle('dark',dark);document.documentElement.classList.toggle('colorful',colorful);document.documentElement.style.backgroundColor=colorful?'#FDA444':dark?'#0F0F0F':'#FFFFFF';}catch(e){}})();`,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
