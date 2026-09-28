"use client";
import dynamic from 'next/dynamic';
import React from 'react';

const ClientLayout = dynamic(() => import('./ClientLayout'), { ssr: false });

export default function TelecallerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
