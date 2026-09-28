"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword } from 'firebase/auth';
import { User, Shield, Mail, Phone, Calendar, Save, Loader2, Camera, Bell } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: 'Developer',
    dob: '',
    email: '',
    phone: '',
    profilePicUrl: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserUid(user.uid);
        try {
          const q = query(collection(db, 'team_members'), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            setFormData(prev => ({
              ...prev,
              name: data.name || '',
              role: data.role || 'Developer',
              dob: data.dob || '',
              email: user.email || data.email || '',
              phone: data.phone || '',
              profilePicUrl: data.profilePicUrl || ''
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              email: user.email || ''
            }));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newPassword) return;

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    
    setSaving(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert('Password successfully updated! Please log in again with your new password.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      await auth.signOut();
      window.location.href = '/login';
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, please log out and log back in before changing your password. You will be signed out now.");
        await auth.signOut();
        window.location.href = '/login';
      } else {
        console.error("Error updating password:", error);
        alert(`Failed to update password: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">My Profile</h1>
        <p className="text-muted-foreground">View your personal profile. <strong className="text-foreground">Only the Founder can edit this information.</strong></p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8">
          
          {/* Profile Picture Section */}
          <div className="flex items-center gap-6 mb-10 pb-8 border-b border-border">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden">
                {formData.profilePicUrl ? (
                  <img src={formData.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Profile Picture</h3>
              <p className="text-sm text-muted-foreground">To update your avatar, please contact the Founder.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Personal Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-muted-foreground" />
                Personal Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  disabled
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-muted-foreground cursor-not-allowed"
                  placeholder="Not set"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <input 
                  type="text" 
                  value={formData.role}
                  disabled
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="date" 
                    value={formData.dob}
                    disabled
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Contact & Security */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-muted-foreground" />
                Contact Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  Mail ID (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    value={formData.email}
                    disabled
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    disabled
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-muted-foreground cursor-not-allowed"
                    placeholder="Not set"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  Chat Notification Tone
                </label>
                <select 
                  value={localStorage.getItem('notificationTone') || '/tones/tone1.wav'}
                  onChange={(e) => {
                    localStorage.setItem('notificationTone', e.target.value);
                    const audio = new Audio(e.target.value);
                    audio.play().catch(() => { /* safely ignore */ });
                    // Force re-render to update select value visually
                    setFormData({...formData}); 
                  }}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                  <option value="/tones/tone1.wav">Tone 1 (Standard Pop)</option>
                  <option value="/tones/tone2.wav">Tone 2 (Double Chime)</option>
                  <option value="/tones/tone3.wav">Tone 3 (Soft Pluck)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">Select a sound for incoming chat messages.</p>
              </div>

              <div className="pt-4 border-t border-border">
                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border"
                  >
                    Change Password
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Enter new password..."
                          required
                          minLength={8}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Re-enter Password</label>
                        <input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          placeholder="Confirm new password..."
                          required
                          minLength={8}
                        />
                      </div>
                    </div>
                    <form onSubmit={handlePasswordUpdate} className="flex gap-3">
                      <button
                        type="submit"
                        disabled={saving || !newPassword || !confirmPassword}
                        className="flex items-center justify-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="flex items-center justify-center bg-secondary text-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-secondary/80 transition-colors border border-border"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
