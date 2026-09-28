"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAttendance } from '@/components/AttendanceProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  assignee: string;
}

export function GlobalAttendanceModal() {
  const { hasMarkedAttendance, markAttendance, isLoading, user, userRole } = useAttendance();
  const [showModal, setShowModal] = useState(false);
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [followUpLeads, setFollowUpLeads] = useState<any[]>([]);
  
  // Form State
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [otherTask, setOtherTask] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTelecaller = userRole === 'telecaller';

  // Check attendance status and time cutoff
  useEffect(() => {
    if (isLoading) return;

    // TEMPORARILY DISABLED CUTOFF FOR TESTING
    setIsPastCutoff(false);

    if (!hasMarkedAttendance) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [hasMarkedAttendance, isLoading]);

  // Fetch Assigned Projects / Follow Ups
  useEffect(() => {
    if (!user?.email || !showModal) return;
    
    if (isTelecaller) {
      const q = query(
        collection(db, 'leads'),
        where('createdBy', '==', user.email),
        where('status', '==', 'Follow-up')
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetched: any[] = [];
        querySnapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() });
        });
        setFollowUpLeads(fetched);
      });
      return () => unsubscribe();
    } else {
      const q = query(
        collection(db, 'projects'),
        where('assignee', '==', user.email)
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetched: Project[] = [];
        querySnapshot.forEach((doc) => {
          fetched.push({ id: doc.id, name: doc.data().name, assignee: doc.data().assignee });
        });
        setAssignedProjects(fetched);
      });
      return () => unsubscribe();
    }
  }, [user, showModal, isTelecaller]);

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTelecaller && selectedTasks.length === 0) {
      alert("Please select at least one task or project.");
      return;
    }
    
    setSubmitting(true);
    try {
      const taskString = isTelecaller ? 'Telecalling Follow-ups' : selectedTasks.join(', ');
      const desc = isTelecaller ? `Following up on ${followUpLeads.length} leads` : description;
      await markAttendance(taskString, desc, otherTask);
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert("Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatToDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full relative"
          >
            {isPastCutoff && !isTelecaller ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">You are late!</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  It is past 9:30 AM. You cannot access the portal without marking attendance. Since you are late, you cannot mark attendance. Please contact the Founder to unblock your account for the day.
                </p>
                {/* We DO NOT give a close button so they remain blocked! */}
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground mb-1">Morning Standup</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {isTelecaller 
                    ? "Welcome back! Here are your active follow-ups for today."
                    : "Please log your attendance and tasks for the day before 9:30 AM to access the portal."}
                </p>
                
                <form onSubmit={handleSubmitAttendance} className="space-y-4">
                  {isTelecaller ? (
                    <div>
                      <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-border rounded-lg bg-secondary/20 hide-scrollbar">
                        {followUpLeads.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No pending follow-ups! Great job.</p>
                        ) : (
                          followUpLeads.map(lead => (
                            <div key={lead.id} className="flex justify-between items-center p-2 bg-background rounded border border-border/50">
                              <span className="text-sm font-medium text-foreground">{lead.name}</span>
                              <span className="text-xs text-muted-foreground">{lead.followUpDate ? formatToDDMMYYYY(lead.followUpDate) : 'No Date'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Projects You'll Work On Today</label>
                        {assignedProjects.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic mb-2">No active projects assigned to you.</p>
                        ) : (
                          <div className="space-y-2 max-h-32 overflow-y-auto p-2 border border-border rounded-lg bg-secondary/20">
                            {assignedProjects.map(p => (
                              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-border text-foreground focus:ring-foreground"
                                  checked={selectedTasks.includes(p.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTasks([...selectedTasks, p.name]);
                                    } else {
                                      setSelectedTasks(selectedTasks.filter(t => t !== p.name));
                                    }
                                  }}
                                />
                                <span className="text-sm text-foreground">{p.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        
                        <label className="flex items-center gap-2 mt-2 cursor-pointer p-2">
                          <input 
                            type="checkbox" 
                            className="rounded border-border text-foreground focus:ring-foreground"
                            checked={selectedTasks.includes('Other')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTasks([...selectedTasks, 'Other']);
                              } else {
                                setSelectedTasks(selectedTasks.filter(t => t !== 'Other'));
                              }
                            }}
                          />
                          <span className="text-sm text-foreground">Other / Bug Fixes</span>
                        </label>
                      </div>

                      {selectedTasks.includes('Other') && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Other Tasks Details</label>
                          <input 
                            type="text"
                            value={otherTask}
                            onChange={(e) => setOtherTask(e.target.value)}
                            required
                            placeholder="Enter other tasks you will work on"
                            className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Work Description</label>
                        <textarea 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          required
                          placeholder="Briefly describe what you'll be working on..."
                          rows={3}
                          className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>
                    </>
                  )}

                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-foreground hover:opacity-90 disabled:opacity-70 text-background font-semibold py-2.5 rounded-lg transition-opacity mt-2"
                  >
                    {isTelecaller ? (submitting ? 'Starting day...' : 'Okay, Start Day') : (submitting ? 'Submitting...' : 'Mark Attendance & Enter')}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
