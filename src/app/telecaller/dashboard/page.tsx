"use client";

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  Briefcase,
  PhoneCall
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

import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes?: string;
  followUpDate?: string;
  completedAt?: any;
  createdAt: any;
}

export default function TelecallerDashboard() {
  const [userName, setUserName] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    // Find leads converted on this specific day
    const completedThatDay = leads.filter(l => {
      if (l.status !== 'Converted' || !l.completedAt) return false;
      const completedDate = l.completedAt?.toDate ? l.completedAt.toDate() : new Date(l.completedAt);
      return completedDate.getDate() === d.getDate() && 
             completedDate.getMonth() === d.getMonth() && 
             completedDate.getFullYear() === d.getFullYear();
    }).length;

    chartData.push({
      name: daysOfWeek[d.getDay()],
      conversions: completedThatDay
    });
  }

  // Fetch Leads
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user?.email) return;
      setUserName(user.displayName || 'Telecaller');
      
      try {
        const q = query(
          collection(db, 'leads'),
          where('createdBy', '==', user.email)
        );
        
        const unsubscribeLeads = onSnapshot(q, (querySnapshot) => {
          const fetched: Lead[] = [];
          querySnapshot.forEach((doc) => {
            fetched.push({ id: doc.id, ...doc.data() } as Lead);
          });
          setLeads(fetched);
          setLoading(false);
        }, (error: any) => {
          if (error?.code !== 'permission-denied') {
            console.error("Error fetching leads:", error);
          }
          setLoading(false);
        });
        
        return () => unsubscribeLeads();
      } catch (error) {
        console.error("Error setting up leads listener", error);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const totalInterested = leads.filter(l => l.status !== 'Converted').length;
  
  const convertedThisMonth = leads.filter(l => {
    if (l.status !== 'Converted') return false;
    const dateToCheck = l.completedAt?.toDate ? l.completedAt.toDate() : (l.createdAt?.toDate ? l.createdAt.toDate() : new Date());
    const now = new Date();
    return dateToCheck.getMonth() === now.getMonth() && dateToCheck.getFullYear() === now.getFullYear();
  }).length;

  const followUps = leads
    .filter(l => l.status === 'Follow-up' && l.followUpDate)
    .sort((a, b) => {
      return new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime();
    });

  const formatToDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dd}/${mm}/${yyyy}, ${time}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Good Morning, {userName} 👋
          </h1>
          <p className="text-muted-foreground text-sm">{currentDate}</p>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-medium text-foreground">Follow-ups Overview</h3>
            <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Interested</div>
              <div className="text-5xl font-bold text-foreground tracking-tighter">
                {loading ? '-' : totalInterested}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Converted This Month</div>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? '-' : convertedThisMonth}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-foreground">Next Follow-ups</h3>
            <Link href="/telecaller/leads" className="text-xs text-primary hover:underline">
              View All
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading follow-ups...</p>
              ) : followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">You don't have any active follow-ups yet.</p>
              ) : (
                followUps.slice(0, 3).map((lead) => (
                  <div key={lead.id} className="pb-2 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-foreground">{lead.name}</span>
                      <span className="text-muted-foreground">{formatToDDMMYYYY(lead.followUpDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chart Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-card border border-border p-5 rounded-2xl shadow-sm"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-medium text-foreground">Total Conversions</h3>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </div>
        
        <div className="h-[250px] w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Loading chart...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 5]} 
                  allowDecimals={false}
                  tickCount={6}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="conversions" 
                  stroke="var(--foreground)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--background)', stroke: 'var(--foreground)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: 'var(--foreground)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

    </div>
  );
}
