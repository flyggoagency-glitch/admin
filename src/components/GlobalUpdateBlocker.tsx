"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAttendance } from '@/components/AttendanceProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Send, PhoneCall } from 'lucide-react';

export function GlobalUpdateBlocker() {
  const { user } = useAttendance();
  const [updateRequested, setUpdateRequested] = useState(false);
  const [memberDocId, setMemberDocId] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    const q = query(collection(db, 'team_members'), where('email', '==', user.email));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const memberDoc = snapshot.docs[0];
        setMemberDocId(memberDoc.id);
        const data = memberDoc.data();
        if (data.updateRequested === true) {
          setUpdateRequested(true);
        } else {
          setUpdateRequested(false);
          setIsAnswered(false);
        }
      }
    }, (error) => {
      console.warn("GlobalUpdateBlocker snapshot error:", error);
    });

    return () => unsubscribe();
  }, [user?.email]);

  // Play ringing sound when block appears and is not answered
  useEffect(() => {
    if (!updateRequested || isAnswered) return;
    
    let interval: NodeJS.Timeout;
    let audioCtx: AudioContext | null = null;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
      
      const playRing = () => {
        if (!audioCtx) return;
        const playTone = (startOffset: number, duration: number) => {
          const osc1 = audioCtx!.createOscillator();
          const osc2 = audioCtx!.createOscillator();
          const gain = audioCtx!.createGain();
          
          osc1.type = 'sine';
          osc1.frequency.value = 440;
          osc2.type = 'sine';
          osc2.frequency.value = 480;
          
          gain.gain.setValueAtTime(0, audioCtx!.currentTime + startOffset);
          gain.gain.linearRampToValueAtTime(0.3, audioCtx!.currentTime + startOffset + 0.1);
          gain.gain.linearRampToValueAtTime(0, audioCtx!.currentTime + startOffset + duration);
          
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(audioCtx!.destination);
          
          osc1.start(audioCtx!.currentTime + startOffset);
          osc1.stop(audioCtx!.currentTime + startOffset + duration);
          osc2.start(audioCtx!.currentTime + startOffset);
          osc2.stop(audioCtx!.currentTime + startOffset + duration);
        };
        // Digital double ring pattern
        playTone(0, 0.4);
        playTone(0.6, 0.4);
      };

      playRing();
      interval = setInterval(playRing, 3000); // repeat every 3 seconds

    } catch (error) {
      console.error("Audio play failed:", error);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [updateRequested, isAnswered]);

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateText.trim() || !memberDocId) return;
    
    setSubmitting(true);
    try {
      // 1. Send the response as a message to the Founder
      const { collection, getDocs, addDoc, serverTimestamp, query, where } = await import('firebase/firestore');
      
      const usersSnap = await getDocs(collection(db, 'users'));
      let founderUid = '';
      if (!usersSnap.empty) {
        founderUid = usersSnap.docs[0].id;
      }

      if (founderUid && user?.email) {
        const roomId = `${founderUid}_${user.email}`;
        
        const q = query(collection(db, 'team_members'), where('email', '==', user.email));
        const currentMemberSnap = await getDocs(q);
        const currentMemberData = !currentMemberSnap.empty ? currentMemberSnap.docs[0].data() : {};
        
        await addDoc(collection(db, 'team_messages'), {
          text: `🚨 [Urgent Update]\n${updateText}`,
          uid: user.uid,
          roomId: roomId,
          createdAt: serverTimestamp(),
          senderName: currentMemberData.name || 'Team Member',
          senderRole: currentMemberData.role || 'Developer',
          senderPicUrl: currentMemberData.profilePicUrl || '',
          read: false
        });
      }

      // 2. Clear the block flag and save to history
      await updateDoc(doc(db, 'team_members', memberDocId), {
        updateRequested: false,
        updateHistory: arrayUnion({
          timestamp: Date.now(),
          message: updateText
        })
      });
      setUpdateText('');
      setIsAnswered(false);
    } catch (error) {
      console.error("Failed to submit update:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!updateRequested) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 pointer-events-auto">
      <AnimatePresence mode="wait">
        {!isAnswered ? (
          <motion.div 
            key="ringing"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.2 } }}
            className="flex flex-col items-center max-w-sm w-full text-center"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-30 w-24 h-24 m-auto" />
              <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl relative z-10 mx-auto">
                <PhoneCall className="w-12 h-12 animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-foreground mb-2">Team is Calling</h2>
            <p className="text-muted-foreground mb-12 text-lg">
              Urgent update requested.
            </p>

            <button
              onClick={() => setIsAnswered(true)}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-12 rounded-full text-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-transform hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <Phone className="w-6 h-6" />
              Answer
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="answering"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-card border-2 border-green-500/50 p-8 rounded-3xl shadow-2xl max-w-lg w-full relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center mb-4">
                <PhoneCall className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Active Call</h2>
              <p className="text-muted-foreground mt-2">
                Type your progress update below to complete the call.
              </p>
            </div>

            <form onSubmit={handleSubmitUpdate} className="space-y-4">
              <textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="What are you currently working on?"
                required
                className="w-full bg-background border border-border rounded-xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[120px] resize-none"
              />
              <button
                type="submit"
                disabled={submitting || !updateText.trim()}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,197,94,0.2)]"
              >
                {submitting ? 'Sending...' : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Update & End Call
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
