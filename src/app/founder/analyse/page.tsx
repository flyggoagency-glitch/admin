"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { BarChart2, Briefcase, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Project {
  id: string;
  name: string;
  assignee: string;
  status: string;
  createdAt?: number;
  completedAt?: number;
  clientEmail?: string;
}

export default function AnalysePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All Time' | 'Today' | 'This Week' | 'This Month'>('All Time');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(collection(db, 'projects'));
        const snap = await getDocs(q);
        const fetched: Project[] = [];
        snap.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(fetched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const [viewMode, setViewMode] = useState<'all' | 'active' | 'completed'>('completed');
  const [showCharts, setShowCharts] = useState(false);
  const handleClearAll = async () => {
    if (confirm("Are you sure you want to delete ALL projects and analytics data? This action cannot be undone.")) {
      try {
        const q = query(collection(db, 'projects'));
        const snap = await getDocs(q);
        const promises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
        setProjects([]);
        alert("All projects have been cleared successfully.");
      } catch (err) {
        console.error(err);
        alert("Error clearing projects.");
      }
    }
  };

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status !== 'Completed');
  const completedProjects = projects.filter(p => p.status === 'Completed');

  // Generate last 6 months for chart data
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      label: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear(),
      year: d.getFullYear(),
      month: d.getMonth()
    };
  });

  const trendData = last6Months.map(m => {
    const taken = projects.filter(p => {
      let created = p.createdAt;
      // Fallback for older projects that were created before the createdAt field was added
      if (!created) {
        if (p.status === 'Completed' && p.completedAt) {
          created = p.completedAt; // Fallback to completed month
        } else {
          created = Date.now(); // Fallback to current month
        }
      }
      
      const d = new Date(created);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length;

    const completed = completedProjects.filter(p => {
      if (p.completedAt) {
        const d = new Date(p.completedAt);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }
      return false;
    }).length;

    return {
      name: m.label,
      "Projects Taken": taken,
      "Projects Completed": completed
    };
  });

  // Filter completed projects based on selection
  const filteredCompleted = completedProjects.filter(p => {
    if (filter === 'All Time' || !p.completedAt) return true;
    
    const projectDate = new Date(p.completedAt);
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday start week
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    if (filter === 'Today') {
      return projectDate >= todayStart;
    }
    if (filter === 'This Week') {
      return projectDate >= weekStart;
    }
    if (filter === 'This Month') {
      return projectDate >= monthStart;
    }
    return true;
  });

  const getDisplayedProjects = () => {
    if (viewMode === 'all') return projects;
    if (viewMode === 'active') return activeProjects;
    return filteredCompleted;
  };

  const displayedProjects = getDisplayedProjects();

  if (loading) {
    return <div className="max-w-6xl mx-auto py-12 text-center text-muted-foreground">Loading Analytics...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 pt-4">
              <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <BarChart2 className="mr-3 w-6 h-6 text-primary" />
            Project Analytics
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleClearAll}
              className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </button>
            <button 
              onClick={() => setShowCharts(!showCharts)}
              className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {showCharts ? 'Hide Monthly Trends' : 'Compare Monthly Trends'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div 
          onClick={() => setViewMode('all')}
          className={`border p-6 rounded-xl shadow-sm flex items-center cursor-pointer transition-all ${viewMode === 'all' ? 'bg-primary/5 border-primary shadow-md' : 'bg-card border-border hover:border-primary/50'}`}
        >
          <div className="bg-primary/10 p-4 rounded-full mr-5">
            <Briefcase className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Total Projects Taken</p>
            <p className="text-3xl font-bold text-foreground">{totalProjects}</p>
          </div>
        </div>

        <div 
          onClick={() => setViewMode('active')}
          className={`border p-6 rounded-xl shadow-sm flex items-center cursor-pointer transition-all ${viewMode === 'active' ? 'bg-amber-500/5 border-amber-500 shadow-md' : 'bg-card border-border hover:border-amber-500/50'}`}
        >
          <div className="bg-amber-500/10 p-4 rounded-full mr-5">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Currently Working</p>
            <p className="text-3xl font-bold text-foreground">{activeProjects.length}</p>
          </div>
        </div>

        <div 
          onClick={() => setViewMode('completed')}
          className={`border p-6 rounded-xl shadow-sm flex items-center cursor-pointer transition-all ${viewMode === 'completed' ? 'bg-emerald-500/5 border-emerald-500 shadow-md' : 'bg-card border-border hover:border-emerald-500/50'}`}
        >
          <div className="bg-emerald-500/10 p-4 rounded-full mr-5">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Completed Projects</p>
            <p className="text-3xl font-bold text-foreground">{completedProjects.length}</p>
          </div>
        </div>
      </div>

      {showCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-6">Projects Taken (Last 6 Months)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 15]} allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Line type="monotone" dataKey="Projects Taken" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-6">Projects Completed (Last 6 Months)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 15]} allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Line type="monotone" dataKey="Projects Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-muted/20">
          <h2 className="text-lg font-semibold text-foreground">
            {viewMode === 'all' ? 'All Projects Log' : viewMode === 'active' ? 'Currently Working Projects Log' : 'Completed Projects Log'}
          </h2>
          
          {viewMode === 'completed' && (
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm bg-background border border-border text-foreground px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer shadow-sm"
            >
              <option value="All Time">All Time</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
          )}
        </div>
        
        {displayedProjects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No projects found for the selected view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium border-b border-border">Project Name</th>
                  <th className="px-6 py-4 font-medium border-b border-border">Assigned To</th>
                  <th className="px-6 py-4 font-medium border-b border-border">Client Email</th>
                  <th className="px-6 py-4 font-medium border-b border-border">Status</th>
                  {viewMode === 'completed' && (
                    <th className="px-6 py-4 font-medium border-b border-border">Completed Date</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedProjects
                  .sort((a, b) => {
                    if (viewMode === 'completed') {
                      return (b.completedAt || 0) - (a.completedAt || 0);
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .map((project) => (
                  <tr key={project.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-medium">{project.name}</td>
                    <td className="px-6 py-4">{project.assignee || 'Unassigned'}</td>
                    <td className="px-6 py-4">{project.clientEmail || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        project.status === 'In Progress' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {project.status || 'Assigned'}
                      </span>
                    </td>
                    {viewMode === 'completed' && (
                      <td className="px-6 py-4">
                        {project.completedAt 
                          ? new Date(project.completedAt).toLocaleString(undefined, { 
                              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                            }) 
                          : 'Unknown Date'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}



