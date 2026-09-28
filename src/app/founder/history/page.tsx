"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Briefcase, User } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Project {
  id: string;
  name: string;
  assignee: string;
  status: string;
  dueDate: string;
  completedAt?: number;
  clientEmail?: string;
  clientPassword?: string;
  clientContact?: string;
  projectDetails?: string;
  liveUrl?: string;
  githubLink?: string;
  domainOption?: string;
}

export default function FounderHistoryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const downloadPDF = (project: Project) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>${project.name} - Project Handover</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .section { margin-bottom: 30px; }
            .section h2 { font-size: 1.2rem; color: #444; margin-bottom: 15px; }
            .field { margin-bottom: 10px; }
            .label { font-weight: bold; display: inline-block; width: 150px; color: #666; }
            .value { display: inline-block; }
            .footer { margin-top: 50px; font-size: 0.9rem; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Project Handover: ${project.name}</h1>
          
          <div class="section">
            <h2>Client Credentials</h2>
            <div class="field"><span class="label">Email ID:</span> <span class="value">${project.clientEmail || 'N/A'}</span></div>
            <div class="field"><span class="label">Password:</span> <span class="value">${project.clientPassword || 'N/A'}</span></div>
            <div class="field"><span class="label">Contact:</span> <span class="value">${project.clientContact || 'N/A'}</span></div>
          </div>
          
          <div class="section">
            <h2>Deployment & Source</h2>
            <div class="field"><span class="label">Domain Option:</span> <span class="value">${project.domainOption || 'N/A'}</span></div>
            <div class="field"><span class="label">Live URL:</span> <span class="value">${project.liveUrl ? `<a href="${project.liveUrl}">${project.liveUrl}</a>` : 'N/A'}</span></div>
            <div class="field"><span class="label">GitHub Repository:</span> <span class="value">${project.githubLink ? `<a href="${project.githubLink}">${project.githubLink}</a>` : 'N/A'}</span></div>
          </div>
          
          <div class="section">
            <h2>Project Details</h2>
            <p>${project.projectDetails ? project.projectDetails.replace(/\n/g, '<br/>') : 'No details provided.'}</p>
          </div>
          
          <div class="section">
            <h2>Technical Support</h2>
            <p style="margin-bottom: 10px;">For technical support, contact Team Flyggo:</p>
            <div class="field"><span class="label">Email:</span> <span class="value"><a href="mailto:sales@flyggo.com">sales@flyggo.com</a></span></div>
            <div class="field"><span class="label">Phone:</span> <span class="value">9363190227</span></div>
            <div class="field"><span class="label">Website:</span> <span class="value"><a href="https://www.flyggo.com">www.flyggo.com</a></span></div>
          </div>
          
          <div class="footer">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        try {
          const q = query(
            collection(db, 'projects'), 
            where('status', '==', 'Completed')
          );
          
          const unsubscribeProjects = onSnapshot(q, (querySnapshot) => {
            const fetched: Project[] = [];
            querySnapshot.forEach((doc) => {
              fetched.push({ ...doc.data(), id: doc.id } as Project);
            });
            setProjects(fetched);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching history:", error);
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

    return () => unsubscribeAuth();
  }, []);

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.clientContact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.assignee?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto pb-12 relative">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Completed Projects History
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Review all projects that have been fully delivered by your team.</p>
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search projects, clients, or devs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            Loading history...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            No completed projects found in company history.
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            No matching projects found for your search.
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isExpanded = expandedProjectId === project.id;
            return (
              <div 
                key={project.id} 
                className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:border-foreground/30 transition-all group opacity-80 hover:opacity-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                    <h2 className="text-3xl font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                      {project.name}
                    </h2>
                    
                    <div className="flex items-center gap-6 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                        <Briefcase className="w-4 h-4" />
                        Status: 
                        <span className={cn(
                          "ml-1 text-[11px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full border shadow-sm",
                          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        )}>
                          {project.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                        <User className="w-4 h-4" />
                        Developer: <span className="text-foreground">{project.assignee || 'Unassigned'}</span>
                      </div>
                      
                      {project.completedAt && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                          <span className="text-muted-foreground/50 mr-1">•</span>
                          Completed on {new Date(project.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between ml-4 space-y-3">
                    <button 
                      onClick={() => downloadPDF(project)}
                      className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                    >
                      Download PDF
                    </button>
                    <button 
                      onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                      className="text-sm font-semibold text-muted-foreground hover:text-blue-600 transition-colors"
                    >
                      {isExpanded ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Client Credentials</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-semibold text-foreground">Email:</span> {project.clientEmail || 'N/A'}</p>
                        <p><span className="font-semibold text-foreground">Password:</span> {project.clientPassword || 'N/A'}</p>
                        <p><span className="font-semibold text-foreground">Contact:</span> {project.clientContact || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Deployment</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-semibold text-foreground">Domain:</span> {project.domainOption || 'N/A'}</p>
                        <p><span className="font-semibold text-foreground">Live URL:</span> {project.liveUrl ? <a href={project.liveUrl.startsWith('http') ? project.liveUrl : `https://${project.liveUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{project.liveUrl}</a> : 'N/A'}</p>
                        <p><span className="font-semibold text-foreground">GitHub:</span> {project.githubLink ? <a href={project.githubLink.startsWith('http') ? project.githubLink : `https://${project.githubLink}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{project.githubLink}</a> : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Project Brief</h3>
                      <p className="text-sm text-foreground bg-secondary/50 p-4 rounded-lg whitespace-pre-wrap">{project.projectDetails || 'No details provided.'}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
