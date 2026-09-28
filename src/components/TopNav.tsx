"use client";


import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export function TopNav() {
  const [user, setUser] = useState<User | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [dbName, setDbName] = useState<string | null>(null);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial network state
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Try fetching from users collection first (Founder or standard user)
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().role === 'Founder') {
          setDbName(userDoc.data().name);
          setDbRole(userDoc.data().role);
          setProfilePic(userDoc.data().profilePicUrl);
        } else if (currentUser.email) {
          // If not Founder, fetch from team_members
          const q = query(collection(db, 'team_members'), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const memberDoc = querySnapshot.docs[0];
            const data = memberDoc.data();
            setDbName(data.name);
            setDbRole(data.role);
            setProfilePic(data.profilePicUrl);
          }
        }
      } else {
        setProfilePic(null);
        setDbName(null);
        setDbRole(null);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getDisplayName = () => {
    if (dbName) return dbName;
    if (!user) return 'Loading...';
    if (user.displayName) return user.displayName;
    if (user.email) {
      const namePart = user.email.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return 'User';
  };

  const getRole = () => {
    if (dbRole) return dbRole;
    if (!user) return '';
    return user.email?.includes('founder') ? 'Founder' : 'Developer';
  };

  const displayName = getDisplayName();
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-background flex items-center justify-between px-8 sticky top-0 z-40 border-b border-border">
      <div className="flex-1 max-w-xl">
        <div></div>
      </div>
      
      <div className="flex items-center space-x-6 ml-4">
        <div className="flex items-center space-x-3 cursor-pointer group">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-foreground group-hover:opacity-80 transition-opacity">{displayName}</p>
            <p className="text-xs text-muted-foreground">{getRole()}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background overflow-hidden border border-border">
            {profilePic ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profilePic} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-xs">{initial}</span>
            )}
          </div>
        </div>
      </div>

      {/* Network Error Popup */}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <p className="text-sm font-medium">Network Error: You are currently offline. Retrying connection...</p>
        </div>
      )}
    </header>
  );
}


