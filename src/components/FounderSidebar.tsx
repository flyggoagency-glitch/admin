"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Calendar, MessageSquare, History, BarChart2, ClipboardList, Wallet, ChevronDown, ChevronRight, Lock, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

interface SubItem {
  name: string;
  href: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  showBadge?: boolean;
  subItems?: SubItem[];
  requiresPin?: boolean;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/founder/dashboard', icon: LayoutDashboard },
  { name: 'My Tasks', href: '/founder/tasks', icon: ClipboardList },
  { name: 'Team Management', href: '/founder/team', icon: Users },
  { name: 'Telecaller', href: '/founder/telecaller', icon: PhoneCall },
  { name: 'Projects', href: '/founder/projects', icon: FolderKanban },
  { name: 'Calendar', href: '/founder/calendar', icon: Calendar },
  { name: 'History', href: '/founder/history', icon: History },
  { name: 'Analyse', href: '/founder/analyse', icon: BarChart2 },
  { name: 'Team Chat', href: '/founder/chat', icon: MessageSquare, showBadge: true },
  { 
    name: 'Accounts', 
    icon: Wallet,
    requiresPin: true,
    subItems: [
      { name: 'Accounts', href: '/founder/accounts' },
      { name: 'Banking', href: '/founder/accounts/banking' },
      { name: 'Money Stalk', href: '/founder/accounts/money-stalk' }, { name: 'Statistics', href: '/founder/accounts/statistics' }
    ]
  },
  { name: 'Settings', href: '/founder/settings', icon: Settings },
];

export function FounderSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  
  // PIN Modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pendingMenu, setPendingMenu] = useState<string | null>(null);

  const initialLoad = useRef(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const q = query(
          collection(db, 'team_messages'),
          where('read', '==', false)
        );
        
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          let count = 0;
          let hasNew = false;
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.uid !== currentUser.uid) {
                hasNew = true;
              }
            }
          });

          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid !== currentUser.uid && typeof data.read !== 'undefined') {
              count++;
            }
          });
          
          setUnreadCount(count);

          if (initialLoad.current) {
            initialLoad.current = false;
          } else if (hasNew) {
            const tone = localStorage.getItem('notificationTone') || '/tones/tone1.wav';
            const audio = new Audio(tone);
            audio.play().catch(() => { /* Autoplay blocked, safely ignore */ });
          }
        });
        
        return () => unsubscribeSnapshot();
      } else {
        setUnreadCount(0);
      }
    });
    
    return () => unsubscribeAuth();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const handleMenuClick = (item: NavItem, isExpanded: boolean) => {
    if (item.requiresPin && !isExpanded) {
      setPendingMenu(item.name);
      setPinInput('');
      setPinError(false);
      setPinModalOpen(true);
    } else {
      setExpandedMenus(prev => ({ ...prev, [item.name]: !isExpanded }));
    }
  };

  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    
    try {
      let savedPin = '8989'; // Default PIN
      const currentUser = auth.currentUser;
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().accountsPin) {
          savedPin = snap.data().accountsPin;
        }
      }

      if (pinInput === savedPin) {
        setPinModalOpen(false);
        if (pendingMenu) {
          setExpandedMenus(prev => ({ ...prev, [pendingMenu]: true }));
        }
      } else {
        setPinError(true);
        setPinInput('');
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      setPinError(true);
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
            const isActive = item.href ? (pathname === item.href || pathname.startsWith(`${item.href}/`)) : false;
            const isExpanded = expandedMenus[item.name] || isActive;
            const Icon = item.icon;
            
            return (
              <div key={item.name}>
                {item.subItems ? (
                  <button
                    onClick={() => handleMenuClick(item, isExpanded)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all duration-200 group",
                      isExpanded
                        ? "bg-secondary/50 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn(
                        "w-5 h-5 transition-colors",
                        isExpanded ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="font-medium text-sm">
                        {item.name}
                      </span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
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
                      <span className="font-medium text-sm">
                        {item.name}
                      </span>
                    </div>
                    {item.showBadge && unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                
                {/* Sub-items */}
                {item.subItems && isExpanded && (
                  <div className="mt-1 mb-2 ml-4 pl-4 border-l-2 border-border/50 space-y-1">
                    {item.subItems.map(subItem => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className={cn(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            isSubActive
                              ? "bg-secondary text-foreground font-medium shadow-sm"
                              : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
                          )}
                        >
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button 
            onClick={handleSignOut}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {pinModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-xs rounded-2xl shadow-xl border border-border p-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Enter PIN</h2>
                <p className="text-sm text-muted-foreground mb-6">This section is protected.</p>
                
                <form onSubmit={verifyPin} className="w-full space-y-4">
                  <input
                    type="password"
                    autoFocus
                    maxLength={4}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    className={cn(
                      "w-full text-center text-2xl tracking-[1em] font-mono bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2",
                      pinError ? "border-red-500 focus:ring-red-500/50" : "border-border focus:ring-primary/50"
                    )}
                    placeholder="****"
                  />
                  {pinError && (
                    <p className="text-xs text-red-500">Incorrect PIN. Please try again.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPinModalOpen(false)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pinInput.length !== 4}
                      className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Unlock
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

