import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABsfBZk0PRDZID91c1vZPHWr6lIeysQ3c",
  authDomain: "flyggo-internel-portal-3882a.firebaseapp.com",
  projectId: "flyggo-internel-portal-3882a",
  storageBucket: "flyggo-internel-portal-3882a.firebasestorage.app",
  messagingSenderId: "829227424305",
  appId: "1:829227424305:web:655bb4e7d49bb46458d310",
  measurementId: "G-ES6SDSXPKB"
};

// Initialize Firebase (check if already initialized to avoid Next.js dev server errors)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Analytics only in the browser (it will crash during SSR if not checked)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((yes) => yes ? (analytics = getAnalytics(app)) : null);
}

export { app, analytics, auth, db, firebaseConfig };
