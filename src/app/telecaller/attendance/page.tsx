"use client";

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttendance } from '@/components/AttendanceProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function AttendancePage() {
  const today = new Date();
  
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // Calculate days in the current month
  const numDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInMonth = Array.from({ length: numDaysInMonth }, (_, i) => i + 1);
  
  // Calculate what day of the week the 1st falls on (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const emptyPrefixSlots = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const { user } = useAttendance();
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!user) return;
    const fetchAttendance = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'attendance')
        );
        const snapshot = await getDocs(q);
        const records: Record<number, string> = {};
        
        snapshot.forEach((doc) => {
          const docId = doc.id; // Format: YYYY-MM-DD
          const [y, m, d] = docId.split('-');
          // Check if it's the current month and year
          if (parseInt(y) === year && parseInt(m) === month + 1) {
            const dayNum = parseInt(d);
            const data = doc.data();
            records[dayNum] = data.status || 'present'; // Assuming status field exists or default to present
          }
        });
        setAttendanceRecords(records);
      } catch (error) {
        console.error("Error fetching monthly attendance", error);
      }
    };
    fetchAttendance();
  }, [user, month, year]);

  const getDayStatus = (day: number) => {
    const currentDay = today.getDate();
    const dayOfWeek = (day - 1 + firstDayOfMonth) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (day > currentDay) return 'future';

    // If there is an actual record in Firebase for this day
    if (attendanceRecords[day]) {
      return attendanceRecords[day].toLowerCase();
    }

    if (isWeekend) return 'weekend';
    if (day < currentDay) return 'absent'; // Past days without record are absent
    return 'unmarked'; // Today hasn't marked yet
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');

  // Minimum date is 3 days from today
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 3);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Leave requested for ${selectedDate}\nReason: ${reason}`);
    setIsModalOpen(false);
    setSelectedDate('');
    setReason('');
  };

  return (
    <div className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance & Leaves</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
        >
          Request Leave
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" /> {currentMonth}
            </h2>
            <div className="flex gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Present</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Late</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Leave</div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-muted-foreground uppercase">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center">
            {emptyPrefixSlots.map(i => (
              <div key={`empty-${i}`} className="aspect-square"></div>
            ))}
            
            {daysInMonth.map(day => {
              const status = getDayStatus(day);
              const isToday = day === today.getDate();
              return (
                <div 
                  key={day} 
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium border relative transition-all duration-200",
                    status === 'present' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50' :
                    status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900/50' :
                    status === 'absent' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50' :
                    status === 'leave' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50' :
                    status === 'weekend' ? 'bg-secondary text-muted-foreground border-transparent' :
                    'bg-background text-muted-foreground border-border hover:bg-secondary',
                    isToday && "ring-2 ring-foreground ring-offset-2 ring-offset-background font-bold shadow-md z-10"
                  )}
                >
                  {day}
                  {isToday && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-foreground" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold text-foreground mb-4">Request Leave</h3>
            
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Select Date</label>
                <input 
                  type="date" 
                  required
                  min={minDateStr}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  * Minimum 3 days prior notice required.<br/>
                  * You can only select 1 day here. To request consecutive days, please mail the office.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reason</label>
                <textarea 
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please state your reason for leave..."
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none min-h-[100px] resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-foreground text-background px-6 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
                >
                  Request Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
