"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TopNav } from '@/components/TopNav';
import TelecallerSidebar from '@/components/TelecallerSidebar';

import { AttendanceProvider } from '@/components/AttendanceProvider';
import { GlobalAttendanceModal } from '@/components/GlobalAttendanceModal';
import { GlobalUpdateBlocker } from '@/components/GlobalUpdateBlocker';
import { GlobalAuthGuard } from '@/components/GlobalAuthGuard';

export default function TelecallerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        // Enforce telecaller role protection
        if (user.email === 'founder@flyggo.in' || user.email === 'founder@flyggo.com') {
          router.push('/founder/dashboard');
          return;
        }
        
        try {
          const q = query(collection(db, 'team_members'), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const memberData = querySnapshot.docs[0].data();
            const role = memberData.role?.toLowerCase() || 'developer';
            if (role !== 'telecaller') {
              router.push('/developer/dashboard');
            }
          } else {
            router.push('/developer/dashboard');
          }
        } catch (error) {
          console.error("Error verifying telecaller role:", error);
          router.push('/developer/dashboard');
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <AttendanceProvider>
      <div className="flex min-h-screen bg-background">
        <TelecallerSidebar />
        <div className="flex-1 ml-64 flex flex-col relative">
          <TopNav />
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <GlobalAttendanceModal />
      <GlobalUpdateBlocker />
      <GlobalAuthGuard />
    </AttendanceProvider>
  );
}
