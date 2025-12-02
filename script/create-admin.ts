import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Load Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdminUser() {
  const adminEmail = "admin@hrgroup.com";
  const adminPassword = "Admin123!"; // Change this to a secure password

  try {
    console.log("🔄 Creating admin user...");

    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      adminEmail,
      adminPassword
    );

    const user = userCredential.user;
    console.log("✅ Admin user created successfully!");
    console.log("📧 Email:", adminEmail);
    console.log("🔑 Password:", adminPassword);
    console.log("🆔 User ID:", user.uid);

    // Optional: Add admin profile to Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: adminEmail,
        role: "superadmin",
        displayName: "Admin HR Group",
        createdAt: new Date().toISOString(),
      });
      console.log("✅ Admin profile added to Firestore!");
    } catch (firestoreError: any) {
      console.log("⚠️  Could not add to Firestore:", firestoreError.message);
      console.log("   (This is okay if Firestore is not set up yet)");
    }

    console.log("\n🎉 Setup complete! You can now login with:");
    console.log("   Email:", adminEmail);
    console.log("   Password:", adminPassword);
    console.log("\n⚠️  IMPORTANT: Change the password after first login!");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error creating admin user:");

    if (error.code === "auth/email-already-in-use") {
      console.log("✅ Admin user already exists!");
      console.log("📧 Email:", adminEmail);
      console.log("🔑 Password:", adminPassword);
      console.log("\nYou can login with these credentials.");
    } else if (error.code === "auth/operation-not-allowed") {
      console.log(
        "❌ Email/Password authentication is not enabled in Firebase Console."
      );
      console.log("\n📝 To fix this:");
      console.log("1. Go to https://console.firebase.google.com/");
      console.log("2. Select your project: absensi-app-b623f");
      console.log("3. Go to Authentication > Sign-in method");
      console.log("4. Enable 'Email/Password' provider");
      console.log("5. Run this script again");
    } else {
      console.log(error.message);
    }

    process.exit(1);
  }
}

createAdminUser();
