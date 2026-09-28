"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  isFounder?: boolean;
}

export function CalendarView({ isFounder = false }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customHolidays, setCustomHolidays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fetch custom holidays in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'holidays'), (snapshot) => {
      const holidaysObj: Record<string, boolean> = {};
      snapshot.forEach((doc) => {
        holidaysObj[doc.id] = true;
      });
      setCustomHolidays(holidaysObj);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const toggleHoliday = async (dateStr: string, isSunday: boolean) => {
    if (!isFounder) return;
    if (isSunday) {
      alert("Sundays are default holidays and cannot be changed.");
      return;
    }

    try {
      const docRef = doc(db, 'holidays', dateStr);
      if (customHolidays[dateStr]) {
        // Remove holiday
        await deleteDoc(docRef);
      } else {
        // Add holiday
        await setDoc(docRef, { isHoliday: true, date: dateStr });
      }
    } catch (error) {
      console.error("Error toggling holiday", error);
    }
  };

  const renderMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const days = [];
    // Padding for first row
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const today = new Date();

    return (
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">{monthName}</h3>
        <div className="grid grid-cols-7 gap-2 text-center mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-semibold text-muted-foreground uppercase">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-10"></div>;
            }

            const currentDayDate = new Date(year, month, day);
            const isSunday = currentDayDate.getDay() === 0;
            
            // Format YYYY-MM-DD manually to avoid timezone shift issues
            const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            const isCustomHoliday = !!customHolidays[formattedDate];
            const isHoliday = isSunday || isCustomHoliday;
            
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

            return (
              <button
                key={day}
                onClick={() => toggleHoliday(formattedDate, isSunday)}
                disabled={!isFounder}
                className={cn(
                  "h-10 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all relative",
                  isHoliday 
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50" 
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-900/50",
                  isToday && "ring-2 ring-foreground ring-offset-2 ring-offset-background font-bold",
                  isFounder && !isSunday ? "cursor-pointer hover:opacity-80 hover:scale-105" : (isFounder ? "cursor-not-allowed" : "cursor-default")
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  if (loading) {
    return <div className="text-center p-12 text-muted-foreground">Loading calendar...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <button 
          onClick={handlePrevMonth}
          className="p-2 hover:bg-secondary rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <ChevronLeft className="w-5 h-5" /> Previous
        </button>
        <div className="flex gap-6 items-center text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-200 dark:bg-green-900/30 dark:border-green-900/50"></div>
            Working Day
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-200 dark:bg-red-900/30 dark:border-red-900/50"></div>
            Holiday
          </div>
          {isFounder && (
            <div className="flex items-center gap-1.5 text-muted-foreground ml-4 bg-secondary/50 px-3 py-1.5 rounded-full text-xs">
              <Info className="w-4 h-4" /> Click a working day to toggle as holiday
            </div>
          )}
        </div>
        <button 
          onClick={handleNextMonth}
          className="p-2 hover:bg-secondary rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          Next <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderMonth(currentDate)}
        {renderMonth(nextMonthDate)}
      </div>
      
      <div className="text-center mt-6">
        <p className="text-sm text-muted-foreground font-medium italic">
          * Holidays other than Sundays will be updated only 2 months before.
        </p>
      </div>
    </div>
  );
}
