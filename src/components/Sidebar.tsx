"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CheckSquare, 

  CalendarCheck, 
  Calendar,

  MessageSquare, 

  Settings,
  LogOut,

  History,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Dashboard', href: '/developer/dashboard', icon: LayoutDashboard },
  { name: 'My Tasks', href: '/developer/tasks', icon: CheckSquare },
  { name: 'Attendance', href: '/developer/attendance', icon: CalendarCheck },
  { name: 'Calendar', href: '/developer/calendar', icon: Calendar },
  { name: 'History', href: '/developer/history', icon: History },
  { name: 'Team Chat', href: '/developer/chat', icon: MessageSquare, showBadge: true },
  { name: 'Settings', href: '/developer/settings', icon: Settings },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [unreadCount, setUnreadCount] = useState(0);
  const initialLoad = useRef(true);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showEarlySignOutModal, setShowEarlySignOutModal] = useState(false);
  const [workNote, setWorkNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [activeProjects, setActiveProjects] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setCurrentUserEmail(currentUser.email);
        const q = query(collection(db, "team_messages"), where("read", "==", false));
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          let count = 0; let hasNew = false;
          snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
              const data = change.doc.data();
              if (data.uid !== currentUser.uid && data.roomId && data.roomId.includes(currentUser.email)) {
                hasNew = true;
              }
            }
          });
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid !== currentUser.uid && typeof data.read !== "undefined" && data.roomId && data.roomId.includes(currentUser.email)) {
              count++;
            }
          });
          setUnreadCount(count);
          if (initialLoad.current) {
            initialLoad.current = false;
          } else if (hasNew) {
            const tone = localStorage.getItem("notificationTone") || "/tones/tone1.wav";
            const audio = new Audio(tone);
            audio.play().catch(() => {});
          }
        }, (err) => console.warn("Dev snapshot err:", err));
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        setUnreadCount(0);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleSignOutClick = async () => {

    // TEST MODE: Disabled 6 PM restriction temporarily
    // if (currentHour < 18) { // 18 is 6:00 PM
    //   setShowEarlySignOutModal(true);
    //   return;
    // }
    
    setShowSignOutModal(true);
    setIsLoadingStats(true);
    
    try {
      if (auth.currentUser?.email) {
        const q = query(collection(db, "projects"), where("assignee", "==", auth.currentUser.email));
        const snap = await getDocs(q);
        
        let active = 0;
        let compToday = 0;
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        snap.forEach(doc => {
          const data = doc.data();
          if (data.status !== "Completed") {
            active++;
          } else {
            if (data.completedAt) {
              const compDate = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
              if (compDate >= startOfToday) {
                compToday++;
              }
            }
          }
        });
        
        setActiveProjects(active);
        setCompletedToday(compToday);
      }
    } catch (e) {
      console.error("Error fetching project stats:", e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const confirmSignOut = async () => {
    if (!workNote.trim()) {
      alert("Please write a brief note on what you worked on today.");
      return;
    }
    setIsSubmittingNote(true);
    try {
      if (currentUserEmail) {
        const usersSnap = await getDocs(collection(db, "users"));
        if (!usersSnap.empty) {
          const founderDoc = usersSnap.docs.find(doc => doc.data().role === "Founder") || usersSnap.docs[0];
          const founderUid = founderDoc.id;
          const roomId = `${founderUid}_${currentUserEmail}`;
          
          await addDoc(collection(db, "team_messages"), {
            text: `👋 I have signed out for the day.\n\n📊 **Daily Report:**\n• Projects Completed Today: ${completedToday}\n• Active Projects Remaining: ${activeProjects}\n\n📝 **Work Note:**\n${workNote}`,
            uid: auth.currentUser?.uid || "",
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: auth.currentUser?.displayName || currentUserEmail.split("@")[0],
            senderRole: "Developer",
            senderPicUrl: auth.currentUser?.photoURL || "",
            read: false
          });
        }
      }
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (
    <>
      <aside className="w-64 h-screen bg-card flex flex-col fixed left-0 top-0 border-r border-border z-50">
      <div className="p-6 flex items-center space-x-3">
        <span className="text-xl font-bold tracking-tight text-foreground">Flyggo Portal</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto hide-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-secondary text-secondary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="font-medium text-sm">{item.name}</span>
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

      <div className="p-4 border-t border-border space-y-2">
        
        <button 
          onClick={handleSignOutClick}
          className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Sign Out</span>
        </button>
      </div>
    </aside>
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-2">Sign Out</h2>
              <p className="text-sm text-muted-foreground mb-4">
                You are signing out for the day. Please review your daily stats and write a brief note.
              </p>
              
              <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-secondary/50 rounded-xl p-3 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Completed Today</div>
                  <div className="text-xl font-bold text-emerald-500">
                    {isLoadingStats ? "..." : completedToday}
                  </div>
                </div>
                <div className="flex-1 bg-secondary/50 rounded-xl p-3 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Active Projects</div>
                  <div className="text-xl font-bold text-blue-500">
                    {isLoadingStats ? "..." : activeProjects}
                  </div>
                </div>
              </div>
              
              <textarea
                value={workNote}
                onChange={(e) => setWorkNote(e.target.value)}
                placeholder="E.g., Finished the UI for the dashboard, fixed 2 bugs..."
                className="w-full h-32 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-6"
              />

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSignOutModal(false)}
                  disabled={isSubmittingNote}
                  className="flex-1 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSignOut}
                  disabled={isSubmittingNote}
                  className="flex-1 px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 font-medium transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingNote ? "Saving..." : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </>
                  )}
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
                You can only sign out after 6:00 PM. Please continue your work until then.
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








