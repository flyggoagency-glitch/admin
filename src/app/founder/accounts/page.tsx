"use client";

import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Plus, Filter, ArrowDownRight, ArrowUpRight, Loader2, ArrowUpDown, IndianRupee, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Transaction {
  id: string;
  createdAt: number;
  name: string;
  credit: number;
  debit: number;
  rawType: string;
  balance?: number;
}

export default function AccountsGeneralPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('all'); // all, credit, debit
  const [sortOrder, setSortOrder] = useState('desc'); // desc, asc
  const [selectedMonth, setSelectedMonth] = useState('current'); // all, current, previous, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryName, setEntryName] = useState('');
  const [customName, setCustomName] = useState('');
  const [entryType, setEntryType] = useState('credit');
  const [entryAmount, setEntryAmount] = useState('');
  const [pendingProjects, setPendingProjects] = useState<{id: string, name: string, pending: number, total: number, advance: number}[]>([]);

  const fetchPendingProjects = async () => {
    try {
      const q = query(collection(db, 'projects'));
      const querySnapshot = await getDocs(q);
      const fetched: {id: string, name: string, pending: number, total: number, advance: number}[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const advance = Number(data.advanceAmount) || 0;
        const total = Number(data.totalAmount) || 0;
        if (data.status !== 'Completed' && total > advance) {
           fetched.push({ id: docSnap.id, name: data.name, pending: total - advance, total, advance });
        }
      });
      setPendingProjects(fetched);
    } catch (error) {
      console.error("Error fetching projects", error);
    }
  };

    const handleClearAll = async () => {
    if (!auth.currentUser) return;
    if (confirm("Are you sure you want to delete ALL ledger transactions? This action cannot be undone.")) {
      try {
        const q = query(collection(db, 'users', auth.currentUser.uid, 'accounts_ledger'));
        const snap = await getDocs(q);
        const promises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
        setTransactions([]);
        alert("All transactions have been cleared successfully.");
      } catch (err) {
        console.error(err);
        alert("Error clearing transactions.");
      }
    }
  };

  const fetchLedger = async (user: any) => {
    try {
      const q = query(collection(db, 'users', user.uid, 'accounts_ledger'), orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetched: Transaction[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if ((data.type === 'credit' || data.type === 'debit') && data.name !== 'Bank Reconciliation Adjustment') {
          fetched.push({
            id: docSnap.id,
            createdAt: data.createdAt,
            name: data.name,
            credit: data.type === 'credit' ? Number(data.amount) : 0,
            debit: data.type === 'debit' ? Number(data.amount) : 0,
            rawType: data.type
          });
        } else if (data.type === 'Project Assigned' && data.advanceAmount > 0) {
          fetched.push({
            id: docSnap.id,
            createdAt: data.createdAt,
            name: `${data.projectName} Adv`,
            credit: Number(data.advanceAmount),
            debit: 0,
            rawType: 'credit'
          });
        }
      });
      setTransactions(fetched);
    } catch (error) {
      console.error("Error fetching accounts ledger", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchLedger(user);
        fetchPendingProjects();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isSubmitting) return;
    setIsSubmitting(true);
    
    let finalName = '';
    let isProjectPayment = false;
    let projId = '';
    let projData = null;

    if (entryType === 'credit') {
       if (entryName === 'Other') {
          finalName = customName;
       } else {
          // entryName here holds the actual project ID chosen from the dropdown
          projData = pendingProjects.find(p => p.id === entryName);
          if (projData) {
             finalName = `${projData.name} Payment`;
             isProjectPayment = true;
             projId = projData.id;
          } else {
             finalName = entryName; // fallback
          }
       }
    } else {
       finalName = entryName === 'Other' ? customName : entryName;
    }
    
    if (!finalName) {
      setIsSubmitting(false);
      return;
    }
    
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'accounts_ledger'), {
        name: finalName,
        type: entryType,
        amount: Number(entryAmount),
        createdAt: Date.now()
      });

      // Automatically complete project if fully paid
      if (isProjectPayment && projData) {
         const newAdvance = Number(projData.advance) + Number(entryAmount);
         const updates: any = { advanceAmount: newAdvance };
         if (newAdvance >= Number(projData.total)) {
            updates.status = 'Completed';
            updates.completedAt = Date.now();
         }
         await updateDoc(doc(db, 'projects', projId), updates);
      }
      
      setShowModal(false);
      setEntryName('');
      setCustomName('');
      setEntryAmount('');
      setEntryType('credit');
      
      fetchLedger(auth.currentUser);
      fetchPendingProjects();
    } catch (error) {
      console.error("Error adding entry", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!auth.currentUser) return;
    if (confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'accounts_ledger', id));
        fetchLedger(auth.currentUser);
      } catch (error) {
        console.error("Error deleting entry", error);
      }
    }
  };

  // Compute displayed transactions with Running Balance
  const displayedTransactions = useMemo(() => {
    let runningBalance = 0;
    
    // Calculate global running balance chronologically
    let processed = transactions.map(t => {
      runningBalance += t.credit;
      runningBalance -= t.debit;
      return { ...t, balance: runningBalance };
    });

    // Apply Time Filter
    if (selectedMonth !== 'all') {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      
      if (selectedMonth === 'current') {
        processed = processed.filter(t => t.createdAt >= currentMonthStart);
      } else if (selectedMonth === 'previous') {
        processed = processed.filter(t => t.createdAt >= prevMonthStart && t.createdAt < currentMonthStart);
      } else if (selectedMonth === 'custom') {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity; // Include the full end day
        processed = processed.filter(t => t.createdAt >= start && t.createdAt < end);
      }
    }

    // Apply Type Filter
    if (filterType !== 'all') {
      processed = processed.filter(t => t.rawType === filterType);
    }

    // Apply Sorting
    if (sortOrder === 'desc') {
      processed.reverse();
    }

    return processed;
  }, [transactions, filterType, sortOrder, selectedMonth, customStartDate, customEndDate]);

  const monthCredit = displayedTransactions.reduce((acc, t) => acc + t.credit, 0);
  const monthDebit = displayedTransactions.reduce((acc, t) => acc + t.debit, 0);
  const netBalance = monthCredit - monthDebit;
  const outstandingBalance = pendingProjects.reduce((acc, p) => acc + p.pending, 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Flyggo Accounts', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    let rangeText = 'Date Range: All Time';
    if (selectedMonth === 'current') rangeText = 'Date Range: Current Month';
    else if (selectedMonth === 'previous') rangeText = 'Date Range: Previous Month';
    else if (selectedMonth === 'custom') {
        rangeText = `Date Range: ${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
    }
    doc.text(rangeText, 14, 36);

    doc.text(`Total Credit: Rs ${monthCredit.toLocaleString('en-IN')}`, 14, 44);
    doc.text(`Total Debit: Rs ${monthDebit.toLocaleString('en-IN')}`, 80, 44);
    doc.text(`Net Balance: Rs ${netBalance.toLocaleString('en-IN')}`, 150, 44);

    const tableColumn = ["Date", "Name", "Credit", "Debit", "Running Balance"];
    const tableRows: any[] = [];

    displayedTransactions.forEach(entry => {
        tableRows.push([
            new Date(entry.createdAt).toLocaleDateString(),
            entry.name,
            entry.credit > 0 ? `+ Rs ${entry.credit.toLocaleString('en-IN')}` : '-',
            entry.debit > 0 ? `- Rs ${entry.debit.toLocaleString('en-IN')}` : '-',
            `Rs ${entry.balance?.toLocaleString('en-IN')}`
        ]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save('flyggo-accounts.pdf');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Accounts
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your credits, debits, and monthly balances.
          </p>
        </div>
                  <div className="flex gap-2 items-center">
            <button 
              onClick={handleClearAll}
              className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </button>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
          <Plus className="w-4 h-4" /> Add Entry</button></div></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-medium text-emerald-800 mb-1">Total Credit</p>
          <h3 className="text-2xl font-bold text-emerald-900 flex items-center gap-1">
            <IndianRupee className="w-5 h-5 opacity-70" />
            {monthCredit.toLocaleString('en-IN')}
          </h3>
        </div>
        <div className="bg-red-50/50 border border-red-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-medium text-red-800 mb-1">Total Debit</p>
          <h3 className="text-2xl font-bold text-red-900 flex items-center gap-1">
            <IndianRupee className="w-5 h-5 opacity-70" />
            {monthDebit.toLocaleString('en-IN')}
          </h3>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-medium text-blue-800 mb-1">Net Balance</p>
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-1">
            <IndianRupee className="w-5 h-5 opacity-70" />
            {netBalance.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap gap-4 items-center justify-between bg-secondary/20">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Time</option>
                <option value="current">Current Month</option>
                <option value="previous">Previous Month</option>
                <option value="custom">Custom Range</option>
              </select>
              
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Entries</option>
                <option value="credit">Credits Only</option>
                <option value="debit">Debits Only</option>
              </select>
            </div>

            {selectedMonth === 'custom' && (
              <div className="flex gap-2 items-center text-sm">
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)} 
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground font-medium">to</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)} 
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button 
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-background border border-border rounded-md hover:bg-secondary transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium text-right">Credit</th>
                <th className="px-6 py-4 font-medium text-right">Debit</th>
                <th className="px-6 py-4 font-medium text-right">Running Balance</th>
                <th className="px-6 py-4 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No records found for the selected filters.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {entry.name}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.credit > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold">
                          + ₹ {entry.credit.toLocaleString('en-IN')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.debit > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2.5 py-1 rounded-md font-semibold">
                          - ₹ {entry.debit.toLocaleString('en-IN')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold tracking-tight">
                      ₹ {entry.balance?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Add Manual Entry</h2>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name / Description</label>
                  {entryType === 'credit' ? (
                    <select 
                      value={entryName} 
                      onChange={e => setEntryName(e.target.value)} 
                      required 
                      className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                    >
                      <option value="">Select Project...</option>
                      {pendingProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Pending: ₹{p.pending.toLocaleString('en-IN')})</option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  ) : (
                    <select 
                      value={entryName} 
                      onChange={e => setEntryName(e.target.value)} 
                      required 
                      className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                    >
                      <option value="">Select Category...</option>
                      <option value="Salary">Salary</option>
                      <option value="Ads">Ads</option>
                      <option value="Recharge">Recharge</option>
                      <option value="Other">Other (Custom)</option>
                    </select>
                  )}
                  {entryName === 'Other' && (
                    <input 
                      type="text" 
                      value={customName} 
                      onChange={e => setCustomName(e.target.value)} 
                      required 
                      className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
                      placeholder="Specify custom name..." 
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`border rounded-lg p-3 flex items-center gap-2 cursor-pointer transition-colors ${entryType === 'credit' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-border bg-background'}`}>
                      <input type="radio" name="type" value="credit" checked={entryType === 'credit'} onChange={e => { setEntryType(e.target.value); setEntryName(''); setCustomName(''); }} className="sr-only" />
                      <ArrowDownRight className={`w-5 h-5 ${entryType === 'credit' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      <span className="font-semibold text-sm">Credit (In)</span>
                    </label>
                    <label className={`border rounded-lg p-3 flex items-center gap-2 cursor-pointer transition-colors ${entryType === 'debit' ? 'border-red-500 bg-red-50 text-red-900' : 'border-border bg-background'}`}>
                      <input type="radio" name="type" value="debit" checked={entryType === 'debit'} onChange={e => { setEntryType(e.target.value); setEntryName(''); setCustomName(''); }} className="sr-only" />
                      <ArrowUpRight className={`w-5 h-5 ${entryType === 'debit' ? 'text-red-600' : 'text-muted-foreground'}`} />
                      <span className="font-semibold text-sm">Debit (Out)</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} required min="1" className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-border mt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? 'Saving...' : 'Save Entry'}
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




