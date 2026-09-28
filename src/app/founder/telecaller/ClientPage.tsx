"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Check, X, Loader2, PhoneCall, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes?: string;
  followUpDate?: string;
  createdBy: string;
  createdAt: any;
}

export default function FounderTelecallerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedTelecaller, setSelectedTelecaller] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');

  useEffect(() => {
    setLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      
      const q = query(collection(db, 'leads'));
      
      const unsubscribeLeads = onSnapshot(q, (snapshot) => {
        const fetched: Lead[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as Lead);
        });
        fetched.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLeads(fetched);
        setLoading(false);
        setIsRefreshing(false);
      }, (error) => {
        console.error("Error fetching leads:", error);
        setLoading(false);
        setIsRefreshing(false);
      });
      
      return () => unsubscribeLeads();
    });

    return () => unsubscribeAuth();
  }, [refreshTrigger]);

    const handleDeleteLead = async (leadId: string) => {
    if (confirm("Are you sure you want to delete this lead? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'leads', leadId));
      } catch (error) {
        console.error("Error deleting lead:", error);
        alert("Failed to delete lead.");
      }
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleApprove = async (leadId: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'Converted',
        completedAt: serverTimestamp() // Set timestamp when actually converted
      });

      if (auth.currentUser && auth.currentUser.uid) {
        const lead = leads.find(l => l.id === leadId);
        if (lead && lead.createdBy) {
          const roomId = `${auth.currentUser.uid}_${lead.createdBy}`;
          await addDoc(collection(db, 'team_messages'), {
            text: `✅ Great news! I have approved your conversion for lead: **${lead.name}** (${lead.phone}). Keep up the great work! 🎉`,
            uid: auth.currentUser.uid,
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: auth.currentUser.displayName || 'Founder',
            senderRole: 'Founder',
            senderPicUrl: auth.currentUser.photoURL || '', read: false
          });
        }
      }
    } catch (err) {
      console.error("Error approving conversion:", err);
    }
  };

  const handleReject = async (leadId: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'Follow-up' // Revert it to follow-up or interested
      });

      if (auth.currentUser && auth.currentUser.uid) {
        const lead = leads.find(l => l.id === leadId);
        if (lead && lead.createdBy) {
          const roomId = `${auth.currentUser.uid}_${lead.createdBy}`;
          await addDoc(collection(db, 'team_messages'), {
            text: `❌ I have rejected the conversion for lead: **${lead.name}** (${lead.phone}). Please follow up further.`,
            uid: auth.currentUser.uid,
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: auth.currentUser.displayName || 'Founder',
            senderRole: 'Founder',
            senderPicUrl: auth.currentUser.photoURL || '', read: false
          });
        }
      }
    } catch (err) {
      console.error("Error rejecting conversion:", err);
    }
  };

  // Compute unique telecallers for the filter dropdown
  const telecallers = Array.from(new Set(leads.map(l => l.createdBy).filter(Boolean)));

  const filteredLeads = selectedTelecaller === 'all' 
    ? leads 
    : leads.filter(l => l.createdBy === selectedTelecaller);

  const pendingLeads = filteredLeads.filter(l => l.status === 'Pending Conversion');
  let otherLeads = filteredLeads.filter(l => l.status !== 'Pending Conversion');

  // Apply status filter for the main tracker
  if (selectedStatus === 'active') {
    otherLeads = otherLeads.filter(l => l.status !== 'Converted');
  } else if (selectedStatus !== 'all') {
    otherLeads = otherLeads.filter(l => l.status === selectedStatus);
  }

  const formatToDDMMYYYY = (dateObj: Date) => {
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Telecaller Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor telecaller leads and manage conversion approvals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTelecaller}
            onChange={(e) => setSelectedTelecaller(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
          >
            <option value="all">All Telecallers</option>
            {telecallers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Pending Approvals Section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs">
                {pendingLeads.length}
              </span>
              Pending Conversions
            </h2>
            
            {pendingLeads.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm">
                <p className="text-muted-foreground text-sm">No pending conversion requests from telecallers.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border text-sm">
                      <th className="px-6 py-4 font-medium text-muted-foreground">Lead</th>
                      <th className="px-6 py-4 font-medium text-muted-foreground">Telecaller</th>
                      <th className="px-6 py-4 font-medium text-muted-foreground">Notes</th>
                      <th className="px-6 py-4 font-medium text-muted-foreground text-right">Approval Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{lead.name}</div>
                          <div className="text-muted-foreground text-sm">{lead.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-foreground text-sm">{lead.createdBy}</td>
                        <td className="px-6 py-4 text-muted-foreground text-sm max-w-[200px] truncate" title={lead.notes}>
                          {lead.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(lead.id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(lead.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All Other Leads */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">All Leads Tracker</h2>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
              >
                <option value="active">Active (Hide Converted)</option>
                <option value="all">Show All Leads</option>
                <option value="Converted">Converted Only</option>
                <option value="Interested">Interested Only</option>
                <option value="Follow-up">Follow-up Only</option>
              </select>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border text-sm">
                    <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Phone Number</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                                          <th className="px-6 py-4 font-medium text-muted-foreground">Added On</th>
                      <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {otherLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{lead.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{lead.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                          ${lead.status === 'Converted' ? 'bg-emerald-500 text-white dark:bg-emerald-600' : ''}
                          ${lead.status === 'Interested' ? 'bg-blue-500 text-white dark:bg-blue-600' : ''}
                          ${lead.status === 'Follow-up' ? 'bg-orange-500 text-white dark:bg-orange-600' : ''}
                        `}>
                          {lead.status}
                        </span>
                      </td>
                                              <td className="px-6 py-4 text-muted-foreground text-sm">
                          {lead.createdAt?.toDate ? formatToDDMMYYYY(lead.createdAt.toDate()) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors inline-flex"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                  ))}
                  {otherLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        No other leads tracked yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}



