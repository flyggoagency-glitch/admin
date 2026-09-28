"use client";

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Users,
  Briefcase,
  TrendingUp,
  FolderKanban,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, doc, query, where, getDocs, getDoc, collectionGroup, updateDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';

interface AttendanceRecord {
  email: string;
  task: string;
  description: string;
  timeString: string;
  status: 'Present' | 'Late' | 'Absent';
  memberDocId?: string;
}

export default function FounderDashboard() {
  const [teamMembers, setTeamMembers] = useState<AttendanceRecord[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeCount, setActiveCount] = useState(0);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const [totalFollowUps, setTotalFollowUps] = useState(0);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const getTodayDocId = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  };

  const [myTasks, setMyTasks] = useState<any[]>([]);

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user);
      } else {
        // User not logged in or still loading
      }
    });

    const fetchData = async (user: any) => {
      setLoading(true);
      const fetchAttendance = async () => {
      try {
        const todayDate = getTodayDocId();
        
        // Fetch team members to get expected developers and map their emails to doc IDs
        const teamSnap = await getDocs(collection(db, 'team_members'));
        const emailToDocId = new Map<string, string>();
        teamSnap.docs.forEach(teamDoc => {
          if (teamDoc.data().email) emailToDocId.set(teamDoc.data().email, teamDoc.id);
        });

        // Fetch ALL attendance records across all users to bypass index requirement
        const attendanceQuery = collectionGroup(db, 'attendance');
        const attendanceSnap = await getDocs(attendanceQuery);
        
        const fetchedRecords: AttendanceRecord[] = [];
        const foundEmails = new Set<string>();

        attendanceSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.date === todayDate) {
            const email = data.email || 'Unknown';
            if (!emailToDocId.has(email)) return; // Hide deleted users

            const hasMarked = !!data.timeString;
            fetchedRecords.push({
              email: email,
              task: data.task || (hasMarked ? 'N/A' : 'Not marked yet'),
              description: data.description || '',
              timeString: data.timeString || '--:--',
              status: hasMarked ? (data.status || 'Present') : 'Absent',
              memberDocId: emailToDocId.get(email)
            });
            foundEmails.add(email);
          }
        });

        // Push 'Absent' for any developer who didn't mark attendance
        teamSnap.docs.forEach(teamDoc => {
          const teamData = teamDoc.data();
          if (teamData.role === 'Developer' && teamData.email) {
            if (!foundEmails.has(teamData.email)) {
              fetchedRecords.push({
                email: teamData.email,
                task: 'N/A',
                description: 'Did not mark attendance',
                timeString: '--:--',
                status: 'Absent',
                memberDocId: teamDoc.id
              });
            }
          }
        });

        setTeamMembers(fetchedRecords);
      } catch (error: any) {
        console.error("Error fetching team:", error);
        if (error.message?.includes('Missing or insufficient permissions')) {
          setErrorMsg('Firestore Permission Denied: Founder needs read access to team_members collection.');
        }
      }
    };

    const fetchProjects = async () => {
      try {
        const projectsSnap = await getDocs(collection(db, 'projects'));
        let active = 0;
        let atRisk = 0;
        let completed = 0;
        
        const fetchedProjects: any[] = [];

        projectsSnap.forEach(doc => {
          const data = doc.data();
          const status = data.status;
          if (status === 'Completed') {
            completed++;
          } else if (status === 'Assigned' || status === 'In Progress') {
            active++;
            fetchedProjects.push({ id: doc.id, ...data });
          }
        });
        
        setActiveCount(active);
        setCompletedCount(completed);
        setAtRiskCount(atRisk);
        setRecentProjects(fetchedProjects.slice(0, 5));
      } catch (error: any) {
        console.error("Error fetching projects:", error);
        if (error.message?.includes('Missing or insufficient permissions')) {
          setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Firestore Permission Denied: Founder needs read access to projects collection.');
        }
      }
    };

    const fetchMyTasks = async () => {
      try {
        const tasksSnap = await getDocs(query(collection(db, 'users', user.uid, 'tasks')));
        const fetchedTasks: any[] = [];
        tasksSnap.forEach(doc => {
          fetchedTasks.push({ id: doc.id, ...doc.data() });
        });
        // Sort in memory to avoid needing complex indexes if any
        fetchedTasks.sort((a, b) => b.createdAt - a.createdAt);
        setMyTasks(fetchedTasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };

    const fetchLeads = async () => {
      try {
        const leadsSnap = await getDocs(collection(db, 'leads'));
        let converted = 0;
        let pendingFollowUp = 0;
        leadsSnap.forEach(doc => {
          const data = doc.data();
          if (data.status === 'Converted') {
            converted++;
          } else if (data.status === 'Follow-up' || data.status === 'Pending Conversion' || data.status === 'Interested') {
            pendingFollowUp++;
          }
        });
        setTotalFollowUps(pendingFollowUp);
      } catch (error: any) {
        console.error("Error fetching leads:", error);
        if (error.message?.includes('Missing or insufficient permissions')) {
          setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Firestore Permission Denied: Founder needs read access to leads collection.');
        }
      }
    };

    await Promise.all([fetchAttendance(), fetchProjects(), fetchMyTasks(), fetchLeads()]);
    setLoading(false);
  }; // end of fetchData

  return () => unsubscribe();
}, [refreshTrigger]);

  const presentCount = teamMembers.filter(m => m.status === 'Present').length;
  const lateCount = teamMembers.filter(m => m.status === 'Late').length;
  const absentCount = teamMembers.filter(m => m.status === 'Absent').length;

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRequestUpdate = async (memberDocId: string | undefined, email: string) => {
    if (!memberDocId) {
      alert('Cannot find user record to ping. Make sure they are correctly added in the Team page.');
      return;
    }
    
    if (confirm(`Force an urgent update from ${email}? They will be blocked from using the app until they reply.`)) {
      try {
        await updateDoc(doc(db, 'team_members', memberDocId), { 
          updateRequested: true 
        });
        alert('Update requested! The developer will be blocked until they submit an update.');
      } catch (error: any) {
        console.error('Failed to request update:', error);
        alert('Failed to request update. Check console for details.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Founder Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            {currentDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/founder/projects?new=true"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Add Project
          </Link>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          <p className="font-semibold">Database Error:</p>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-sm mt-2">To fix this, go to your Firebase Console -&gt; Firestore Database -&gt; Rules and ensure your Founder account has read access.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Quick Stats */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-1 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Team Attendance
            <Users className="w-4 h-4 text-muted-foreground" />
          </h2>
          <div>
            <div className="flex gap-6 mt-2">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Present</div>
                <div className="text-4xl font-bold text-green-600 tracking-tighter">{loading ? '-' : presentCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Late</div>
                <div className="text-4xl font-bold text-yellow-600 tracking-tighter">{loading ? '-' : lateCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Absent</div>
                <div className="text-4xl font-bold text-red-600 tracking-tighter">{loading ? '-' : absentCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects & Leads Health */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-2 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Projects & Leads Overview
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full pb-1">
            <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Active Projects</div>
              <div className="text-3xl font-bold tracking-tighter">{loading ? '-' : activeCount}</div>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Completed Projects</div>
              <div className="text-3xl font-bold text-green-600 tracking-tighter">{loading ? '-' : completedCount}</div>
            </div>
            
            <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Pending Follow-ups</div>
              <div className="text-3xl font-bold text-amber-500 tracking-tighter">{loading ? '-' : totalFollowUps}</div>
            </div>
          </div>
        </div>

        {/* Today's Team Standup */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-1 md:col-span-2 shadow-sm min-h-[300px]">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Today's Team Standup
            <button className="text-xs text-muted-foreground hover:text-foreground">View All</button>
          </h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading attendance...</p>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No developers found.</p>
            ) : (
              teamMembers.map((member, i) => {
                const statusColor = 
                  member.status === 'Present' ? 'bg-green-500' : 
                  member.status === 'Late' ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={i} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        statusColor
                      )} />
                      <div>
                        <p className="text-base font-semibold text-foreground leading-none mb-1">{member.email}</p>
                        <p className="text-sm text-muted-foreground">Task: {member.task}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full inline-block",
                        member.status === 'Present' ? 'bg-green-100 text-green-700' :
                        member.status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {member.status}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{member.timeString}</span>
                        {member.memberDocId && (
                          <button 
                            onClick={() => handleRequestUpdate(member.memberDocId, member.email)} 
                            className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded-md transition-colors"
                            title="Force them to send an update"
                          >
                            Ping
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Projects List */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-1 md:col-span-1 shadow-sm h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Active Projects
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
            </h2>
            <Link href="/founder/projects" className="text-xs text-muted-foreground hover:text-foreground">View All</Link>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            ) : recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects found.</p>
            ) : (
              recentProjects.map(project => (
                <Link 
                  href={`/founder/projects/${project.id}`} 
                  key={project.id}
                  className="block p-3 bg-secondary/30 rounded-lg border border-border hover:bg-secondary/50 hover:border-foreground/30 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm truncate pr-2">{project.name}</h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200 shrink-0">
                      {project.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className="truncate pr-2">{project.assignee}</span>
                    <span className="shrink-0">{project.progress || 0}%</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* My Pending Tasks */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-1 md:col-span-3 shadow-sm h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              My Pending Tasks
            </h2>
            <Link href="/founder/tasks" className="text-xs text-muted-foreground hover:text-foreground">Manage Tasks</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <p className="text-sm text-muted-foreground col-span-full">Loading tasks...</p>
            ) : myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">You have no pending tasks. Enjoy your day!</p>
            ) : (
              myTasks.slice(0, 6).map(task => (
                <Link 
                  href="/founder/tasks" 
                  key={task.id}
                  className="flex flex-col p-3 bg-secondary/20 rounded-lg border border-border hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-4 h-4 rounded border border-muted-foreground/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


