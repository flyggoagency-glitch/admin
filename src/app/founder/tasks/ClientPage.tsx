"use client";

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ClipboardList, Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FounderTask {
  id: string;
  title: string;
  createdAt: number;
}

export default function FounderTasksPage() {
  const [tasks, setTasks] = useState<FounderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, 'users', currentUser.uid, 'tasks'), orderBy('createdAt', 'desc'));
        const unsubscribeTasks = onSnapshot(q, (snapshot) => {
          const fetched: FounderTask[] = [];
          snapshot.forEach((doc) => {
            fetched.push({ id: doc.id, ...doc.data() } as FounderTask);
          });
          setTasks(fetched);
          setLoading(false);
        }, (error) => {
          console.error("Firestore permission error on tasks:", error);
          setLoading(false);
        });
        return () => unsubscribeTasks();
      } else {
        setTasks([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;

    // Save title and clear immediately for instant typing of the next task
    const titleToSave = newTaskTitle;
    setNewTaskTitle('');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        title: titleToSave,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Error adding task:", error);
      // Restore the text if it failed
      setNewTaskTitle(titleToSave);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto py-12 text-center text-muted-foreground">Loading your tasks...</div>;
  }

  // Helper to format timestamps into date groups
  const formatDateGroup = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  // Group tasks by date
  const groupedTasks: Record<string, FounderTask[]> = {};
  tasks.forEach(task => {
    const groupName = formatDateGroup(task.createdAt);
    if (!groupedTasks[groupName]) {
      groupedTasks[groupName] = [];
    }
    groupedTasks[groupName].push(task);
  });

  return (
    <div className="max-w-3xl mx-auto pb-12 pt-4 min-h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center mb-6">
          <ClipboardList className="mr-3 w-6 h-6 text-primary" />
          My Tasks
        </h1>
        
        <form onSubmit={handleAddTask} className="flex gap-3">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-shadow"
            placeholder="What needs to be done?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            // We no longer disable the input so you never lose focus while typing rapidly
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim() || isSubmitting}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center shrink-0"
          >
            <Plus className="w-5 h-5 mr-1" />
            Add
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex-1">
        {tasks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic flex flex-col items-center justify-center h-full">
            <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
            <p>You have no pending tasks. Enjoy your day!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(groupedTasks).map(([dateLabel, dateTasks]) => (
              <div key={dateLabel} className="pb-2">
                <div className="bg-muted/30 px-6 py-2 flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {dateLabel}
                </div>
                <ul className="divide-y divide-border/50">
                  <AnimatePresence>
                    {dateTasks.map((task) => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        className="flex items-center p-4 sm:px-6 hover:bg-muted/10 transition-colors group"
                      >
                        <label className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 appearance-none rounded border border-muted-foreground/30 checked:bg-emerald-500 checked:border-emerald-500 transition-colors peer cursor-pointer"
                              onChange={() => deleteTask(task.id)}
                            />
                            <svg className="w-3.5 h-3.5 absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-foreground text-lg group-hover:text-foreground/80 transition-colors">
                              {task.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(task.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </label>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-500/10 shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
