import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6C63FF" />
        <meta name="application-name" content="QuizMaster" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="QuizMaster" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Prevent body scrolling on web */}
        <ScrollViewStyleReset />

        {/* Inline styles for layout */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>
        {children}

        {/* Register Service Worker */}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerScript }} />
      </body>
    </html>
  );
}

const responsiveBackground = `
  body {
    background-color: #f5f5f5;
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
  }

  #root, body, html {
    height: 100%;
  }

  body {
    overflow: hidden;
  }

  #root {
    display: flex;
  }
`;

const serviceWorkerScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(reg) {
          console.log('Service Worker registered:', reg.scope);
        })
        .catch(function(err) {
          console.log('Service Worker registration failed:', err);
        });
    });
  }
`;
