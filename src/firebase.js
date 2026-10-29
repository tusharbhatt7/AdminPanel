import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

// Exported so admin user-creation can spin up a short-lived secondary app
// instance — creating a user on the primary app would sign the admin out.
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key_here';

const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const auth = isConfigValid ? getAuth(app) : null;
export const db = isConfigValid ? getFirestore(app) : null;
export const storage = isConfigValid ? getStorage(app) : null;

// ── Realtime Database ────────────────────────────────────────────────────────
// Driver positions are published to RTDB, not Firestore — the driver app writes
// several times a minute per driver and RTDB absorbs that far more cheaply.
//
// The URL is passed explicitly rather than left to the app config. Every other
// key here is fatal when missing and the MissingConfig screen catches it, but a
// missing VITE_FIREBASE_DATABASE_URL would fail silently and only on the live
// tracking screen — an empty map with no error. The default keeps tracking
// working; the env var still wins when it is set.
export const RTDB_URL = firebaseConfig.databaseURL || 'https://firstcabs-5ef3e-default-rtdb.firebaseio.com';
export const rtdb = isConfigValid ? getDatabase(app, RTDB_URL) : null;

// ── Callable functions ───────────────────────────────────────────────────────
// The wallet callables are deployed to asia-south1. Calling them through a
// default-region instance resolves to us-central1 and fails with
// "functions/not-found", so the region has to be named here.
export const FUNCTIONS_REGION = 'asia-south1';
export const functions = isConfigValid ? getFunctions(app, FUNCTIONS_REGION) : null;
