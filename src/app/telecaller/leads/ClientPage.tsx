"use client";

import { useState, useEffect } from 'react';
import { PhoneCall, Plus, Search, X, Loader2, Check, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: string;
  notes?: string;
  followUpDate?: string;
  createdAt: any;
}

export default function TelecallerLeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Confirmation Modal state
  const [confirmAction, setConfirmAction] = useState<{ type: 'convert' | 'delete', leadId: string } | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // Add Lead Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'Interested',
    notes: '',
    followUpDate: ''
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setUserEmail(user.email);
        
        try {
          const q = query(
            collection(db, 'leads'),
            where('createdBy', '==', user.email)
          );
          
          const unsubscribeLeads = onSnapshot(q, (snapshot) => {
            const fetched: Lead[] = [];
            snapshot.forEach((doc) => {
              fetched.push({ id: doc.id, ...doc.data() } as Lead);
            });
            // Sort by newest first on client side to avoid needing compound indexes initially
            fetched.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setLeads(fetched);
            setLoading(false);
          }, (err: any) => {
            if (err?.code !== 'permission-denied') {
              console.error("Error fetching leads:", err);
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

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!formData.name || !formData.phone) {
      setError('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    if (formData.status === 'Follow-up' && !formData.followUpDate) {
      setError('Please select a follow-up date and time.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        status: formData.status,
        notes: formData.notes,
        createdBy: userEmail,
        createdAt: serverTimestamp()
      };
      
      if (formData.status === 'Follow-up' && formData.followUpDate) {
        payload.followUpDate = formData.followUpDate;
      }

      await addDoc(collection(db, 'leads'), payload);
      
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', status: 'Interested', notes: '', followUpDate: '' });
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setError('Permission Denied: Your database rules do not allow creating leads yet. Please contact the administrator.');
      } else {
        setError(err.message || 'Failed to add lead');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setIsConfirmingAction(true);
    
    try {
      if (confirmAction.type === 'convert') {
        await updateDoc(doc(db, 'leads', confirmAction.leadId), {
          status: 'Pending Conversion'
        });

        // Send a message to the founder's inbox automatically
        if (auth.currentUser && auth.currentUser.email) {
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            if (!usersSnap.empty) {
              const founderDoc = usersSnap.docs[0];
              const founderUid = founderDoc.id;
              const roomId = `${founderUid}_${auth.currentUser.email}`;
              
              const leadDetails = leads.find(l => l.id === confirmAction.leadId);
              
              await addDoc(collection(db, 'team_messages'), {
                text: `I have requested conversion approval for lead: **${leadDetails?.name || 'Unknown'}** (${leadDetails?.phone || 'No phone'}). Please review.`,
                uid: auth.currentUser.uid,
                roomId: roomId,
                createdAt: serverTimestamp(),
                senderName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                senderRole: 'Telecaller',
                senderPicUrl: auth.currentUser.photoURL || '',
                read: false
              });
            }
          } catch (msgErr) {
            console.error("Failed to send automatic notification message to founder:", msgErr);
          }
        }
      } else if (confirmAction.type === 'delete') {
        await deleteDoc(doc(db, 'leads', confirmAction.leadId));
      }
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        alert(`Permission Denied: Your database rules do not allow ${confirmAction.type === 'delete' ? 'deleting' : 'updating'} leads yet.`);
      } else {
        console.error("Error executing action:", err);
      }
    } finally {
      setIsConfirmingAction(false);
      setConfirmAction(null);
    }
  };

  const formatToDDMMYYYY = (dateObj: Date, includeTime = false) => {
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    if (!includeTime) return `${dd}/${mm}/${yyyy}`;
    const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dd}/${mm}/${yyyy}, ${time}`;
  };

  const filteredLeads = leads.filter(lead => 
    lead.status !== 'Converted' && (
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.status.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Leads & Calls
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your daily call list and track lead status.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
            <PhoneCall className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No Leads Found</h3>
          <p className="text-muted-foreground max-w-md">
            You don't have any active leads logged right now. Click "Add Lead" to start logging your calls.
          </p>
        </div>
      ) : filteredLeads.length === 0 ? (
         <div className="bg-card border border-border rounded-2xl shadow-sm min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <h3 className="text-xl font-bold text-foreground mb-2">No Matches Found</h3>
          <p className="text-muted-foreground max-w-md">
            No leads match your search query "{searchQuery}".
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 border-b border-border text-sm">
                <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Phone Number</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Notes</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Added On</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{lead.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{lead.phone}</td>
                  <td className="px-6 py-4 text-muted-foreground text-sm max-w-[300px] whitespace-pre-wrap break-words">
                    {lead.notes || <span className="opacity-50">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                        ${lead.status === 'Converted' ? 'bg-emerald-500 text-white dark:bg-emerald-600' : ''}
                        ${lead.status === 'Pending Conversion' ? 'bg-purple-500 text-white dark:bg-purple-600' : ''}
                        ${lead.status === 'Interested' ? 'bg-blue-500 text-white dark:bg-blue-600' : ''}
                        ${lead.status === 'Follow-up' ? 'bg-orange-500 text-white dark:bg-orange-600' : ''}
                      `}>
                        {lead.status}
                      </span>
                      {lead.status === 'Follow-up' && lead.followUpDate && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                          {formatToDDMMYYYY(new Date(lead.followUpDate), true)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-sm">
                    {lead.createdAt?.toDate ? formatToDDMMYYYY(lead.createdAt.toDate()) : 'Just now'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {lead.status !== 'Converted' && lead.status !== 'Pending Conversion' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'convert', leadId: lead.id })}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                          title="Request Conversion Approval"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmAction({ type: 'delete', leadId: lead.id })}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => !isConfirmingAction && setConfirmAction(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-card border border-border shadow-xl rounded-2xl w-full max-w-sm relative z-10 overflow-hidden text-center p-6"
            >
              <div className="flex justify-center mb-4">
                {confirmAction.type === 'delete' ? (
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <Trash2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                )}
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">
                {confirmAction.type === 'delete' ? 'Delete Lead' : 'Request Conversion'}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                {confirmAction.type === 'delete' 
                  ? 'Are you sure you want to permanently delete this lead? This action cannot be undone.' 
                  : 'Submit this lead to the team for conversion approval?'}
              </p>
              
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isConfirmingAction}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmAction}
                  disabled={isConfirmingAction}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-70 flex items-center gap-2 ${
                    confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isConfirmingAction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : confirmAction.type === 'delete' ? (
                    'Delete'
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Lead Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => !isSubmitting && setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-card border border-border shadow-xl rounded-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Add New Lead</h2>
                <button 
                  onClick={() => !isSubmitting && setIsModalOpen(false)}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleAddLead} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
                    {error}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Lead Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. John Doe"
                    className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Phone Number <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
                  >
                    <option value="Interested">Interested</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <AnimatePresence>
                  {formData.status === 'Follow-up' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }} 
                      exit={{ opacity: 0, height: 0, marginTop: 0 }} 
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label className="text-sm font-medium text-foreground">Follow-up Date & Time <span className="text-red-500">*</span></label>
                      <input
                        type="datetime-local"
                        required={formData.status === 'Follow-up'}
                        value={formData.followUpDate}
                        onChange={(e) => setFormData({...formData, followUpDate: e.target.value})}
                        className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Add any extra details or reminders here..."
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-foreground text-background px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition shadow-sm disabled:opacity-70 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Lead'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
