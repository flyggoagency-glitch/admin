"use client";

import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, IndianRupee, Target, Users, TrendingUp, Landmark, Pencil, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MoneyStalkPage() {
    const [pendingProjects, setPendingProjects] = useState<any[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editTotal, setEditTotal] = useState('');
    const [editAdvance, setEditAdvance] = useState('');
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    const fetchData = async (user: any) => {
        try {
            // 1. Pending Projects
            const projectsSnap = await getDocs(collection(db, 'projects'));
            const pp: any[] = [];
            projectsSnap.forEach(docSnap => {
                const data = docSnap.data();
                const total = Number(data.totalAmount) || 0;
                const advance = Number(data.advanceAmount) || 0;
                if (data.status !== 'Completed') {
                    pp.push({ id: docSnap.id, ...data, pendingAmount: total - advance });
                }
            });
            // Sort by pending amount descending
            pp.sort((a, b) => b.pendingAmount - a.pendingAmount);
            setPendingProjects(pp);

            // 2. User Settings (Opening Balance)
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists() && typeof userSnap.data().bankOpeningBalance === 'number') {
                setOpeningBalance(userSnap.data().bankOpeningBalance);
            }

            // 3. Ledger Entries
            const q = query(collection(db, 'users', user.uid, 'accounts_ledger'), orderBy('createdAt', 'asc'));
            const ledgerSnap = await getDocs(q);
            const le: any[] = [];
            ledgerSnap.forEach(docSnap => {
                le.push({ id: docSnap.id, ...docSnap.data() });
            });
            setLedgerEntries(le);

        } catch (error) {
            console.error("Error fetching Money Stalk data", error);
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

    const openEditModal = (project: any) => {
        setEditingProject(project);
        setEditTotal(project.totalAmount.toString());
        setEditAdvance(project.advanceAmount.toString());
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser || !editingProject || isSubmittingEdit) return;
        setIsSubmittingEdit(true);

        try {
            // Update the global projects collection
            await updateDoc(doc(db, 'projects', editingProject.id), {
                totalAmount: Number(editTotal),
                advanceAmount: Number(editAdvance),
                status: Number(editAdvance) >= Number(editTotal) ? 'Completed' : editingProject.status
            });

            // Find and update the Project Assigned ledger entry
            const ledgerEntry = ledgerEntries.find(l => l.type === 'Project Assigned' && l.projectName === editingProject.name);
            if (ledgerEntry) {
                await updateDoc(doc(db, 'users', auth.currentUser.uid, 'accounts_ledger', ledgerEntry.id), {
                    totalAmount: Number(editTotal),
                    advanceAmount: Number(editAdvance)
                });
            }

            setIsEditModalOpen(false);
            fetchData(auth.currentUser);
        } catch (error) {
            console.error("Error updating project financials", error);
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Calculations
    const stats = useMemo(() => {
        let currentBankBalance = openingBalance;
        let currentMonthNet = 0;
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        ledgerEntries.forEach(data => {
            let isCredit = false;
            let isDebit = false;
            let isBankAdj = false;
            let amount = 0;

            if (data.type === 'credit') {
                isCredit = true;
                amount = Number(data.amount) || 0;
                if (data.name === 'Bank Reconciliation Adjustment') isBankAdj = true;
            } else if (data.type === 'debit') {
                isDebit = true;
                amount = Number(data.amount) || 0;
                if (data.name === 'Bank Reconciliation Adjustment') isBankAdj = true;
            } else if (data.type === 'bank_adj_credit') {
                isCredit = true;
                isBankAdj = true;
                amount = Number(data.amount) || 0;
            } else if (data.type === 'bank_adj_debit') {
                isDebit = true;
                isBankAdj = true;
                amount = Number(data.amount) || 0;
            } else if (data.type === 'Project Assigned' && data.advanceAmount > 0) {
                isCredit = true;
                amount = Number(data.advanceAmount) || 0;
            }

            if (isCredit) currentBankBalance += amount;
            if (isDebit) currentBankBalance -= amount;

            if (data.createdAt >= currentMonthStart && !isBankAdj) {
                if (isCredit) currentMonthNet += amount;
                if (isDebit) currentMonthNet -= amount;
            }
        });

        const totalPending = pendingProjects.reduce((sum, p) => sum + p.pendingAmount, 0);

        return {
            currentBankBalance,
            currentMonthNet,
            totalPending,
            expectedBankBalance: currentBankBalance + totalPending,
            expectedMonthNet: currentMonthNet + totalPending
        };
    }, [pendingProjects, ledgerEntries, openingBalance]);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                    Money Stalk
                </h1>
                <p className="text-muted-foreground text-sm">
                    Track all your pending receivables and forecast your expected balances.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Pending Pay */}
                <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-amber-900">Total Pending Pay</p>
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Target className="w-4 h-4 text-amber-600" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-amber-700 flex items-center gap-1">
                        <IndianRupee className="w-6 h-6 opacity-70" />
                        {stats.totalPending.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-xs text-amber-700/80 mt-2 font-medium">To be collected from {pendingProjects.length} sources</p>
                </div>

                {/* Expected Bank Balance */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Landmark className="w-24 h-24" />
                    </div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <p className="text-sm font-semibold text-slate-300">Expected Bank Balance</p>
                        <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                            <Landmark className="w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white flex items-center gap-1 relative z-10">
                        <IndianRupee className="w-6 h-6 opacity-70" />
                        {stats.expectedBankBalance.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 relative z-10">
                        Current: ₹{stats.currentBankBalance.toLocaleString('en-IN')} + Pending: ₹{stats.totalPending.toLocaleString('en-IN')}
                    </p>
                </div>

                {/* Expected Net Balance (Monthly) */}
                <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-emerald-900">Expected Net Balance</p>
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-emerald-700 flex items-center gap-1">
                        <IndianRupee className="w-6 h-6 opacity-70" />
                        {stats.expectedMonthNet.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-xs text-emerald-700/80 mt-2 font-medium">
                        Current Month: ₹{stats.currentMonthNet.toLocaleString('en-IN')} + Pending
                    </p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">Who owes you?</h3>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium bg-secondary px-2 py-1 rounded">
                        {pendingProjects.length} Pending
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium">Project Name</th>
                                <th className="px-6 py-4 font-medium">Assigned Developer</th>
                                <th className="px-6 py-4 font-medium text-center">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Total Amount</th>
                                <th className="px-6 py-4 font-medium text-right">Advance Paid</th>
                                <th className="px-6 py-4 font-medium text-right">Pending Amount</th>
                                <th className="px-6 py-4 font-medium text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {pendingProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        No pending payments! You have collected everything.
                                    </td>
                                </tr>
                            ) : (
                                pendingProjects.map((project) => (
                                    <motion.tr 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        key={project.id} 
                                        className="hover:bg-secondary/20 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-bold text-foreground">
                                            {project.name}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {project.assignee === auth.currentUser?.email || project.assignee === 'self' 
                                                ? 'Self (Founder)' 
                                                : (project.assignee || 'Unassigned')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 bg-secondary text-xs font-bold rounded-md uppercase tracking-wider text-muted-foreground inline-block">
                                                {project.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">
                                            ₹ {Number(project.totalAmount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                            ₹ {Number(project.advanceAmount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-amber-600 tracking-tight">
                                            ₹ {project.pendingAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => openEditModal(project)}
                                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                                                title="Edit Amounts"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden"
                        >
                            <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                                <div>
                                    <h2 className="text-xl font-bold">Edit Project Financials</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Correct the amounts for {editingProject?.name}</p>
                                </div>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveEdit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Total Project Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                                            <input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)} required min="0" className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Advance Paid</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                                            <input type="number" value={editAdvance} onChange={e => setEditAdvance(e.target.value)} required min="0" className="w-full bg-background border border-border rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-border mt-6">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={isSubmittingEdit} className="flex-1 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex justify-center items-center gap-2">
                                        {isSubmittingEdit ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
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
