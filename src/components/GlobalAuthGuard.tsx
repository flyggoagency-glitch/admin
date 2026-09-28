"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export function GlobalAuthGuard() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        // We only enforce this for non-founders. 
        if (user.email === 'founder@flyggo.in' || user.email === 'founder@flyggo.com') {
          return;
        }

        const q = query(collection(db, 'team_members'), where("email", "==", user.email));
        
        unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
          if (snapshot.empty) {
            console.warn("Account removed from team_members. Forcing sign out.");
            try {
              await signOut(auth);
              router.push('/login');
            } catch (err) {
              console.error(err);
            }
          }
        }, async (error) => {
          console.warn("Auth guard listener error (likely account deleted):", error);
          // If we get permission denied, they are likely deleted from the system
          try {
            await signOut(auth);
            router.push('/login');
          } catch (err) {}
        });
      } else {
        // If not logged in at all, push to login
        router.push('/login');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [router]);

  return null;
}
