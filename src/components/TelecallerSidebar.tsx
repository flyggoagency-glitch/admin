"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PhoneCall, 
  CalendarCheck, 
  CalendarDays, 
  MessageSquareText, 
  Settings,
  History,
  LogOut,
  X,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/firebase';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function TelecallerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showEarlySignOutModal, setShowEarlySignOutModal] = useState(false);
  const [reportData, setReportData] = useState({ interested: 0, converted: 0 });
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const founderDoc = usersSnap.docs.find(doc => doc.data().role === 'Founder') || usersSnap.docs[0];
            const founderUid = founderDoc.id;
            const roomId = `${founderUid}_${currentUser.email}`;
            
            const q = query(
              collection(db, 'team_messages'),
              where('roomId', '==', roomId)
            );
            
            let initialLoad = true;
            unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
              let count = 0;
              let hasNew = false;
              
              snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                  const data = change.doc.data();
                  if (data.uid !== currentUser.uid && data.read === false) {
                    hasNew = true;
                  }
                }
              });

              snapshot.forEach(doc => {
                const data = doc.data();
                if (data.uid !== currentUser.uid && data.read === false) {
                  count++;
                }
              });
              
              setUnreadCount(count);

              if (initialLoad) {
                initialLoad = false;
              } else if (hasNew) {
                const tone = localStorage.getItem('notificationTone') || '/tones/tone1.wav';
                const audio = new Audio(tone);
                audio.play().catch(() => {});
              }
            }, (err) => console.warn("Telecaller snapshot listener error:", err));
          }
        } catch (error) {
          console.error("Error setting up notification listener:", error);
        }
      } else {
        setUnreadCount(0);
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const menuItems = [
    { name: 'Dashboard', href: '/telecaller/dashboard', icon: LayoutDashboard },
    { name: 'Leads & Calls', href: '/telecaller/leads', icon: PhoneCall },
    { name: 'Attendance', href: '/telecaller/attendance', icon: CalendarCheck },
    { name: 'Calendar', href: '/telecaller/calendar', icon: CalendarDays },
    { name: 'History', href: '/telecaller/history', icon: History },
    { name: 'Team Chat', href: '/telecaller/chat', icon: MessageSquareText, showBadge: true },
    { name: 'Settings', href: '/telecaller/settings', icon: Settings },
  ];

  const handleSignOutClick = async () => {
    const currentHour = new Date().getHours();
    // TEST MODE: Disabled 5 PM restriction temporarily
    // if (currentHour < 17) { // 17 is 5:00 PM
    //   setShowEarlySignOutModal(true);
    //   return;
    // }

    setShowSignOutModal(true);
    setIsLoadingReport(true);

    if (user?.email) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(collection(db, 'leads'), where('createdBy', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        let newInterested = 0;
        let convertedToday = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
          const completedAt = data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : null);
          
          // Total new interested today: Created today and not converted/dead.
          if (createdAt && createdAt >= today && data.status !== 'Converted' && data.status !== 'Dead') {
            newInterested++;
          }
          
          // Converted today
          if (completedAt && completedAt >= today && data.status === 'Converted') {
            convertedToday++;
          }
        });

        setReportData({ interested: newInterested, converted: convertedToday });
      } catch (error) {
        console.error("Failed to fetch report data", error);
      }
    }
    setIsLoadingReport(false);
  };

  const confirmSignOut = async () => {
    try {
      // Send sign-out report to founder
      if (user && user.email) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const founderDoc = usersSnap.docs.find(doc => doc.data().role === 'Founder') || usersSnap.docs[0];
            const founderUid = founderDoc.id;
            const roomId = `${founderUid}_${user.email}`;
            
            await addDoc(collection(db, 'team_messages'), {
              text: `👋 I have signed out for the day. \n\n📊 **Daily Summary:**\n- Total New Interested: **${reportData.interested}**\n- Converted Today: **${reportData.converted}**`,
              uid: user.uid,
              roomId: roomId,
              createdAt: serverTimestamp(),
              senderName: user.displayName || user.email.split('@')[0],
              senderRole: 'Telecaller',
              senderPicUrl: user.photoURL || '',
              read: false
            });
          }
        } catch (msgErr) {
          console.error("Failed to send sign-out message to founder:", msgErr);
        }
      }

      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <aside className="w-64 h-screen bg-card flex flex-col fixed left-0 top-0 border-r border-border z-50">
        <div className="p-6 flex items-center space-x-3">
          <span className="text-xl font-bold tracking-tight text-foreground">Flyggo Portal</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto hide-scrollbar">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-foreground/5 text-foreground font-semibold" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:translate-x-1"
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn(
                    "w-5 h-5 mr-3 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {item.name}
                </div>
                {item.showBadge && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto p-4 border-t border-border space-y-4">
          <div className="px-4 py-3 text-xs text-muted-foreground bg-secondary/30 rounded-xl">
            <p className="font-semibold mb-1 text-foreground">Telecaller Portal</p>
            <p>Manage leads, follow-ups, and track your call performance.</p>
          </div>
          
          <button 
            onClick={handleSignOutClick}
            className="flex items-center justify-center space-x-2 px-4 py-2 w-full rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-xl max-w-sm w-full relative"
            >
              <button 
                onClick={() => setShowSignOutModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-foreground mb-4">Daily Report</h2>
              
              {isLoadingReport ? (
                <div className="flex justify-center items-center h-24">
                  <p className="text-sm text-muted-foreground">Generating report...</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-xl border border-border">
                    <span className="text-sm font-medium text-muted-foreground">Total New Interested Today:</span>
                    <span className="text-xl font-bold text-foreground">{reportData.interested}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-medium text-emerald-700">Converted Today:</span>
                    <span className="text-xl font-bold text-emerald-700">{reportData.converted}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Great work today! Click below to confirm sign out.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-border text-foreground hover:bg-secondary/50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSignOut}
                  className="flex-1 px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 font-medium transition-opacity flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
            <AnimatePresence>
          {showEarlySignOutModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Too Early to Sign Out</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  You can only sign out after 5:00 PM. Please continue your work until then.
                </p>
                <button 
                  onClick={() => setShowEarlySignOutModal(false)}
                  className="w-full px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 font-medium transition-opacity"
                >
                  Understood
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
  );
}



