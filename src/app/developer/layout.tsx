import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { AttendanceProvider } from '@/components/AttendanceProvider';
import { GlobalProjectListener } from '@/components/GlobalProjectListener';
import { GlobalAttendanceModal } from '@/components/GlobalAttendanceModal';
import { GlobalUpdateBlocker } from '@/components/GlobalUpdateBlocker';
import { GlobalAuthGuard } from '@/components/GlobalAuthGuard';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AttendanceProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col relative">
          <TopNav />
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <GlobalProjectListener />
      <GlobalAttendanceModal />
      <GlobalUpdateBlocker />
      <GlobalAuthGuard />
    </AttendanceProvider>
  );
}
