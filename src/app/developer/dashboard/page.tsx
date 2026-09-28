"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Coffee,
  MoreVertical,
  X,
  Briefcase
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { useAttendance } from '@/components/AttendanceProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  assignee: string;
  status: string;
  dueDate: string;
  progress: number;
  completedAt?: number;
}

export default function DeveloperDashboard() {
  const { hasMarkedAttendance, markAttendance, isLoading, user } = useAttendance();
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  // Dynamic chart data for the last 7 days
  const chartData = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDate = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    d.setHours(0, 0, 0, 0); // Start of day for accurate comparison
    
    // Find projects completed on this specific day
    const completedThatDay = assignedProjects.filter(p => {
      if (p.status !== 'Completed' || !p.completedAt) return false;
      const completedDate = new Date(p.completedAt);
      return completedDate.getDate() === d.getDate() && 
             completedDate.getMonth() === d.getMonth() && 
             completedDate.getFullYear() === d.getFullYear();
    }).length;

    chartData.push({
      name: daysOfWeek[d.getDay()],
      projects: completedThatDay
    });
  }

  // Fetch Assigned Projects
  useEffect(() => {
    if (!user?.email) return;
    
    try {
      const q = query(
        collection(db, 'projects'),
        where('assignee', '==', user.email)
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetched: Project[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetched.push({
            id: doc.id,
            name: data.name,
            assignee: data.assignee,
            status: data.status,
            dueDate: data.dueDate,
            progress: data.status === 'Completed' ? 100 : (data.progress || 0), // Default to 0 instead of 40
            completedAt: data.completedAt
          });
        });
        setAssignedProjects(fetched);
        setLoadingProjects(false);
      }, (error) => {
        console.error("Error fetching assigned projects", error);
        setLoadingProjects(false);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up projects listener", error);
      setLoadingProjects(false);
    }
  }, [user]);

  // Form states and attendance logic were moved to GlobalAttendanceModal
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Good Morning, {user?.displayName || 'Developer'} 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            {currentDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-1 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Assigned Projects
            <Briefcase className="w-4 h-4 text-muted-foreground" />
          </h2>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Active</div>
              <div className="text-5xl font-bold text-foreground tracking-tighter">
                {loadingProjects ? '-' : assignedProjects.filter(p => p.status !== 'Completed').length}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Completed This Month</div>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {loadingProjects ? '-' : assignedProjects.filter(p => {
                  if (p.status !== 'Completed') return false;
                  // If we don't have completedAt, we just check if status is completed (fallback)
                  // but ideally we check if it was completed this month
                  if (!p.completedAt) return true; 
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                  return p.completedAt >= startOfMonth;
                }).length}
              </div>
            </div>
          </div>
        </div>

        {/* Project Progress */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-2 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Project Progress
            <Link href="/developer/tasks" className="text-muted-foreground text-xs hover:text-foreground transition-colors">View All</Link>
          </h2>
          <div className="space-y-4">
            {loadingProjects ? (
              <p className="text-sm text-muted-foreground">Loading assigned projects...</p>
            ) : assignedProjects.filter(p => p.status !== 'Completed').length === 0 ? (
              <p className="text-sm text-muted-foreground">You don't have any active projects assigned yet.</p>
            ) : (
              assignedProjects.filter(p => p.status !== 'Completed').map((project) => (
                <div key={project.id}>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-foreground">{project.name}</span>
                    <span className="text-muted-foreground">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden border border-border">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className={`h-full rounded-full ${project.progress === 100 ? 'bg-green-500' : 'bg-foreground'}`} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Productivity Chart */}
        <div className="bg-card border border-border p-5 rounded-xl col-span-3 h-80 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
            Projects Delivered
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </h2>
          <div className="h-full pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 3]} 
                  allowDecimals={false}
                  tickCount={4}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Line type="monotone" dataKey="projects" stroke="var(--foreground)" strokeWidth={2} dot={{ fill: 'var(--background)', stroke: 'var(--foreground)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
