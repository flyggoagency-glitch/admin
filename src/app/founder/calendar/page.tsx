"use client";

import { CalendarView } from '@/components/CalendarView';

export default function FounderCalendarPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Team Calendar</h1>
        <p className="text-muted-foreground">Manage working days and declare custom holidays for the team.</p>
      </div>
      
      <CalendarView isFounder={true} />
    </div>
  );
}
