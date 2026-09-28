"use client";
import dynamic from 'next/dynamic';
const RoleGuard = dynamic(() => import('./RoleGuard').then(m => m.RoleGuard), { ssr: false });
export function RoleGuardWrapper() {
  return <RoleGuard />;
}
