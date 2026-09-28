"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, AlertTriangle, ArrowLeft, ChevronRight, ChevronLeft, Save, Eye, EyeOff, Lock, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAttendance } from '@/components/AttendanceProvider';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

interface ProjectData {
  id: string;
  name: string;
  clientContact?: string;
  clientEmail?: string;
  clientPassword?: string;
  projectDetails?: string;
  domainOption?: string;
  status: string;
}

export default function TaskWorkspacePage() {
  const { taskId } = useParams();
  const router = useRouter();
  const { handleDeliverProject } = useAttendance();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [lastSavedStep, setLastSavedStep] = useState(0);
  const totalSteps = 8;

  // Steps
  const [callCompleted, setCallCompleted] = useState(false); // 15%
  const [thirtyPercent, setThirtyPercent] = useState(false); // 30%
  const [liveUrl, setLiveUrl] = useState(''); // +20%
  const [clientSatisfied, setClientSatisfied] = useState(false); // +10%
  const [seoCompleted, setSeoCompleted] = useState(false); // +10%
  
  // Tech Stack
  const [usedFirebase, setUsedFirebase] = useState(false);
  const [usedCloudflare, setUsedCloudflare] = useState(false);
  const [usedAiBot, setUsedAiBot] = useState(false);
  
  const [githubLink, setGithubLink] = useState(''); // +10%

  const [showWarning, setShowWarning] = useState(false);
  const [fullyCompleted, setFullyCompleted] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      if (typeof taskId === 'string') {
        try {
          const docRef = doc(db, 'projects', taskId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProject({ id: docSnap.id, ...docSnap.data() } as ProjectData);
            
            // Mark it as In Progress if it was just Assigned
            if (docSnap.data().status === 'Assigned') {
              await updateDoc(docRef, { status: 'In Progress' });
            }
            
            if (docSnap.data().lastSavedStep) {
              setLastSavedStep(docSnap.data().lastSavedStep);
            }
            if (docSnap.data().status === 'Completed') {
              setFullyCompleted(true);
            }
            if (docSnap.data().liveUrl) setLiveUrl(docSnap.data().liveUrl);
            if (docSnap.data().githubLink) setGithubLink(docSnap.data().githubLink);
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

  let canProceed = false;
  if (currentStep === 1) canProceed = callCompleted;
  if (currentStep === 2) canProceed = thirtyPercent;
  if (currentStep === 3) canProceed = liveUrl.length > 5;
  if (currentStep === 4) canProceed = clientSatisfied;
  if (currentStep === 5) canProceed = seoCompleted;
  if (currentStep === 6) canProceed = true; // Tech stack is optional
  if (currentStep === 7) canProceed = githubLink.length > 5;
  if (currentStep === 8) canProceed = fullyCompleted;

  const isStepSaved = currentStep <= lastSavedStep;

  const handleNext = () => {
    if (currentStep < totalSteps && isStepSaved) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveStep = async () => {
    if (canProceed && !isStepSaved) {
      setLastSavedStep(currentStep);
      
      // Calculate progress synchronously for saving
      let newProgress = 0;
      if (currentStep >= 1) newProgress = Math.max(newProgress, 15);
      if (currentStep >= 2) newProgress = Math.max(newProgress, 30);
      if (currentStep >= 3) newProgress = 45;
      if (currentStep >= 4) newProgress = 60;
      if (currentStep >= 5) newProgress = 70;
      if (currentStep >= 6) newProgress = 80;
      if (currentStep >= 7) newProgress = 90;
      if (currentStep >= 8 || fullyCompleted) newProgress = 100;

      // Save progress to Firestore
      if (typeof taskId === 'string') {
        try {
          const timestamp = new Date().toLocaleString();
          const updateData: any = { 
            lastSavedStep: currentStep,
            progress: newProgress, 
            [`stepTimestamps.${currentStep}`]: timestamp
          };
          if (currentStep === 3 && liveUrl) updateData.liveUrl = liveUrl;
          if (currentStep === 7 && githubLink) updateData.githubLink = githubLink;
          
          await updateDoc(doc(db, 'projects', taskId), updateData);
        } catch (error) {
          console.error("Error saving step to Firebase", error);
        }
      }
    }
  };

  const handleFinalComplete = async () => {
    setFullyCompleted(true);
    setShowWarning(false);
    
    // Update firestore status
    if (taskId && typeof taskId === 'string') {
      await updateDoc(doc(db, 'projects', taskId), { status: 'Pending Team Verification' });

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let founderUid = '';
        if (!usersSnap.empty) {
          founderUid = usersSnap.docs[0].id;
        }

        const currentUser = auth.currentUser;
        if (founderUid && currentUser && currentUser.email) {
          const roomId = `${founderUid}_${currentUser.email}`;
          await addDoc(collection(db, 'team_messages'), {
            text: `✅ [Ready for Review] I have completed all steps for "${project?.name || 'the project'}" and submitted it for your final verification.`,
            uid: currentUser.uid,
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: currentUser.displayName || 'Developer',
            senderRole: 'Developer',
            senderPicUrl: currentUser.photoURL || '',
            read: false,
            actionText: 'Review Project',
            actionUrl: `/founder/projects/${taskId}`
          });
        }
      } catch (err) {
        console.error("Error sending submission message:", err);
      }
    }

    setTimeout(() => {
      router.push('/developer/tasks');
    }, 2000);
  };

  const renderSaveButton = () => {
    if (isStepSaved || currentStep === 8) return null;
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <button 
          onClick={handleSaveStep}
          disabled={!canProceed}
          className="bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> Save Step {currentStep}
        </button>
      </div>
    );
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
        <Link href="/developer/tasks" className="text-lg font-bold text-muted-foreground hover:text-foreground flex items-center gap-2 mb-4 w-max transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back to Tasks
        </Link>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">{project.name}</h1>
            <p className="text-sm text-muted-foreground font-medium">Active Workspace</p>
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

      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Secure Client Credentials
        </h2>
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
              <span className="w-4 h-4 text-muted-foreground">🌐</span>
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
              <label className={cn(
                "flex items-start gap-4 group bg-background border p-6 rounded-xl transition-all",
                isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0",
                  callCompleted ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {callCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={callCompleted} 
                  disabled={isStepSaved}
                  onChange={(e) => setCallCompleted(e.target.checked)} 
                />
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center justify-between">
                    Client Call Completed
                    {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">SAVED</span>}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Confirm that you have answered the call and talked to the client. This will mark the project as 15% complete.</div>
                </div>
              </label>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Development Milestone</h3>
              <label className={cn(
                "flex items-start gap-4 group bg-background border p-6 rounded-xl transition-all",
                isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0",
                  thirtyPercent ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {thirtyPercent && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={thirtyPercent} 
                  disabled={isStepSaved}
                  onChange={(e) => setThirtyPercent(e.target.checked)} 
                />
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center justify-between">
                    30% Completed
                    {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">SAVED</span>}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Check this box once the initial development phase is finished and the project has reached 30% completion.</div>
                </div>
              </label>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Deployment</h3>
              <p className="text-muted-foreground text-sm mb-4">Provide the live URL where the project is currently hosted.</p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase">Live URL</label>
                  {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">SAVED</span>}
                </div>
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={liveUrl}
                  disabled={isStepSaved}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg py-3 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-70"
                />
              </div>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Client Approval</h3>
              <label className={cn(
                "flex items-start gap-4 group bg-background border p-6 rounded-xl transition-all",
                isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0",
                  clientSatisfied ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {clientSatisfied && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={clientSatisfied} 
                  disabled={isStepSaved}
                  onChange={(e) => setClientSatisfied(e.target.checked)} 
                />
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center justify-between">
                    Client Satisfied
                    {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">SAVED</span>}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Confirm that the client has reviewed the live site and is completely satisfied with the result.</div>
                </div>
              </label>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Search Engine Optimization</h3>
              <label className={cn(
                "flex items-start gap-4 group bg-background border p-6 rounded-xl transition-all",
                isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0",
                  seoCompleted ? "bg-foreground border-foreground text-background" : "bg-background border-border"
                )}>
                  {seoCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={seoCompleted} 
                  disabled={isStepSaved}
                  onChange={(e) => setSeoCompleted(e.target.checked)} 
                />
                <div>
                  <div className="text-lg font-bold text-foreground mb-1 flex items-center justify-between">
                    SEO Completed
                    {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">SAVED</span>}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Check this to confirm that meta tags, keywords, and on-page SEO best practices have been implemented.</div>
                </div>
              </label>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Tech Stack Integration</h3>
              <p className="text-muted-foreground text-sm mb-4">Select the specific technologies utilized in this project.</p>
              
              <div className="grid grid-cols-1 gap-3">
                <label className={cn("flex items-center gap-4 group bg-background border p-4 rounded-xl transition-all", isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer")}>
                  <input type="checkbox" checked={usedFirebase} disabled={isStepSaved} onChange={(e) => setUsedFirebase(e.target.checked)} className="w-5 h-5 rounded border-border text-foreground focus:ring-ring" />
                  <span className="font-semibold text-foreground flex-1">Firebase</span>
                  {isStepSaved && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">SAVED</span>}
                </label>
                <label className={cn("flex items-center gap-4 group bg-background border p-4 rounded-xl transition-all", isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer")}>
                  <input type="checkbox" checked={usedCloudflare} disabled={isStepSaved} onChange={(e) => setUsedCloudflare(e.target.checked)} className="w-5 h-5 rounded border-border text-foreground focus:ring-ring" />
                  <span className="font-semibold text-foreground flex-1">Cloudflare</span>
                  {isStepSaved && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">SAVED</span>}
                </label>
                <label className={cn("flex items-center gap-4 group bg-background border p-4 rounded-xl transition-all", isStepSaved ? "border-border opacity-70 cursor-default" : "border-border hover:border-foreground/30 cursor-pointer")}>
                  <input type="checkbox" checked={usedAiBot} disabled={isStepSaved} onChange={(e) => setUsedAiBot(e.target.checked)} className="w-5 h-5 rounded border-border text-foreground focus:ring-ring" />
                  <span className="font-semibold text-foreground flex-1">AI Chat Bot</span>
                  {isStepSaved && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">SAVED</span>}
                </label>
              </div>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Repository</h3>
              <p className="text-muted-foreground text-sm mb-4">Link the source code repository for final handover.</p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase">GitHub Link</label>
                  {isStepSaved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">SAVED</span>}
                </div>
                <input 
                  type="url" 
                  placeholder="https://github.com/..."
                  value={githubLink}
                  disabled={isStepSaved}
                  onChange={(e) => setGithubLink(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg py-3 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-70"
                />
              </div>
              {renderSaveButton()}
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-2xl font-bold text-foreground mb-2">Final Delivery</h3>
              
              {fullyCompleted ? (
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 p-8 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                  <Check className="w-12 h-12 mb-4" /> 
                  <span className="text-xl">Sent for Verification!</span>
                  <p className="text-sm font-medium opacity-80 mt-2">Status is now Pending Team Verification.</p>
                </div>
              ) : showWarning ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-6 rounded-xl">
                  <div className="flex items-start gap-4 text-yellow-800 dark:text-yellow-500 mb-6">
                    <AlertTriangle className="w-6 h-6 shrink-0 mt-1" />
                    <div>
                      <h4 className="text-lg font-bold">Submit for verification?</h4>
                      <p className="text-sm mt-2 leading-relaxed">This action sends the project to the team for final review. You will not be able to modify the steps while it is pending verification.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 justify-end border-t border-yellow-200 dark:border-yellow-900/30 pt-4">
                    <button 
                      onClick={() => setShowWarning(false)}
                      className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleFinalComplete}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                      Yes, Submit Project
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-background border border-border p-8 rounded-xl text-center">
                  <p className="text-muted-foreground mb-6 text-sm">Please ensure all previous steps are accurate before submitting this project for verification.</p>
                  <button 
                    onClick={() => setShowWarning(true)}
                    disabled={progress < 90}
                    className="w-full max-w-md mx-auto bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-4 rounded-xl text-base font-bold transition-all shadow-md"
                  >
                    Submit for Verification
                  </button>
                </div>
              )}
            </div>
          )}
          
        </div>

        {/* Footer Navigation */}
        <div className="bg-secondary/30 border-t border-border p-4 flex items-center justify-between mt-auto">
          <button 
            onClick={handlePrev}
            disabled={currentStep === 1 || fullyCompleted}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <div className="flex items-center gap-3">
            {currentStep < totalSteps && (
              <button 
                onClick={handleNext}
                disabled={!isStepSaved || fullyCompleted}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
