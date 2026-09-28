"use client";
import dynamic from 'next/dynamic';

const DashboardClient = dynamic(() => import('./FounderDashboardClient'), { ssr: false });

export default function FounderDashboard() {
  return <DashboardClient />;
}
