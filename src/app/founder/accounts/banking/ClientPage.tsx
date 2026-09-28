"use client";

import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, doc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, IndianRupee, ArrowDownRight, ArrowUpRight, Scale, Settings2, History, Download } from 'lucide-react';
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
  continuousBalance?: number;
}

export default function BankingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Time Filters
  const [selectedMonth, setSelectedMonth] = useState('all'); // all, current, previous, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modals
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [newOpeningBalance, setNewOpeningBalance] = useState('');
  
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [isSubmittingOpening, setIsSubmittingOpening] = useState(false);
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  const fetchData = async (user: any) => {
    try {
      // 1. Fetch User Settings (Opening Balance)
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      let loadedOpeningBalance = 0;
      if (userSnap.exists() && typeof userSnap.data().bankOpeningBalance === 'number') {
        loadedOpeningBalance = userSnap.data().bankOpeningBalance;
      }
      setOpeningBalance(loadedOpeningBalance);

      // 2. Fetch Continuous Ledger
      const q = query(collection(db, 'users', user.uid, 'accounts_ledger'), orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetched: Transaction[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.type === 'credit' || data.type === 'debit' || data.type === 'bank_adj_credit' || data.type === 'bank_adj_debit') {
          fetched.push({
            id: docSnap.id,
            createdAt: data.createdAt,
            name: data.name,
            credit: (data.type === 'credit' || data.type === 'bank_adj_credit') ? Number(data.amount) : 0,
            debit: (data.type === 'debit' || data.type === 'bank_adj_debit') ? Number(data.amount) : 0,
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
      console.error("Error fetching banking data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Continuous Calculation
  const processedData = useMemo(() => {
    let runningBalance = openingBalance;
    let totalCred = 0;
    let totalDeb = 0;
    
    const processed = transactions.map(t => {
      runningBalance += t.credit;
      runningBalance -= t.debit;
      totalCred += t.credit;
      totalDeb += t.debit;
      
      return { ...t, continuousBalance: runningBalance };
    });

    let displayList = [...processed];

    if (selectedMonth !== 'all') {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      
      if (selectedMonth === 'current') {
        displayList = displayList.filter(t => t.createdAt >= currentMonthStart);
      } else if (selectedMonth === 'previous') {
        displayList = displayList.filter(t => t.createdAt >= prevMonthStart && t.createdAt < currentMonthStart);
      } else if (selectedMonth === 'custom') {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
        displayList = displayList.filter(t => t.createdAt >= start && t.createdAt < end);
      }
    }

    // Reverse for UI to show newest at top
    return {
        list: displayList.reverse(),
        finalBalance: runningBalance,
        totalCred,
        totalDeb
    };
  }, [transactions, openingBalance, selectedMonth, customStartDate, customEndDate]);

  const handleUpdateOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isSubmittingOpening) return;
    setIsSubmittingOpening(true);
    
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { bankOpeningBalance: Number(newOpeningBalance) }, { merge: true });
      
      setOpeningBalance(Number(newOpeningBalance));
      setOpeningModalOpen(false);
      setNewOpeningBalance('');
    } catch (error) {
      console.error("Error updating opening balance", error);
    } finally {
      setIsSubmittingOpening(false);
    }
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isSubmittingReconcile) return;
    setIsSubmittingReconcile(true);
    
    const actual = Number(actualBalanceInput);
    const predicted = processedData.finalBalance;
    const diff = actual - predicted;
    
    if (diff === 0) {
        setReconcileModalOpen(false);
        setActualBalanceInput('');
        setIsSubmittingReconcile(false);
        return; // No adjustment needed
    }

    try {
      const type = diff > 0 ? 'bank_adj_credit' : 'bank_adj_debit';
      const amount = Math.abs(diff);

      await addDoc(collection(db, 'users', auth.currentUser.uid, 'accounts_ledger'), {
        name: 'Bank Reconciliation Adjustment',
        type: type,
        amount: amount,
        createdAt: Date.now()
      });
      
      setReconcileModalOpen(false);
      setActualBalanceInput('');
      fetchData(auth.currentUser);
    } catch (error) {
      console.error("Error creating adjustment entry", error);
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Flyggo Bank Statement', 14, 22);
    
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
    doc.text(`Opening Balance: Rs ${openingBalance.toLocaleString('en-IN')}`, 14, 42);

    doc.text(`Total Credits: Rs ${processedData.totalCred.toLocaleString('en-IN')}`, 14, 50);
    doc.text(`Total Debits: Rs ${processedData.totalDeb.toLocaleString('en-IN')}`, 80, 50);
    doc.text(`Final Balance: Rs ${processedData.finalBalance.toLocaleString('en-IN')}`, 150, 50);

    const tableColumn = ["Date", "Description", "Credit", "Debit", "Bank Balance"];
    const tableRows: any[] = [];

    // The list in processedData.list is reversed (newest first). Let's print it that way.
    processedData.list.forEach(entry => {
        tableRows.push([
            new Date(entry.createdAt).toLocaleDateString(),
            entry.name,
            entry.credit > 0 ? `+ Rs ${entry.credit.toLocaleString('en-IN')}` : '-',
            entry.debit > 0 ? `- Rs ${entry.debit.toLocaleString('en-IN')}` : '-',
            `Rs ${entry.continuousBalance?.toLocaleString('en-IN')}`
        ]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 56,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save('flyggo-bank-statement.pdf');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Banking
          </h1>
          <p className="text-muted-foreground text-sm">
            Continuous bank balance tracking and reconciliation.
          </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    setNewOpeningBalance(openingBalance.toString());
                    setOpeningModalOpen(true);
                }}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
                <Settings2 className="w-4 h-4" /> Opening Balance
            </button>
            <button 
                onClick={() => {
                    setActualBalanceInput('');
                    setReconcileModalOpen(true);
                }}
                className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
            >
                <Scale className="w-4 h-4" /> Reconcile
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm text-white col-span-1 md:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <IndianRupee className="w-24 h-24" />
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">Current Bank Balance (Predicted)</p>
          <h3 className="text-4xl font-bold flex items-center gap-1 my-2">
            <IndianRupee className="w-7 h-7 opacity-70" />
            {processedData.finalBalance.toLocaleString('en-IN')}
          </h3>
          <p className="text-xs text-slate-400 mt-2">Opening Baseline: ₹{openingBalance.toLocaleString('en-IN')}</p>
        </div>
        
        <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-medium text-emerald-800 mb-1">Lifetime Credits</p>
          <h3 className="text-2xl font-bold text-emerald-900 flex items-center gap-1">
            <ArrowDownRight className="w-5 h-5 opacity-70" />
            ₹ {processedData.totalCred.toLocaleString('en-IN')}
          </h3>
        </div>

        <div className="bg-red-50/50 border border-red-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-medium text-red-800 mb-1">Lifetime Debits</p>
          <h3 className="text-2xl font-bold text-red-900 flex items-center gap-1">
            <ArrowUpRight className="w-5 h-5 opacity-70" />
            ₹ {processedData.totalDeb.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Continuous Ledger</h3>
                    <select 
                      value={selectedMonth} 
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring ml-2 cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="current">Current Month</option>
                      <option value="previous">Previous Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                </div>
                
                {selectedMonth === 'custom' && (
                  <div className="flex gap-2 items-center text-sm ml-2">
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
            
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium text-right">Credit (In)</th>
                <th className="px-6 py-4 font-medium text-right">Debit (Out)</th>
                <th className="px-6 py-4 font-medium text-right">Bank Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processedData.list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No transactions found. Adding entries in the main Accounts ledger will affect this balance.
                  </td>
                </tr>
              ) : (
                processedData.list.map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {entry.name}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.credit > 0 ? (
                        <span className="text-emerald-600 font-semibold">
                          + ₹ {entry.credit.toLocaleString('en-IN')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.debit > 0 ? (
                        <span className="text-red-600 font-semibold">
                          - ₹ {entry.debit.toLocaleString('en-IN')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold tracking-tight">
                      ₹ {entry.continuousBalance?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Balance Modal */}
      <AnimatePresence>
        {openingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-sm w-full"
            >
              <h2 className="text-xl font-bold text-foreground mb-2">Opening Balance</h2>
              <p className="text-sm text-muted-foreground mb-4">Set the initial baseline amount in your bank account.</p>
              <form onSubmit={handleUpdateOpeningBalance} className="space-y-4">
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input type="number" value={newOpeningBalance} onChange={e => setNewOpeningBalance(e.target.value)} required className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setOpeningModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingOpening} className="flex-1 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                    {isSubmittingOpening && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmittingOpening ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reconcile Modal */}
      <AnimatePresence>
        {reconcileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-foreground mb-2">Reconcile Bank Balance</h2>
              <p className="text-sm text-muted-foreground mb-4">Enter your <b>Actual</b> bank balance. The system will create an adjustment entry to fix the difference.</p>
              
              <div className="bg-secondary/30 p-3 rounded-lg mb-4 flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Predicted Balance:</span>
                 <span className="font-bold text-lg">₹ {processedData.finalBalance.toLocaleString('en-IN')}</span>
              </div>

              <form onSubmit={handleReconcile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Actual Bank Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <input type="number" value={actualBalanceInput} onChange={e => setActualBalanceInput(e.target.value)} required className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                  </div>
                </div>
                
                {actualBalanceInput && Number(actualBalanceInput) !== processedData.finalBalance && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-1">
                        Will create a <b>{Number(actualBalanceInput) > processedData.finalBalance ? 'Credit (+)' : 'Debit (-)'}</b> entry of <b>₹{Math.abs(Number(actualBalanceInput) - processedData.finalBalance).toLocaleString('en-IN')}</b>.
                    </p>
                )}
                
                {actualBalanceInput && Number(actualBalanceInput) === processedData.finalBalance && (
                    <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100">
                        Balances already match perfectly!
                    </p>
                )}

                <div className="flex gap-3 pt-4 border-t border-border mt-6">
                  <button type="button" onClick={() => setReconcileModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingReconcile || (actualBalanceInput ? Number(actualBalanceInput) === processedData.finalBalance : true)} className="flex-1 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                    {isSubmittingReconcile && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmittingReconcile ? 'Adjusting...' : 'Adjust Balance'}
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
