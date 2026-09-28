"use client";

import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { motion } from 'framer-motion';

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes?: string;
  completedAt?: any;
  createdAt: any;
}

export default function TelecallerHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterType, setDateFilterType] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [convertedLeads, setConvertedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setUserEmail(user.email);
        
        try {
          const q = query(
            collection(db, 'leads'),
            where('createdBy', '==', user.email),
            where('status', '==', 'Converted')
          );
          
          const unsubscribeLeads = onSnapshot(q, (snapshot) => {
            const fetched: Lead[] = [];
            snapshot.forEach((doc) => {
              fetched.push({ id: doc.id, ...doc.data() } as Lead);
            });
            fetched.sort((a, b) => (b.completedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
            setConvertedLeads(fetched);
            setLoading(false);
          }, (err: any) => {
            if (err?.code !== 'permission-denied') {
              console.error("Error fetching history:", err);
            }
            setLoading(false);
          });
          
          return () => unsubscribeLeads();
        } catch (err) {
          console.error("Error setting up snapshot:", err);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const formatToDDMMYYYY = (dateObj: Date, includeTime = false) => {
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    if (!includeTime) return `${dd}/${mm}/${yyyy}`;
    const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dd}/${mm}/${yyyy}, ${time}`;
  };

  const filteredLeads = convertedLeads.filter(lead => {
    // Check search query
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check date filter
    let matchesDate = true;
    if (dateFilterType !== 'all') {
      const leadDate = lead.completedAt?.toDate ? lead.completedAt.toDate() : (lead.createdAt?.toDate ? lead.createdAt.toDate() : null);
      if (leadDate) {
        const now = new Date();
        if (dateFilterType === 'today') {
          matchesDate = leadDate.getDate() === now.getDate() && 
                        leadDate.getMonth() === now.getMonth() && 
                        leadDate.getFullYear() === now.getFullYear();
        } else if (dateFilterType === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          matchesDate = leadDate.getDate() === yesterday.getDate() && 
                        leadDate.getMonth() === yesterday.getMonth() && 
                        leadDate.getFullYear() === yesterday.getFullYear();
        } else if (dateFilterType === 'this_month') {
          matchesDate = leadDate.getMonth() === now.getMonth() && 
                        leadDate.getFullYear() === now.getFullYear();
        } else if (dateFilterType === 'custom' && dateFilter) {
          const [year, month, day] = dateFilter.split('-');
          matchesDate = (
            leadDate.getFullYear() === parseInt(year) &&
            (leadDate.getMonth() + 1) === parseInt(month) &&
            leadDate.getDate() === parseInt(day)
          );
        } else if (dateFilterType === 'custom' && !dateFilter) {
          // If custom is selected but no date is picked, show all
          matchesDate = true;
        }
      } else {
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Conversion History</h1>
            <span className="bg-emerald-500 text-white shadow-sm text-xs font-bold px-3 py-1 rounded-full">
              Total Converted: {filteredLeads.length}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            View all your successfully converted leads.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3">
          <select
            value={dateFilterType}
            onChange={(e) => setDateFilterType(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>
          
          {dateFilterType === 'custom' && (
            <motion.input
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full md:w-auto px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          )}
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading history...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-foreground font-medium mb-1">No history found</p>
            <p className="text-sm">You haven't converted any leads yet or none match your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-sm">
                  <th className="px-6 py-4 font-medium text-muted-foreground w-16">S.No</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Converted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-muted-foreground">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{lead.name}</td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {lead.completedAt?.toDate ? formatToDDMMYYYY(lead.completedAt.toDate()) : (lead.createdAt?.toDate ? formatToDDMMYYYY(lead.createdAt.toDate()) : 'Unknown')}
                    </td>
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
