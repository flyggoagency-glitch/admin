"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock, Building2, Eye, EyeOff, X, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Project {
  id: string;
  name: string;
  assignee: string;
  status: string;
  dueDate: string;
  projectDetails?: string;
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedTask, setSelectedTask] = useState<Project | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        try {
          const q = query(collection(db, 'projects'), where('assignee', '==', user.email));
          const unsubscribeProjects = onSnapshot(q, (querySnapshot) => {
            const fetched: Project[] = [];
            querySnapshot.forEach((doc) => {
              fetched.push({ id: doc.id, ...doc.data() } as Project);
            });
            setTasks(fetched);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching tasks:", error);
            setLoading(false);
          });
          
          return () => unsubscribeProjects();
        } catch (error) {
          console.error("Error setting up snapshot:", error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const openModal = (task: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
  };

  const closeModal = () => {
    setSelectedTask(null);
  };

  const displayedTasks = tasks.filter(task => task.status !== 'Completed');

  return (
    <div className="max-w-4xl mx-auto pb-12 relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Tasks
          </h1>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            Loading assigned tasks...
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            No active tasks currently assigned.
          </div>
        ) : (
          displayedTasks.map((task) => {
            return (
              <div 
                key={task.id} 
                className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:border-foreground/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => router.push(`/developer/tasks/${task.id}`)}>
                    <h2 className="text-3xl font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                      {task.name}
                    </h2>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                        <Briefcase className="w-4 h-4" />
                        Status:
                      </div>
                      <span className={cn(
                        "text-[11px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full border shadow-sm",
                        task.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" :
                        task.status === 'Pending Team Verification' ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" :
                        task.status === 'In Progress' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" :
                        "bg-secondary text-foreground border-border"
                      )}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between ml-4 space-y-4">
                    <div className="flex flex-col items-end space-y-2 mt-auto">
                      <Link href={`/developer/tasks/${task.id}`} className="flex items-center gap-1 text-base font-semibold text-foreground hover:text-blue-600 transition-colors">
                        Open Workspace <ChevronRight className="w-5 h-5" />
                      </Link>
                      
                      <button 
                        onClick={(e) => openModal(task, e)}
                        className="text-sm font-semibold text-foreground bg-secondary hover:bg-secondary/80 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mt-2"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-xl font-bold text-foreground">{selectedTask.name}</h3>
              </div>
              <button 
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Status</label>
                <div className="bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground cursor-not-allowed">
                  {selectedTask.status}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Assignee</label>
                <div className="bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground cursor-not-allowed">
                  {selectedTask.assignee}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Project Brief</label>
                <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground leading-relaxed cursor-not-allowed whitespace-pre-wrap">
                  {selectedTask.projectDetails || 'No brief provided.'}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end">
              <button 
                onClick={closeModal}
                className="bg-foreground text-background hover:opacity-90 px-6 py-2 rounded-lg text-sm font-bold transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
