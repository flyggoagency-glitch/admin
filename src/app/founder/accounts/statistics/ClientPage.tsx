"use client";

import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, TrendingUp, TrendingDown, Landmark, BarChart2, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function StatisticsPage() {
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = async (user: any) => {
        try {
            // User Settings (Opening Balance)
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists() && typeof userSnap.data().bankOpeningBalance === 'number') {
                setOpeningBalance(userSnap.data().bankOpeningBalance);
            }

            // Ledger Entries
            const q = query(collection(db, 'users', user.uid, 'accounts_ledger'), orderBy('createdAt', 'asc'));
            const ledgerSnap = await getDocs(q);
            const le: any[] = [];
            ledgerSnap.forEach(docSnap => {
                le.push({ id: docSnap.id, ...docSnap.data() });
            });
            setLedgerEntries(le);
        } catch (error) {
            console.error("Error fetching Statistics data", error);
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

    // Calculations
    const stats = useMemo(() => {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

        let currentBankBalance = openingBalance;
        let prevMonthEndBankBalance = openingBalance;
        
        let currentMonthNet = 0;
        let prevMonthNet = 0;

        const chartData: any[] = [];
        chartData.push({ date: 'Start', balance: openingBalance });

        const monthlyNetMap: Record<string, { rawMonth: string, displayMonth: string, netBalance: number }> = {};

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

            const timestamp = data.createdAt;
            const d = new Date(timestamp);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const displayMonth = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });

            if (!monthlyNetMap[monthKey]) {
                monthlyNetMap[monthKey] = { rawMonth: monthKey, displayMonth, netBalance: 0 };
            }

            // Running Bank Balance
            if (isCredit) {
                currentBankBalance += amount;
                if (timestamp < currentMonthStart) prevMonthEndBankBalance += amount;
            }
            if (isDebit) {
                currentBankBalance -= amount;
                if (timestamp < currentMonthStart) prevMonthEndBankBalance -= amount;
            }

            // Monthly Net Balances (exclude bank adjustments for accurate net performance)
            if (!isBankAdj) {
                if (timestamp >= currentMonthStart) {
                    if (isCredit) currentMonthNet += amount;
                    if (isDebit) currentMonthNet -= amount;
                } else if (timestamp >= prevMonthStart && timestamp < currentMonthStart) {
                    if (isCredit) prevMonthNet += amount;
                    if (isDebit) prevMonthNet -= amount;
                }
                
                // Track for all months chart
                if (isCredit) monthlyNetMap[monthKey].netBalance += amount;
                if (isDebit) monthlyNetMap[monthKey].netBalance -= amount;
            }

            // Only add data points that affect the balance
            if (isCredit || isDebit) {
                const dateStr = new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                chartData.push({
                    date: dateStr,
                    balance: currentBankBalance
                });
            }
        });

        const monthlyChartData = Object.values(monthlyNetMap).sort((a, b) => a.rawMonth.localeCompare(b.rawMonth));

        const bankImprovement = currentBankBalance - prevMonthEndBankBalance;
        const bankImprovementPercent = prevMonthEndBankBalance === 0 ? 0 : (bankImprovement / Math.abs(prevMonthEndBankBalance)) * 100;
        
        const netImprovement = currentMonthNet - prevMonthNet;
        const netImprovementPercent = prevMonthNet === 0 ? 0 : (netImprovement / Math.abs(prevMonthNet)) * 100;

        return {
            chartData,
            monthlyChartData,
            currentBankBalance,
            prevMonthEndBankBalance,
            bankImprovement,
            bankImprovementPercent,
            currentMonthNet,
            prevMonthNet,
            netImprovement,
            netImprovementPercent,
            currentMonthName: now.toLocaleString('default', { month: 'long' }),
            prevMonthName: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' })
        };
    }, [ledgerEntries, openingBalance]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Statistics & Performance</h1>
                <p className="text-muted-foreground mt-1">Analyze your financial improvement between {stats.prevMonthName} and {stats.currentMonthName}.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Net Balance Comparison */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-2xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart2 className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold">Monthly Net Balance</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-secondary/50 rounded-xl">
                            <p className="text-sm text-muted-foreground mb-1 font-medium">{stats.prevMonthName} (Last Month)</p>
                            <p className="text-xl font-bold text-foreground">₹ {stats.prevMonthNet.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                            <p className="text-sm text-indigo-600/80 mb-1 font-medium">{stats.currentMonthName} (This Month)</p>
                            <p className="text-xl font-bold text-indigo-700">₹ {stats.currentMonthNet.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl flex items-center justify-between ${stats.netImprovement >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                        <div>
                            <p className={`text-sm font-semibold ${stats.netImprovement >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {stats.netImprovement >= 0 ? 'Improvement' : 'Decline'}
                            </p>
                            <p className={`text-2xl font-bold mt-1 ${stats.netImprovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {stats.netImprovement > 0 ? '+' : ''}₹ {stats.netImprovement.toLocaleString('en-IN')}
                            </p>
                        </div>
                        <div className={`flex items-center gap-1 font-bold text-lg ${stats.netImprovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {stats.netImprovement >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            {stats.netImprovementPercent.toFixed(1)}%
                        </div>
                    </div>
                </motion.div>

                {/* Bank Balance Comparison */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-2xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Landmark className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-bold">Total Bank Balance</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-secondary/50 rounded-xl">
                            <p className="text-sm text-muted-foreground mb-1 font-medium">End of {stats.prevMonthName}</p>
                            <p className="text-xl font-bold text-foreground">₹ {stats.prevMonthEndBankBalance.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                            <p className="text-sm text-amber-600/80 mb-1 font-medium">Current Balance</p>
                            <p className="text-xl font-bold text-amber-700">₹ {stats.currentBankBalance.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl flex items-center justify-between ${stats.bankImprovement >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                        <div>
                            <p className={`text-sm font-semibold ${stats.bankImprovement >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {stats.bankImprovement >= 0 ? 'Growth' : 'Reduction'}
                            </p>
                            <p className={`text-2xl font-bold mt-1 ${stats.bankImprovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {stats.bankImprovement > 0 ? '+' : ''}₹ {stats.bankImprovement.toLocaleString('en-IN')}
                            </p>
                        </div>
                        <div className={`flex items-center gap-1 font-bold text-lg ${stats.bankImprovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {stats.bankImprovement >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            {stats.bankImprovementPercent.toFixed(1)}%
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Performance History Chart */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-2xl p-6 shadow-sm mt-6"
            >
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-bold">Complete Performance History</h2>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6b7280' }} 
                                dy={10} 
                            />
                            <YAxis 
                                tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6b7280' }} 
                                width={60}
                            />
                            <Tooltip 
                                formatter={(value: any) => [`₹ ${Number(value).toLocaleString('en-IN')}`, 'Bank Balance']}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="balance" 
                                stroke="#10b981" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorBalance)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Monthly Net Difference Chart */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-card border border-border rounded-2xl p-6 shadow-sm mt-6"
            >
                <div className="flex items-center gap-2 mb-6">
                    <BarChart2 className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold">Monthly Net Difference</h2>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="displayMonth" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6b7280' }} 
                                dy={10} 
                            />
                            <YAxis 
                                tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6b7280' }} 
                                width={60}
                            />
                            <Tooltip 
                                formatter={(value: any) => [`₹ ${Number(value).toLocaleString('en-IN')}`, 'Net Income']}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="netBalance" 
                                stroke="#6366f1" 
                                strokeWidth={3}
                                activeDot={{ r: 6 }} 
                                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} 
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    );
}
