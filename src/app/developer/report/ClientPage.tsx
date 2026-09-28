"use client";

import { useState } from 'react';
import { Send, Save, Bold, Italic, List, Link as LinkIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DailyReportPage() {
  const [autosaveStatus, setAutosaveStatus] = useState('Last saved just now');

  const handleSimulateTyping = () => {
    setAutosaveStatus('Saving...');
    setTimeout(() => setAutosaveStatus('Last saved just now'), 1000);
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Daily Report</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {autosaveStatus}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-medium transition-opacity flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Tasks Completed
          </label>
          <textarea 
            onChange={handleSimulateTyping}
            className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="- Finished API integration
- Updated UI components"
          />
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" /> Blockers & Challenges
          </label>
          <textarea 
            onChange={handleSimulateTyping}
            className="w-full h-32 bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Waiting on API endpoints from backend team."
          />
        </div>
      </div>

      <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-semibold text-foreground">Detailed Notes</label>
          <div className="flex bg-secondary rounded-md p-1 border border-border">
            <button className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-colors"><Bold className="w-3.5 h-3.5"/></button>
            <button className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-colors"><Italic className="w-3.5 h-3.5"/></button>
            <button className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-colors"><List className="w-3.5 h-3.5"/></button>
            <button className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-colors"><LinkIcon className="w-3.5 h-3.5"/></button>
          </div>
        </div>
        <textarea 
          onChange={handleSimulateTyping}
          className="w-full h-48 bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Write your detailed notes here..."
        />
      </div>
    </div>
  );
}
