"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { ArrowLeft, Clock, CalendarCheck, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function DeveloperProfilePage() {
  const params = useParams();
  const router = useRouter();
  const email = decodeURIComponent(params.email as string);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;

    const fetchData = async () => {
      try {
        // Fetch projects assigned to this developer
        const projectsQuery = query(collection(db, 'projects'), where('assignee', '==', email));
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectsData = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjects(projectsData);

        // Fetch holidays
        const holidaysSnapshot = await getDocs(collection(db, 'holidays'));
        const holidaysMap: Record<string, boolean> = {};
        holidaysSnapshot.docs.forEach(doc => {
          holidaysMap[doc.id] = true;
        });

        // Fetch attendance records for this developer
        const attendanceQuery = query(collectionGroup(db, 'attendance'), where('email', '==', email));
        const attendanceSnapshot = await getDocs(attendanceQuery);
        let attendanceData = attendanceSnapshot.docs.map(doc => doc.data());
        
        // Map existing attendance by date (YYYY-M-D) to easily check if they marked attendance
        const attendanceByDate: Record<string, any> = {};
        attendanceData.forEach(record => {
          if (record.date) {
            attendanceByDate[record.date] = record;
          }
        });

        // Generate the last 30 days
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          
          const isSunday = d.getDay() === 0;
          if (isSunday) continue; // Skip Sundays
          
          // Formats
          const unpaddedDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // Used by AttendanceProvider
          const paddedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // Used by CalendarView holidays
          
          if (holidaysMap[paddedDate]) continue; // Skip custom holidays
          
          if (!attendanceByDate[unpaddedDate]) {
            // Missing attendance on a working day! Mark as Absent.
            // But don't mark today as Absent if it's still early in the day? Let's just mark it Absent if missing.
            attendanceData.push({
              date: unpaddedDate,
              timeString: '--:--',
              task: 'N/A',
              description: 'Did not check in',
              status: 'Absent',
              timestamp: d.getTime() // Use timestamp of that day for sorting
            });
          }
        }

        // Sort attendance by date descending
        attendanceData.sort((a, b) => b.timestamp - a.timestamp);
        
        setAttendance(attendanceData);
      } catch (error) {
        console.error("Error fetching developer profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [email]);

  const [attendanceFilter, setAttendanceFilter] = useState('All');
  
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading profile data...</div>;
  }

  const displayedAttendance = attendance.filter(record => 
    attendanceFilter === 'All' || 
    (record.status && record.status.toLowerCase() === attendanceFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Developer Profile</h1>
          <p className="text-muted-foreground text-sm">{email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Projects Section */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-muted-foreground" />
            Assigned Projects ({projects.length})
          </h2>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects assigned.</p>
            ) : (
              projects.map(p => (
                <Link href={`/founder/projects/${p.id}`} key={p.id} className="block p-3 bg-secondary/30 rounded-lg border border-border hover:bg-secondary/50 hover:border-foreground/30 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                      p.status === 'Completed' ? "bg-green-100 text-green-700 border-green-200" :
                      p.status === 'In Progress' ? "bg-blue-100 text-blue-700 border-blue-200" :
                      "bg-yellow-100 text-yellow-700 border-yellow-200"
                    )}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Progress: {p.progress || 0}%</span>
                    <span>Due: {p.dueDate || 'N/A'}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Attendance Section */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-muted-foreground" />
              Recent Attendance
            </h2>
            <select 
              value={attendanceFilter} 
              onChange={e => setAttendanceFilter(e.target.value)}
              className="bg-background border border-border text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {displayedAttendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records found.</p>
            ) : (
              displayedAttendance.map((record, idx) => (
                <div key={idx} className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm">{record.date}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                      record.status === 'Present' ? "bg-green-100 text-green-700 border-green-200" :
                      "bg-red-100 text-red-700 border-red-200"
                    )}>
                      {record.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Marked at: {record.timeString || 'Unknown'}
                    </div>
                    <div><strong>Tasks:</strong> {record.task}</div>
                    <div><strong>Notes:</strong> {record.description}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
