import { FounderSidebar } from '@/components/FounderSidebar';
import { TopNav } from '@/components/TopNav';

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <FounderSidebar />
      <div className="flex-1 ml-64 flex flex-col relative">
        <TopNav />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
