import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// ⚠️ WARNING: HARDCODED CREDENTIALS - NOT SECURE!
// TODO: Move these to .env.local for production
// This is a temporary solution for development only
const firebaseConfig = {
  apiKey: "AIzaSyBDfugpjTuTfZXt7GYO-TOWpw5aQvOTdxc",
  authDomain: "absensi-app-b623f.firebaseapp.com",
  databaseURL:
    "https://absensi-app-b623f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-app-b623f",
  storageBucket: "absensi-app-b623f.firebasestorage.app",
  messagingSenderId: "784949401876",
  appId: "1:784949401876:web:c88d68ade9b53bc473ca01",
  measurementId: "G-Z1B3RMDQVD",
};

if (!firebaseConfig.apiKey) {
  console.error("❌ Firebase API Key is missing! Check your .env file.");
}

let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

try {
  // Initialize Firebase only if not already initialized
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Set persistence for better mobile compatibility
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("⚠️ Could not set auth persistence:", error);
  });

  // Use emulators in development if available
  if (import.meta.env.DEV) {
    try {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        // console.log("🏠 Running on localhost - emulators available");
        // Optionally use emulators for local development
        // connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
        // connectFirestoreEmulator(db, "localhost", 8080);
        // connectStorageEmulator(storage, "localhost", 9199);
      }
    } catch (error) {
      console.warn("⚠️ Emulator connection skipped:", error);
    }
  }
} catch (error: any) {
  console.error("❌ Firebase initialization error:", error);
  console.error("Error message:", error.message);
  console.error("Error code:", error.code);
  console.error("");
  console.error("⚠️ This might be due to:");
  console.error("  1. Invalid or restricted API key");
  console.error("  2. Domain not whitelisted in Firebase Console");
  console.error("  3. Missing Firebase services enabled");
  console.error("  4. CORS issues");
  console.error("  5. Network connectivity issues");
  console.error("");
  console.error("📋 To fix this:");
  console.error("  1. Go to Firebase Console → Project Settings → API Keys");
  console.error("  2. Click on your API key and remove domain restrictions");
  console.error("  3. Or create a new unrestricted API key");
  console.error("  4. Update VITE_FIREBASE_API_KEY in .env.local");
  console.error("  5. Restart your development server");
  console.error("  6. Clear browser cache (Ctrl+Shift+Delete)");
  console.error("  7. Check browser console for detailed error");

  // Don't throw - allow app to load with null services
  console.warn("⚠️ Firebase services may not be available");
}

export { auth, db, storage, app };
