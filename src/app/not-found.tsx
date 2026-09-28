import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative min-h-[100svh] w-full bg-black overflow-x-hidden overflow-y-auto">
      <style dangerouslySetInnerHTML={{
        __html: `
          @font-face {
            font-family: "Geist Mono:SemiBold";
            font-style: normal;
            font-weight: 600;
            font-display: swap;
            src: url("https://static.figma.com/font/GeistMono_wght__1") format("woff2");
          }

          .font-geist-mono {
            font-family: "Geist Mono:SemiBold", monospace;
            font-weight: 600;
          }

          .text-gradient {
            background: linear-gradient(
              247.328deg,
              rgb(255, 255, 255) 2.5334%,
              rgba(255, 255, 255, 0.4) 93.612%
            );
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            /* Using standard background-clip for modern browsers alongside -webkit */
          }

          .heading-404 {
            font-size: clamp(140px, 52vw, 200px);
            letter-spacing: -0.09em;
            line-height: 1.1;
            /* Bottom padding to prevent clipping of numerals */
            padding-bottom: 20px;
            margin: 0;
            height: auto;
            min-height: 0;
          }

          .msg-text {
            font-size: clamp(16px, 4.5vw, 20px);
            letter-spacing: -1.3px;
            line-height: 1.1;
            color: white;
            margin: 0;
          }

          /* Desktop overrides */
          @media (min-width: 640px) {
            .heading-404 {
              font-size: 295.751px;
              letter-spacing: -24.6459px;
            }
            .msg-text {
              font-size: 24px;
              letter-spacing: -2px;
            }
          }
        `
      }} />

      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-100"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4"
      />

      {/* Header Logo */}
      <header 
        aria-label="Flyggo"
        className="absolute z-10 left-1/2 -translate-x-1/2 top-[32px] sm:top-[80px] scale-[0.75] sm:scale-100 origin-top flex items-center justify-center h-[40px]"
      >
        <span className="text-white text-3xl font-bold tracking-[0.15em] uppercase mt-1">FLYGGO</span>
      </header>

      {/* Centered 404 Content */}
      <div className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center w-[min(100%-40px,360px)] sm:w-[483px] gap-[28px] sm:gap-[44px]">
        <h1 className="font-geist-mono text-gradient heading-404">
          404
        </h1>
        
        <div className="h-[1px] bg-white w-full sm:w-[425px]" />
        
        <p className="font-geist-mono msg-text w-full">
          The path may be broken, but the journey isn't. Let's get you back.
        </p>

        <div className="mt-2 sm:mt-4">
          <Link 
            href="/login" 
            className="font-geist-mono inline-block text-sm sm:text-base text-white border border-white/30 hover:bg-white hover:text-black transition-all px-6 py-3 rounded-full uppercase tracking-wider shadow-sm"
          >
            Back to Home Page
          </Link>
        </div>
      </div>
    </main>
  );
}
