"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Briefcase, Calendar, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  assignee: string;
  status: string;
  progress?: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function ProjectAssignmentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [domainOption, setDomainOption] = useState('Provided by Client');
  
  // Financial fields (Founder only)
  const [totalAmount, setTotalAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');

  const fetchProjects = async () => {
    try {
      const q = query(collection(db, 'projects'));
      const querySnapshot = await getDocs(q);
      const fetched: Project[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status !== 'Completed') {
          fetched.push({ id: doc.id, ...data } as Project);
        }
      });
      setProjects(fetched);
    } catch (error) {
      console.error("Error fetching projects", error);
    }
  };

  const fetchTeam = async () => {
    try {
      const q = query(collection(db, 'team_members'));
      const querySnapshot = await getDocs(q);
      const fetched: TeamMember[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      setTeamMembers(fetched);
    } catch (error) {
      console.error("Error fetching team members", error);
    }
  };

  useEffect(() => {
    // Check if we should open the modal automatically
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('new') === 'true') {
        setShowModal(true);
        // Clean up URL so refresh doesn't reopen it
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    Promise.all([fetchProjects(), fetchTeam()]).then(() => {
      setLoading(false);
    });
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'projects'), {
        name: newTitle,
        assignee: newAssignee,
        clientContact,
        clientEmail,
        clientPassword,
        projectDetails,
        domainOption,
        status: 'Assigned',
        createdAt: Date.now(),
        totalAmount: Number(totalAmount) || 0,
        advanceAmount: Number(advanceAmount) || 0
      });
      
      // Also record this in a dedicated accounts ledger for the Accounts page to use
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'accounts_ledger'), {
          projectName: newTitle,
          type: 'Project Assigned',
          totalAmount: Number(totalAmount) || 0,
          advanceAmount: Number(advanceAmount) || 0,
          createdAt: Date.now()
        });

        // Also send automated chat message to the assignee
        if (newAssignee) {
          let founderId = auth.currentUser.uid;
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const founderDoc = usersSnap.docs.find(doc => doc.data().role === 'Founder') || usersSnap.docs[0];
            founderId = founderDoc.id;
          }
          const roomId = founderId + '_' + newAssignee;
          await addDoc(collection(db, 'team_messages'), {
            text: '🚀 **New Project Assigned:** ' + newTitle + '\n\nYou have been assigned a new project. Please check your dashboard for details.',
            uid: auth.currentUser.uid,
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: 'System (Founder)',
            senderRole: 'System',
            senderPicUrl: auth.currentUser.photoURL || '',
            read: false
          });
        }
      }

      setShowModal(false);
      setNewTitle('');
      setNewAssignee('');
      setClientContact('');
      setClientEmail('');
      setClientPassword('');
      setProjectDetails('');
      setDomainOption('Provided by Client');
      setTotalAmount('');
      setAdvanceAmount('');
      fetchProjects();
    } catch (error) {
      console.error("Error creating project", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        fetchProjects();
      } catch (error) {
        console.error("Error deleting project", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Project Assignments
          </h1>
          <p className="text-muted-foreground text-sm">
            Assign new projects and tasks to your team members.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-muted-foreground">Loading assignments...</div>
        ) : projects.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">No projects assigned yet.</div>
        ) : (
          projects.map((project) => {
            const assignedMember = teamMembers.find(m => m.email === project.assignee);
            const isSelf = project.assignee === auth.currentUser?.email || project.assignee === "self";
            const displayName = isSelf ? "Self (Founder)" : (assignedMember ? assignedMember.name : project.assignee);

            return (
              <div key={project.id} className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between hover:border-foreground/30 transition-colors group">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-secondary rounded-lg">
                      <Briefcase className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="px-2 py-1 bg-secondary text-xs font-bold rounded-md uppercase tracking-wider">{project.status}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">Assigned to: <span className="text-foreground font-medium">{displayName}</span></p>
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-1 font-semibold">
                      <span>Progress</span>
                      <span>{project.status === 'Completed' ? 100 : (project.progress || 0)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${project.status === 'Completed' ? 100 : (project.progress || 0)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-3 mt-2 flex justify-between items-center">
                  <button 
                    onClick={() => handleDeleteProject(project.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link href={`/founder/projects/${project.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                    Check Progress
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-xl w-full my-8"
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Assign New Project</h2>
              
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Project Title</label>
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="E.g., Client Portal MVP" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Assign To</label>
                    <select 
                      value={newAssignee} 
                      onChange={e => setNewAssignee(e.target.value)} 
                      required 
                      className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="" disabled>Select team member...</option>
                      <option value={auth.currentUser?.email || "self"}>Self (Founder)</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.email}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Domain Information</h3>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="domainOption" value="Provided by Client" checked={domainOption === 'Provided by Client'} onChange={(e) => setDomainOption(e.target.value)} className="w-4 h-4 text-foreground border-border focus:ring-ring" />
                      <span className="text-sm font-medium text-foreground">Domain provided by client</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="domainOption" value="Created by Flyggo" checked={domainOption === 'Created by Flyggo'} onChange={(e) => setDomainOption(e.target.value)} className="w-4 h-4 text-foreground border-border focus:ring-ring" />
                      <span className="text-sm font-medium text-foreground">Domain created by Flyggo</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Client Credentials (Secure)</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Client Email</label>
                      <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="client@domain.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Client Password</label>
                      <input type="text" value={clientPassword} onChange={e => setClientPassword(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Password for resources" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1">Contact Number</label>
                      <input type="text" value={clientContact} onChange={e => setClientContact(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2 bg-secondary/30 p-4 rounded-xl border-dashed">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Financial Details (Founder Only)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Total Project Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                        <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required min="0" className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Advance Collected</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                        <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} required min="0" className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Project Details / Brief</label>
                  <textarea 
                    value={projectDetails} 
                    onChange={e => setProjectDetails(e.target.value)} 
                    required 
                    rows={4}
                    className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" 
                    placeholder="Describe the project requirements..." 
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? 'Assigning...' : 'Assign Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

