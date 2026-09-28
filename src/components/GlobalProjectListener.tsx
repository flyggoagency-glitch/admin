"use client";

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAttendance } from '@/components/AttendanceProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function GlobalProjectListener() {
  const { user } = useAttendance();
  const [notifications, setNotifications] = useState<{id: string, projectName: string}[]>([]);
  const isInitialLoad = useRef(true);
  const router = useRouter();

  useEffect(() => {
    if (!user?.email) return;

    const q = query(collection(db, 'projects'), where('assignee', '==', user.email));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const projectData = change.doc.data();
          const newNotif = { id: change.doc.id, projectName: projectData.name };
          
          setNotifications(prev => [...prev, newNotif]);
          
          // Auto-remove after 5 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
          }, 5000);
        }
      });
    });

    return () => unsubscribe();
  }, [user?.email]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = (id: string) => {
    removeNotification(id);
    router.push('/developer/tasks');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-card border border-border shadow-2xl rounded-xl p-4 w-80 pointer-events-auto flex items-start gap-3 relative overflow-hidden group cursor-pointer hover:border-foreground/30 transition-colors"
            onClick={() => handleClick(notif.id)}
          >
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-lg shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-6">
              <h4 className="text-sm font-bold text-foreground">New Project Assigned!</h4>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{notif.projectName}</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notif.id);
              }}
              className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
