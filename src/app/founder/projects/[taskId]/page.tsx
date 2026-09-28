"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, AlertTriangle, ArrowLeft, ChevronRight, ChevronLeft, Save, Eye, EyeOff, Lock, Phone, Mail, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore';

interface ProjectData {
  id: string;
  name: string;
  clientContact?: string;
  clientEmail?: string;
  clientPassword?: string;
  projectDetails?: string;
  domainOption?: string;
  status: string;
  lastSavedStep?: number;
  stepTimestamps?: Record<string, string>;
  liveUrl?: string;
  githubLink?: string;
  assignee?: string;
}

export default function FounderProjectViewPage() {
  const { taskId } = useParams();
  const router = useRouter();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [lastSavedStep, setLastSavedStep] = useState(0);
  const totalSteps = 8;
  const [fullyCompleted, setFullyCompleted] = useState(false);

  const [isEditingCreds, setIsEditingCreds] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [editCreds, setEditCreds] = useState({
    clientEmail: '',
    clientContact: '',
    clientPassword: '',
    domainOption: '',
    projectDetails: ''
  });

  const [isAlterationModalOpen, setIsAlterationModalOpen] = useState(false);
  const [alterationReason, setAlterationReason] = useState('');
  const [isSubmittingAlteration, setIsSubmittingAlteration] = useState(false);

  const handleEditClick = () => {
    setEditCreds({
      clientEmail: project?.clientEmail || '',
      clientContact: project?.clientContact || '',
      clientPassword: project?.clientPassword || '',
      domainOption: project?.domainOption || '',
      projectDetails: project?.projectDetails || ''
    });
    setIsEditingCreds(true);
  };

  const handleSaveCreds = async () => {
    if (!project || typeof taskId !== 'string') return;
    setSavingCreds(true);
    try {
      const docRef = doc(db, 'projects', taskId);
      await updateDoc(docRef, editCreds);
      setProject({ ...project, ...editCreds });
      setIsEditingCreds(false);
    } catch (e) {
      console.error(e);
      alert('Error updating credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (typeof taskId === 'string') {
        try {
          const docRef = doc(db, 'projects', taskId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProject({ id: docSnap.id, ...docSnap.data() } as ProjectData);
            
            if (docSnap.data().lastSavedStep) {
              setLastSavedStep(docSnap.data().lastSavedStep);
            }
            if (docSnap.data().status === 'Completed') {
              setFullyCompleted(true);
            }
          }
        } catch (error) {
          console.error("Error fetching project:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProject();
  }, [taskId]);

  // Calculate Progress based on saved steps
  let progress = 0;
  if (lastSavedStep >= 1) progress = Math.max(progress, 15);
  if (lastSavedStep >= 2) progress = Math.max(progress, 30);
  if (lastSavedStep >= 3) progress += 15;
  if (lastSavedStep >= 4) progress += 15;
  if (lastSavedStep >= 5) progress += 10;
  if (lastSavedStep >= 6) progress += 10;
  if (lastSavedStep >= 7) progress += 10;
  if (fullyCompleted) progress = 100;
  progress = Math.min(progress, 100);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleVerify = async () => {
    if (typeof taskId === 'string') {
      try {
        const docRef = doc(db, 'projects', taskId);
        await updateDoc(docRef, { 
          status: 'Completed',
          completedAt: Date.now() 
        });
        setProject(prev => prev ? { ...prev, status: 'Completed', completedAt: Date.now() } as any : null);
        setFullyCompleted(true);

        if (project?.assignee) {
          const { serverTimestamp, addDoc, collection, getDocs } = await import('firebase/firestore');
          const usersSnap = await getDocs(collection(db, 'users'));
          let founderUid = '';
          let founderName = 'Team';
          let founderPic = '';
          
          if (!usersSnap.empty) {
            founderUid = usersSnap.docs[0].id;
            founderName = usersSnap.docs[0].data().name || 'Team';
            founderPic = usersSnap.docs[0].data().profilePicUrl || '';
          }

          if (founderUid) {
            const roomId = `${founderUid}_${project.assignee}`;
            await addDoc(collection(db, 'team_messages'), {
              text: `🎉 [Project Verified] Great job! I have verified and fully accepted your work on "${project.name}". The project is now marked as Completed.`,
              uid: founderUid,
              roomId: roomId,
              createdAt: serverTimestamp(),
              senderName: founderName,
              senderRole: 'Founder',
              senderPicUrl: founderPic,
              read: false,
              actionText: 'View Completed Project',
              actionUrl: `/developer/tasks/${taskId}`
            });
          }
        }
      } catch (error) {
        console.error("Error verifying project:", error);
      }
    }
  };

  const openAlterationModal = () => {
    setAlterationReason('');
    setIsAlterationModalOpen(true);
  };

  const submitAlteration = async () => {
    if (typeof taskId === 'string') {
      if (alterationReason.trim() === '') {
        alert('An alteration reason is required to notify the developer.');
        return;
      }
      if (isSubmittingAlteration) return;
      setIsSubmittingAlteration(true);

      try {
        const docRef = doc(db, 'projects', taskId);
        await updateDoc(docRef, { 
          status: 'In Progress',
          lastSavedStep: 2, // Resets them before Live URL step (Step 3)
          progress: 30
        });
        setProject(prev => prev ? { ...prev, status: 'In Progress', lastSavedStep: 2, progress: 30 } as any : null);

        if (project?.assignee) {
          const { serverTimestamp } = await import('firebase/firestore');
          const usersSnap = await getDocs(collection(db, 'users'));
          let founderUid = '';
          let founderName = 'Team';
          let founderPic = '';
          
          if (!usersSnap.empty) {
            founderUid = usersSnap.docs[0].id;
            founderName = usersSnap.docs[0].data().name || 'Team';
            founderPic = usersSnap.docs[0].data().profilePicUrl || '';
          }

          if (founderUid) {
            const roomId = `${founderUid}_${project.assignee}`;
            await addDoc(collection(db, 'team_messages'), {
              text: `🚨 [Alteration Required] Your project "${project.name}" has been sent back for alterations.\n\nFeedback: "${alterationReason.trim()}"\n\nPlease update the necessary details (like the Live URL or GitHub Repository) and resubmit.`,
              uid: founderUid,
              roomId: roomId,
              createdAt: serverTimestamp(),
              senderName: founderName,
              senderRole: 'Founder',
              senderPicUrl: founderPic,
              read: false,
              actionText: 'Open Project',
              actionUrl: `/developer/tasks/${taskId}`
              });
            }
          }

          setIsAlterationModalOpen(false);
          alert('Alteration requested. The developer has been notified to update the URLs.');
        } catch (error) {
          console.error("Error requesting alteration:", error);
        } finally {
          setIsSubmittingAlteration(false);
        }
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">Loading workspace...</div>;
  }

  if (!project) {
    return <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">Project not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <Link href="/founder/projects" className="text-lg font-bold text-muted-foreground hover:text-foreground flex items-center gap-2 mb-4 w-max transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back to Projects
        </Link>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">{project.name}</h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Eye className="w-4 h-4"/> Read-Only Progress View
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground mb-1">{progress}%</div>
            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden border border-border">
              <div 
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-6 mb-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4" /> Secure Client Credentials & Details
          </h2>
          {!isEditingCreds ? (
            <button 
              onClick={handleEditClick}
              className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-md font-medium transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditingCreds(false)}
                className="text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCreds}
                disabled={savingCreds}
                className="text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded-md font-medium transition-colors"
              >
                {savingCreds ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        
        {!isEditingCreds ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {project.clientEmail || 'Not provided'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Phone</label>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {project.clientContact || 'Not provided'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Password</label>
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg pr-10">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    {showPassword ? (
                      <span>{project.clientPassword || 'Not provided'}</span>
                    ) : (
                      <span className="tracking-widest mt-1">••••••••</span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Domain</label>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  {project.domainOption || 'Not provided'}
                </div>
              </div>
            </div>
            
            {project.projectDetails && (
              <div className="mt-6 pt-4 border-t border-blue-100 dark:border-blue-900/30">
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Project Brief</label>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{project.projectDetails}</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                <input 
                  type="text" 
                  value={editCreds.clientEmail} 
                  onChange={e => setEditCreds({...editCreds, clientEmail: e.target.value})}
                  className="w-full text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Phone</label>
                <input 
                  type="text" 
                  value={editCreds.clientContact} 
                  onChange={e => setEditCreds({...editCreds, clientContact: e.target.value})}
                  className="w-full text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Password</label>
                <input 
                  type="text" 
                  value={editCreds.clientPassword} 
                  onChange={e => setEditCreds({...editCreds, clientPassword: e.target.value})}
                  className="w-full text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Domain</label>
                <input 
                  type="text" 
                  value={editCreds.domainOption} 
                  onChange={e => setEditCreds({...editCreds, domainOption: e.target.value})}
                  className="w-full text-sm font-medium text-foreground bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/30">
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Project Brief</label>
              <textarea 
                value={editCreds.projectDetails}
                onChange={e => setEditCreds({...editCreds, projectDetails: e.target.value})}
                className="w-full text-sm text-foreground bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Step Indicator Header */}
        <div className="bg-secondary/50 border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Step {currentStep} of {totalSteps}</h2>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i + 1 === currentStep ? "bg-foreground" : i + 1 <= lastSavedStep ? "bg-blue-500" : "bg-border"
                )} 
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 flex-1 flex flex-col justify-center">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Initial Contact</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 1 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 1 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    Client Call Completed
                    {lastSavedStep >= 1 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['1'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['1']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Confirm that the developer has answered the call and talked to the client.</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Development Milestone</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 2 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 2 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    30% Completed
                    {lastSavedStep >= 2 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['2'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['2']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">The initial development phase is finished and the project has reached 30% completion.</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Deployment</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 3 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 3 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    Live URL Provided
                    {lastSavedStep >= 3 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['3'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['3']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    The developer has successfully hosted the project and linked the URL.
                    {project.liveUrl && (
                      <div className="mt-3">
                        <a href={project.liveUrl.match(/^https?:\/\//i) ? project.liveUrl : `https://${project.liveUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                          Open Live Project <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Client Approval</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 4 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 4 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    Client Satisfied
                    {lastSavedStep >= 4 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['4'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['4']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">The client has reviewed the live site and is completely satisfied with the result.</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Search Engine Optimization</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 5 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 5 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    SEO Completed
                    {lastSavedStep >= 5 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['5'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['5']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Meta tags, keywords, and on-page SEO best practices have been implemented.</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Tech Stack Integration</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 6 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 6 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    Stack Selected
                    {lastSavedStep >= 6 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['6'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['6']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">The specific technologies utilized in this project have been confirmed.</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Repository</h3>
              <div className="flex items-start gap-4 bg-background border border-border p-6 rounded-xl">
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                  lastSavedStep >= 7 ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {lastSavedStep >= 7 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center gap-3">
                    GitHub Link Provided
                    {lastSavedStep >= 7 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">VERIFIED</span>
                        {project.stepTimestamps?.['7'] && (
                          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                            {project.stepTimestamps['7']}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PENDING</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    The source code repository for final handover is ready.
                    {project.githubLink && (
                      <div className="mt-3">
                        <a href={project.githubLink.match(/^https?:\/\//i) ? project.githubLink : `https://${project.githubLink}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                          Open GitHub Repository <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Final Delivery</h3>
              <div className="text-center py-8">
                {fullyCompleted ? (
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 p-8 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                    <Check className="w-12 h-12 mb-4" /> 
                    <span className="text-xl">Project Fully Completed & Delivered!</span>
                  </div>
                ) : project.status === 'Pending Team Verification' ? (
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-8 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                    <Check className="w-12 h-12 mb-4 text-blue-600" />
                    <span className="text-xl text-blue-800 dark:text-blue-400 mb-2">Ready for Verification</span>
                    <p className="text-sm font-medium opacity-80 text-blue-700 dark:text-blue-300 mb-6">The developer has submitted this project for final review.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={openAlterationModal}
                        className="bg-background hover:bg-secondary border border-border text-foreground px-8 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm"
                      >
                        Request Alteration
                      </button>
                      <button 
                        onClick={handleVerify}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm"
                      >
                        Verify & Mark as Completed
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-background border border-border p-8 rounded-xl flex flex-col items-center justify-center">
                    <AlertTriangle className="w-12 h-12 mb-4 text-yellow-500" /> 
                    <span className="text-xl font-bold text-foreground">Project Not Delivered Yet</span>
                    <p className="text-sm text-muted-foreground mt-2">The developer is still working on final delivery.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-secondary/30 border-t border-border p-4 flex items-center justify-between mt-auto">
          <button 
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <div className="flex items-center gap-3">
            {currentStep < totalSteps && (
              <button 
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background hover:opacity-90 rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alteration Modal */}
      {isAlterationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border p-6 rounded-xl shadow-lg max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-foreground mb-2">Request Alteration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide detailed feedback on what needs to be changed before the developer resubmits this project.
            </p>
            <textarea 
              value={alterationReason}
              onChange={e => setAlterationReason(e.target.value)}
              placeholder="Type your feedback here... (e.g. The logo needs to be bigger, or the GitHub link is broken)"
              className="w-full h-32 bg-secondary/50 border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsAlterationModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary rounded-lg transition-colors border border-transparent hover:border-border"
              >
                Cancel
              </button>
              <button 
                onClick={submitAlteration}
                disabled={!alterationReason.trim() || isSubmittingAlteration}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
              >
                {isSubmittingAlteration && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmittingAlteration ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
