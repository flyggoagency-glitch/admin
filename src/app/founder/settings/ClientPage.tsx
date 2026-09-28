"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, query, collection, getDocs, deleteDoc, collectionGroup } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { User, Shield, Mail, Phone, Calendar, Save, Loader2, Camera, Bell, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [originalAccountsPin, setOriginalAccountsPin] = useState('8989');

  const [formData, setFormData] = useState({
    name: '',
    role: 'Founder',
    dob: '',
    email: '',
    phone: '',
    password: '', // New password input
    profilePicUrl: '',
    accountsPin: '8989', // Default PIN
    currentPassword: '' // For verifying PIN changes
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', 'website');

      const response = await fetch(`https://api.cloudinary.com/v1_1/iufxukbz/image/upload`, {
        method: 'POST',
        body: uploadData,
      });

      const data = await response.json();
      if (data.secure_url) {
        setFormData(prev => ({ ...prev, profilePicUrl: data.secure_url }));
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserUid(user.uid);
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            const fetchedPin = data.accountsPin || '8989';
            setOriginalAccountsPin(fetchedPin);
            setFormData(prev => ({
              ...prev,
              name: data.name || '',
              role: data.role || 'Founder',
              dob: data.dob || '',
              email: user.email || data.email || '',
              phone: data.phone || '',
              profilePicUrl: data.profilePicUrl || '',
              accountsPin: fetchedPin
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

  const handleClearData = async () => {
    const confirmation = window.prompt("WARNING: This will permanently delete ALL Projects, Leads, Team Messages, Attendance records, and Account Ledgers.\n\nType 'DELETE ALL' to confirm.");
    if (confirmation !== 'DELETE ALL') return;
    
    setClearingData(true);
    try {
      const clearCollection = async (collName: string) => {
        const q = query(collection(db, collName));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      };

      const clearCollectionGroup = async (groupName: string) => {
        const q = query(collectionGroup(db, groupName));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      };

      await clearCollection('projects');
      await clearCollection('leads');
      await clearCollection('team_messages');
      await clearCollectionGroup('attendance');
      
      // Clear accounts_ledger for the current founder
      if (auth.currentUser) {
        const q = query(collection(db, 'users', auth.currentUser.uid, 'accounts_ledger'));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }

      alert("All operational workspace data has been successfully cleared.");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Error clearing data. See console for details.");
    } finally {
      setClearingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid || !auth.currentUser) return;
    setSaving(true);
    
    try {
      // If they are changing the accounts PIN, verify their current login password
      if (formData.accountsPin !== originalAccountsPin) {
        if (!formData.currentPassword) {
          alert("Please enter your current login password in the 'Current Password' field to authorize changing your Accounts PIN.");
          setSaving(false);
          return;
        }
        
        try {
          const credential = EmailAuthProvider.credential(auth.currentUser.email!, formData.currentPassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (error) {
          alert("Incorrect current password. Cannot authorize PIN change.");
          setSaving(false);
          return;
        }
      }

      // 1. Save profile to Firestore
      const docRef = doc(db, 'users', userUid);
      
      const { password, currentPassword, ...dataToSave } = formData;
      await setDoc(docRef, dataToSave, { merge: true });

      // Update the known original PIN on success
      setOriginalAccountsPin(formData.accountsPin);

      // 2. Update password if provided
      if (password) {
        await updatePassword(auth.currentUser, password);
        alert('Profile, PIN, and password updated successfully! Please log in again with your new password.');
        setFormData(prev => ({ ...prev, password: '', currentPassword: '' }));
        await auth.signOut();
        window.location.href = '/login';
      } else {
        alert('Profile updated successfully!');
        setFormData(prev => ({ ...prev, currentPassword: '' }));
      }

    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, please log out and log back in before changing your password. You will be signed out now.");
        await auth.signOut();
        window.location.href = '/login';
      } else {
        console.error("Error updating profile:", error);
        alert(`Error updating profile: ${error.message}`);
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your personal profile and account security.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleSave} className="p-8">
          
          {/* Profile Picture Section */}
          <div className="flex items-center gap-6 mb-10 pb-8 border-b border-border">
            <label className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden">
                {formData.profilePicUrl ? (
                  <img src={formData.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingImage ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Profile Picture</h3>
              <p className="text-sm text-muted-foreground mb-3">Click the avatar to upload a new image. Recommended size: 256x256px.</p>
              {uploadingImage && <p className="text-xs text-blue-500 font-medium">Uploading image to Cloudinary...</p>}
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
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <input 
                  type="text" 
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
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
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Contact & Security */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-muted-foreground" />
                Contact & Security
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  Mail ID (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
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
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    placeholder="+1 (555) 000-0000"
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
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Accounts Section PIN
                </label>
                <input 
                  type="password" 
                  name="accountsPin"
                  value={formData.accountsPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData({ ...formData, accountsPin: val });
                  }}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all tracking-[0.5em] font-mono"
                  placeholder="****"
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground mt-1.5">A 4-digit PIN required to access the Accounts section.</p>
              </div>

              {formData.accountsPin !== originalAccountsPin && (
                <div className="pt-4 border-t border-border bg-red-50/50 p-4 rounded-lg border border-red-100">
                  <label className="block text-sm font-medium text-red-900 mb-1.5">
                    Current Password (Required for PIN change)
                  </label>
                  <input 
                    type="password" 
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    className="w-full bg-background border border-red-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    placeholder="Enter your login password..."
                  />
                  <p className="text-xs text-red-600 mt-1.5">You must verify your identity to change the Accounts PIN.</p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1.5">Change Login Password</label>
                <input 
                  type="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  placeholder="Enter new password to change..."
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1.5">Leave blank to keep your current password. Minimum 8 characters.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-xl font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>

        </form>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm overflow-hidden mt-8">
        <div className="p-8">
          <h2 className="text-xl font-bold text-red-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>
          <p className="text-red-700/80 mb-6 text-sm">
            Permanently clear all operational data from your workspace. This includes all Projects, Leads, Chat Messages, Attendance records, and Ledger entries. <strong>Your founder profile, team members, and holidays will remain intact.</strong> This action cannot be undone.
          </p>
          
          <button
            type="button"
            onClick={handleClearData}
            disabled={clearingData}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {clearingData ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {clearingData ? "Clearing Workspace Data..." : "Clear All Workspace Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
