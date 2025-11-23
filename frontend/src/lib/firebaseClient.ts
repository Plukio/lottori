import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const firebaseConfig =
  requiredKeys.every((key) => process.env[key])
    ? {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId:
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      }
    : null;

const canUseFirebase = typeof window !== "undefined" && firebaseConfig;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function ensureFirebase() {
  if (!canUseFirebase) return { app: null, auth: null, db: null, storage: null };

  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig!);
  }

  if (!auth) {
    auth = getAuth(app);
    auth.setPersistence(browserLocalPersistence);
  }

  if (!db) {
    db = getFirestore(app);
  }

  if (!storage) {
    storage = getStorage(app);
  }

  return { app, auth, db, storage };
}

export const firebaseReady = Boolean(firebaseConfig);

