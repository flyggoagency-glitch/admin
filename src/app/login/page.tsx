"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ChevronRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      // Routing logic
      if (email === 'founder@flyggo.in' || email === 'founder@flyggo.com') {
        router.push('/founder/dashboard');
      } else {
        try {
          const q = query(collection(db, 'team_members'), where("email", "==", email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const memberData = querySnapshot.docs[0].data();
            const role = memberData.role?.toLowerCase() || 'developer';
            
            if (role === 'telecaller') {
              router.push('/telecaller/dashboard');
            } else {
              router.push('/developer/dashboard');
            }
          } else {
            await signOut(auth);
            setError('kindly contact team');
          }
        } catch (dbError) {
          console.error("Error fetching user role:", dbError);
          await signOut(auth);
          setError('kindly contact team');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Error: Email/Password sign-in is not enabled in your Firebase Console.');
      } else if (err.code === 'auth/too-many-requests' || err.code === 'auth/network-request-failed') {
        setError('Error ! Contact Support');
      } else {
        const errMsg = err.message || '';
        if (errMsg.toLowerCase().includes('database is closing') || errMsg.toLowerCase().includes('hidden')) {
          setError('Error! Contact Team');
        } else {
          setError(`Error: ${errMsg || 'Failed to sign in'}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Video */}
      <video 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
        autoPlay 
        muted 
        loop 
        playsInline
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
          type="video/mp4"
        />
      </video>

      <div className="bg-card border border-border w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1 tracking-tight">Flyggo Administration</h1>
          <p className="text-muted-foreground text-sm">Welcome Back Flyggans....</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 ml-0.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="you@flyggo.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 ml-0.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-foreground hover:opacity-90 disabled:opacity-70 text-background font-semibold py-2.5 rounded-lg transition-opacity flex items-center justify-center space-x-2 mt-4"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
