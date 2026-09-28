"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, doc, getDocs, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';

interface Message {
  id: string;
  text: string;
  uid: string;
  roomId: string;
  createdAt: any;
  senderName: string;
  senderRole: string;
  senderPicUrl: string;
  actionText?: string;
  actionUrl?: string;
}

export default function DeveloperChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [founderUid, setFounderUid] = useState<string | null>(null);
  const [founderInfo, setFounderInfo] = useState({ name: 'Founder', role: 'Founder', picUrl: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [currentUserInfo, setCurrentUserInfo] = useState({
    name: 'Unknown',
    role: 'Member',
    picUrl: ''
  });

  useEffect(() => {
    const fetchFounderAndUser = async () => {
      // Get founder UID
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        const founderDoc = usersSnap.docs[0];
        setFounderUid(founderDoc.id);
        const fData = founderDoc.data();
        setFounderInfo({
          name: fData.name || 'Founder',
          role: 'Founder',
          picUrl: fData.profilePicUrl || ''
        });
      }
    };
    fetchFounderAndUser();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        const q = query(collection(db, 'team_members'), where("email", "==", currentUser.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setCurrentUserInfo({
            name: data.name || 'Team Member',
            role: data.role || 'Member',
            picUrl: data.profilePicUrl || ''
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !user.email || !founderUid) {
      setMessages([]);
      return;
    }

    const roomId = `${founderUid}_${user.email}`;
    const q = query(
      collection(db, 'team_messages'),
      where('roomId', '==', roomId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      const unreadPromises: any[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data } as Message);
        
        // Mark as read if it's from the founder
        if (data.read === false && data.uid !== user.uid) {
          unreadPromises.push(updateDoc(doc(db, 'team_messages', docSnap.id), { read: true }));
        }
      });
      
      Promise.all(unreadPromises).catch(err => console.error("Error marking read:", err));
      
      // Sort on client side to avoid Firebase composite index requirement
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeA - timeB;
      });
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, founderUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !user.email || !founderUid) return;
    
    setSending(true);
    const msgText = newMessage.trim();
    setNewMessage('');
    const roomId = `${founderUid}_${user.email}`;
    
    try {
      await addDoc(collection(db, 'team_messages'), {
        text: msgText,
        uid: user.uid,
        roomId: roomId,
        createdAt: serverTimestamp(),
        senderName: currentUserInfo.name,
        senderRole: currentUserInfo.role,
        senderPicUrl: currentUserInfo.picUrl,
        read: false
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message for everyone?')) return;
    try {
      await deleteDoc(doc(db, 'team_messages', messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message.");
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Sending...';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
          Team Chat
        </h1>
        <p className="text-muted-foreground text-sm">
          You only have permission to send messages with the Founder.
        </p>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="h-16 border-b border-border px-6 flex items-center bg-background">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background overflow-hidden border border-border">
              {founderInfo.picUrl ? (
                <img src={founderInfo.picUrl} alt={founderInfo.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-xs">{founderInfo.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">{founderInfo.name}</div>
              <div className="text-xs text-muted-foreground">{founderInfo.role}</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
              <p>No messages yet.</p>
              <p className="text-xs mt-1">Send a message to {founderInfo.name}!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = user && msg.uid === user.uid;
              const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : '?';

              return (
                <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group/message`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center mt-1">
                    {msg.senderPicUrl ? (
                      <img src={msg.senderPicUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{initial}</span>
                    )}
                  </div>
                  
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className="text-[10px] text-muted-foreground">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground opacity-70">{formatTime(msg.createdAt)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 group-hover/message:visible">
                      {isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-full hover:bg-secondary opacity-0 group-hover/message:opacity-100 transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm flex flex-col gap-2 ${isMe ? 'bg-foreground text-background rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm border border-border/50'}`}>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.actionUrl && msg.actionText && (
                          <Link 
                            href={msg.actionUrl} 
                            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg text-center transition-colors shadow-sm w-max"
                          >
                            {msg.actionText}
                          </Link>
                        )}
                      </div>
                      {!isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-full hover:bg-secondary opacity-0 group-hover/message:opacity-100 transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-background border-t border-border">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${founderInfo.name.split(' ')[0]}...`}
              className="flex-1 bg-secondary/50 border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || loading}
              className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shrink-0 shadow-sm"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
