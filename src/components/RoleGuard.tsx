"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function RoleGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        if (user.email === 'founder@flyggo.in' || user.email === 'founder@flyggo.com') {
          if (!pathname.startsWith('/founder')) {
             router.push('/founder/dashboard');
          }
          return;
        }

        try {
          const q = query(collection(db, 'team_members'), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const memberData = querySnapshot.docs[0].data();
            const role = memberData.role?.toLowerCase() || 'developer';
            
            if (role === 'telecaller' && pathname.startsWith('/developer')) {
              router.push('/telecaller/dashboard');
            } else if (role !== 'telecaller' && pathname.startsWith('/telecaller')) {
              router.push('/developer/dashboard');
            }
          }
        } catch (error) {
          console.error("RoleGuard Error:", error);
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return null;
}
