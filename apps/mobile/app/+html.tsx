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
        <title>Vacationist — Plan trips together</title>
        <meta name="description" content="Collaborative trip planning for groups. Vote on activities, split expenses, manage shopping lists and travel docs — everyone in sync, in real time." />
        <meta name="theme-color" content="#0F0F0F" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
        <link rel="canonical" href="https://web.vacationist.app/" />
        <meta property="og:title" content="Vacationist — Plan trips together" />
        <meta property="og:description" content="Collaborative trip planning for groups. Vote on activities, split expenses, manage shopping lists and travel docs — everyone in sync, in real time." />
        <meta property="og:url" content="https://web.vacationist.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://vacationist.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Vacationist" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vacationist — Plan trips together" />
        <meta name="twitter:description" content="Collaborative trip planning for groups. Vote, split costs, share lists — everyone in sync." />
        <meta name="twitter:image" content="https://vacationist.app/og-image.png" />
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
