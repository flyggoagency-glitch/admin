"use client";

import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

export function MobileBlocker() {
  const [isStrictMobile, setIsStrictMobile] = useState(false);

  useEffect(() => {
    const checkStrictMobile = () => {
      // 1. Check primary input mechanism (phones/tablets have coarse pointers, even in desktop mode)
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      
      // 2. Check standard Mobile User Agents
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // 3. iPadOS Desktop Mode workaround (claims to be Mac, but has touch)
      const isIPadDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      
      // 4. Android Desktop Site workaround (claims to be Linux, has touch, and typical mobile screen ratios)
      const isAndroidDesktop = /Linux x86_64/.test(navigator.userAgent) && navigator.maxTouchPoints > 0 && (window.screen.height > window.screen.width || window.innerHeight > window.innerWidth);

      if (hasCoarsePointer || isMobileUA || isIPadDesktop || isAndroidDesktop) {
        setIsStrictMobile(true);
      } else {
        setIsStrictMobile(false);
      }
    };

    checkStrictMobile();
    window.addEventListener('resize', checkStrictMobile);
    return () => window.removeEventListener('resize', checkStrictMobile);
  }, []);

  if (isStrictMobile) {
    return (
      <div className="fixed inset-0 z-[10000] bg-background flex flex-col items-center justify-center p-6 text-center">
        <Monitor className="w-16 h-16 mb-4 text-primary" />
        <h1 className="text-2xl font-bold mb-2">Desktop Required</h1>
        <p className="text-muted-foreground mb-6">
          Kindly switch to your PC. This portal is strictly for desktop viewing and cannot be accessed on mobile devices, even in Desktop Mode.
        </p>
      </div>
    );
  }

  // Fallback for regular CSS-based width blocking (handles narrow browser windows on actual PCs)
  return (
    <div className="fixed inset-0 z-[10000] bg-background flex-col items-center justify-center p-6 text-center flex md:hidden">
      <Monitor className="w-16 h-16 mb-4 text-primary" />
      <h1 className="text-2xl font-bold mb-2">Desktop Required</h1>
      <p className="text-muted-foreground mb-6">
        Kindly switch to your PC or maximize your browser. This portal is optimized for desktop viewing.
      </p>
    </div>
  );
}
