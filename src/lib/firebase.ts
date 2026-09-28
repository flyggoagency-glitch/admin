import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABsfBZk0PRDZID91c1vZPHWr6lIeysQ3c",
  authDomain: "flyggo-internel-portal-3882a.firebaseapp.com",
  projectId: "flyggo-internel-portal-3882a",
  storageBucket: "flyggo-internel-portal-3882a.firebasestorage.app",
  messagingSenderId: "829227424305",
  appId: "1:829227424305:web:655bb4e7d49bb46458d310",
  measurementId: "G-ES6SDSXPKB"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth: Auth | any = null;
let db: Firestore | any = null;
let analytics: any = null;

if (typeof window !== "undefined") {
  auth = getAuth(app);
  db = getFirestore(app);
  isSupported().then((yes) => yes ? (analytics = getAnalytics(app)) : null);
}

export { app, analytics, auth, db, firebaseConfig };
