import { Monitor } from 'lucide-react';

export function MobileBlocker() {
  return (
    <div className="fixed inset-0 z-[10000] bg-background flex-col items-center justify-center p-6 text-center flex md:hidden">
      <Monitor className="w-16 h-16 mb-4 text-primary" />
      <h1 className="text-2xl font-bold mb-2">Desktop Required</h1>
      <p className="text-muted-foreground mb-6">
        Kindly switch to your PC. This portal is optimized for desktop viewing and cannot be accessed on mobile devices.
      </p>
    </div>
  );
}
