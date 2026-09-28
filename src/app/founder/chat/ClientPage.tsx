"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Trash2, Search, Users, MessageSquare } from 'lucide-react';
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

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicUrl?: string;
}

export default function TeamChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  
  const [currentUserInfo, setCurrentUserInfo] = useState({
    name: 'Unknown',
    role: 'Member',
    picUrl: ''
  });

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Fetch current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const founderDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (founderDoc.exists()) {
          const data = founderDoc.data();
          setCurrentUserInfo({
            name: data.name || 'Founder',
            role: 'Founder',
            picUrl: data.profilePicUrl || ''
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to all unread messages to show badges on sidebar
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'team_messages'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.uid !== user.uid && data.roomId) {
          // roomId is "founderUid_devEmail"
          const parts = data.roomId.split('_');
          if (parts.length === 2) {
            const devEmail = parts[1];
            counts[devEmail] = (counts[devEmail] || 0) + 1;
          }
        }
      });
      setUnreadCounts(counts);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch team members
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const q = query(collection(db, 'team_members'));
        const snap = await getDocs(q);
        const members: TeamMember[] = [];
        snap.forEach(doc => {
          members.push({ id: doc.id, ...doc.data() } as TeamMember);
        });
        setTeamMembers(members);
      } catch (err) {
        console.error("Error fetching team members", err);
      }
    };
    fetchTeam();
  }, []);

  // Listen to messages for the selected room
  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // The roomId will be "founderUid_devEmail" to ensure uniqueness
    const roomId = `${user.uid}_${selectedUser.email}`;

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
        
        // Mark as read if it's from the other person
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
  }, [user, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedUser) return;
    
    setSending(true);
    const msgText = newMessage.trim();
    setNewMessage('');
    const roomId = `${user.uid}_${selectedUser.email}`;
    
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

  const handleClearAll = async () => {
    if (!confirm('Are you absolutely sure you want to clear this entire chat history? This cannot be undone.')) return;
    try {
      const promises = messages.map(msg => deleteDoc(doc(db, 'team_messages', msg.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Failed to clear chat history.");
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Sending...';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Team Chat
          </h1>
          <p className="text-muted-foreground text-sm">
            Select a team member to start chatting.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl shadow-sm flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-background">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search team..." 
                className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedUser(member)}
                className={`w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-border/50 hover:bg-secondary/50 ${selectedUser?.id === member.id ? 'bg-secondary' : ''}`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background overflow-hidden border border-border">
                  {member.profilePicUrl ? (
                    <img src={member.profilePicUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-sm">{member.name ? member.name.charAt(0).toUpperCase() : '?'}</span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium text-sm text-foreground truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{member.role}</div>
                </div>
                {unreadCounts[member.email] > 0 && selectedUser?.id !== member.id && (
                  <div className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center">
                    {unreadCounts[member.email] > 99 ? '99+' : unreadCounts[member.email]}
                  </div>
                )}
              </button>
            ))}
            {teamMembers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                <Users className="w-8 h-8 mb-2 opacity-20" />
                No team members found.
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-background">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background overflow-hidden border border-border">
                    {selectedUser.profilePicUrl ? (
                      <img src={selectedUser.profilePicUrl} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-xs">{selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '?'}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{selectedUser.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedUser.role}</div>
                  </div>
                </div>
                {messages.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Chat
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-card">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                    <p>No messages yet.</p>
                    <p className="text-xs mt-1">Start a conversation with {selectedUser.name.split(' ')[0]}!</p>
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
                    placeholder={`Message ${selectedUser.name.split(' ')[0]}...`}
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-card text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a team member</p>
              <p className="text-xs opacity-70 mt-1">Choose someone from the sidebar to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
