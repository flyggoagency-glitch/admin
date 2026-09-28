"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';

interface AttendanceContextType {
  hasMarkedAttendance: boolean;
  attendanceData: any | null;
  markAttendance: (task: string, description: string, otherTaskName?: string) => Promise<void>;
  isLoading: boolean;
  deliveredProjects: number;
  handleDeliverProject: () => void;
  user: User | null;
  userRole: string | null;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasMarkedAttendance, setHasMarkedAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveredProjects, setDeliveredProjects] = useState(0);

  const getTodayDocId = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          if (currentUser.email) {
            const q = query(collection(db, 'team_members'), where("email", "==", currentUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setUserRole(querySnapshot.docs[0].data().role?.toLowerCase() || 'developer');
            }
          }

          const attendanceRef = doc(db, 'users', currentUser.uid, 'attendance', getTodayDocId());
          const docSnap = await getDoc(attendanceRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setHasMarkedAttendance(true);
            setAttendanceData(data);
          } else {
            setHasMarkedAttendance(false);
          }
        } catch (error) {
          console.error("Failed to load attendance from Firebase:", error);
          setHasMarkedAttendance(false);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAttendance = async (task: string, description: string, otherTaskName?: string) => {
    if (!user) return;
    
    const attendanceRef = doc(db, 'users', user.uid, 'attendance', getTodayDocId());
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check if late (after 9:30 AM), BUT ignore for telecallers
    const cutoff = new Date();
    cutoff.setHours(9, 30, 0, 0);
    const isLate = userRole !== 'telecaller' && now > cutoff;

    const finalTaskName = task === 'Other' ? otherTaskName || 'Unspecified' : task;

    const newData = {
      task: finalTaskName,
      description,
      timestamp: Date.now(),
      timeString,
      isLate,
      status: isLate ? 'Late' : 'Present',
      date: getTodayDocId(),
      email: user.email || 'Unknown'
    };

    try {
      await setDoc(attendanceRef, newData, { merge: true });
      setHasMarkedAttendance(true);
      setAttendanceData(newData);
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      throw error;
    }
  };

  const handleDeliverProject = () => {
    setDeliveredProjects(prev => prev + 1);
  };

  return (
    <AttendanceContext.Provider 
      value={{ 
        hasMarkedAttendance, 
        attendanceData,
        markAttendance,
        isLoading,
        deliveredProjects,
        handleDeliverProject,
        user,
        userRole
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
