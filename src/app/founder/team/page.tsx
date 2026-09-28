"use client";

import { useState, useEffect } from 'react';
import { db, auth, firebaseConfig } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { UserPlus, ShieldAlert, Ban, Trash2, CheckCircle2, AlertCircle, Eye, Pencil, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Suspended' | 'Blocked';
  dob?: string;
  phone?: string;
  profilePicUrl?: string;
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Developer');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    dob: '',
    phone: '',
    profilePicUrl: ''
  });
  const [updating, setUpdating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'website');

      const response = await fetch(`https://api.cloudinary.com/v1_1/iufxukbz/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.secure_url) {
        setEditForm(prev => ({ ...prev, profilePicUrl: data.secure_url }));
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      alert("Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const q = query(collection(db, 'team_members'));
      const querySnapshot = await getDocs(q);
      const fetched: TeamMember[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      setMembers(fetched);
    } catch (error) {
      console.error("Error fetching team members", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setErrorMsg('');

    try {
      // 1. Create the user in Firebase Auth using a secondary instance
      // This prevents the Founder from being logged out!
      const secondaryAppName = `SecondaryApp_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const uid = userCred.user.uid;
      
      // Ensure the secondary instance logs out (just to be safe)
      await signOut(secondaryAuth);

      // 2. Add them to our Firestore database
      await addDoc(collection(db, 'team_members'), {
        name: newName,
        email: newEmail,
        role: newRole,
        uid: uid,
        status: 'Active'
      });

      setShowModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      fetchMembers();
    } catch (error: any) {
      console.error("Error creating user", error);
      setErrorMsg(error.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const memberRef = doc(db, 'team_members', id);
      await updateDoc(memberRef, { status: newStatus });
      fetchMembers();
    } catch (error) {
      console.error("Error updating status", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      try {
        await deleteDoc(doc(db, 'team_members', id));
        fetchMembers();
      } catch (error) {
        console.error("Error deleting member", error);
      }
    }
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({
      name: member.name || '',
      role: member.role || '',
      dob: member.dob || '',
      phone: member.phone || '',
      profilePicUrl: member.profilePicUrl || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || updating) return;
    setUpdating(true);

    try {
      const memberRef = doc(db, 'team_members', editingMember.id);
      await updateDoc(memberRef, {
        name: editForm.name,
        role: editForm.role,
        dob: editForm.dob,
        phone: editForm.phone,
        profilePicUrl: editForm.profilePicUrl
      });
      setShowEditModal(false);
      fetchMembers();
    } catch (error) {
      console.error("Error updating member:", error);
      alert("Failed to update member.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Team Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your developers and their access levels.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Team Member
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Name</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Email</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Role</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading team members...</td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No team members found. Click 'Add Team Member' to create one.</td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                      {member.profilePicUrl ? (
                        <img src={member.profilePicUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {member.name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{member.email}</td>
                    <td className="px-6 py-4 text-muted-foreground">{member.role}</td>
                    <td className="px-6 py-4 text-right space-x-1">
                      
                      <button onClick={() => openEditModal(member)} className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-md transition-colors" title="Edit Profile">
                        <Pencil className="w-4 h-4" />
                      </button>

                      <Link href={`/founder/team/${encodeURIComponent(member.email)}`}>
                        <button className="text-blue-600 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded-md transition-colors" title="View Progress">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>

                      <button onClick={() => handleDelete(member.id)} className="text-muted-foreground hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Add Team Member</h2>
              
              <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex gap-3 text-green-800">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
                <p className="text-xs">
                  This will securely create their authentication account in Firebase and add them to your dashboard in one step!
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Alex Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="alex@flyggo.in" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="Developer">Developer</option>
                    <option value="Designer">Designer</option>
                    <option value="Telecaller">Telecaller</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={creating} className="flex-1 bg-foreground text-background hover:opacity-90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex justify-center items-center gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEditModal && editingMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Edit Profile: {editingMember.email}</h2>

              <form onSubmit={handleUpdateMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Profile Picture</label>
                  <div className="flex items-center gap-4">
                    {editForm.profilePicUrl ? (
                      <img src={editForm.profilePicUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground text-xs">
                        None
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 disabled:opacity-50" 
                    />
                  </div>
                  {uploadingImage && <p className="text-xs text-blue-500 mt-2">Uploading image...</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="Developer">Developer</option>
                    <option value="Designer">Designer</option>
                    <option value="Telecaller">Telecaller</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date of Birth</label>
                  <input type="date" value={editForm.dob} onChange={e => setEditForm({...editForm, dob: e.target.value})} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number</label>
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+1..." />
                </div>
                
                <div className="pt-2">
                  <button 
                    type="button" 
                    onClick={async () => {
                      if (!editingMember?.email) return;
                      try {
                        const { sendPasswordResetEmail } = await import('firebase/auth');
                        await sendPasswordResetEmail(auth, editingMember.email);
                        alert(`Password reset email has been sent to ${editingMember.email}.`);
                      } catch (error: any) {
                        alert(`Failed to send password reset email: ${error.message}`);
                      }
                    }}
                    className="w-full bg-secondary text-foreground hover:bg-secondary/80 border border-border px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Send Password Reset Email
                  </button>
                  <p className="text-xs text-muted-foreground mt-1.5 text-center">
                    Sends a secure link to allow this user to change their password.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={updating} className="flex-1 bg-foreground text-background hover:opacity-90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex justify-center items-center gap-2">
                    {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {updating ? 'Saving...' : 'Save Profile'}
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
