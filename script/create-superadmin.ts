import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createSuperAdminUser() {
  const superAdminEmail = "superadmin@hrgroup.com";
  const superAdminPassword = "SuperAdmin@2025!"; // Strong password untuk superadmin

  try {
    console.log("🔄 Creating superadmin user...");

    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      superAdminEmail,
      superAdminPassword
    );

    const user = userCredential.user;
    console.log("✅ Superadmin user created successfully!");
    console.log("📧 Email:", superAdminEmail);
    console.log("🔑 Password:", superAdminPassword);
    console.log("🆔 User ID:", user.uid);

    // Add superadmin profile to Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: superAdminEmail,
        role: "superadmin",
        displayName: "Super Admin HR Group",
        createdAt: new Date().toISOString(),
      });
      console.log("✅ Superadmin profile added to Firestore!");
    } catch (firestoreError: any) {
      console.log("⚠️  Could not add to Firestore:", firestoreError.message);
      console.log("   (This is okay if Firestore is not set up yet)");
    }

    console.log("\n🎉 Setup complete! Superadmin account created:");
    console.log("   Email:", superAdminEmail);
    console.log("   Password:", superAdminPassword);
    console.log("   Role: superadmin");
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - Save these credentials securely");
    console.log("   - Change password after first login");
    console.log("   - Do not share with anyone");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error creating superadmin user:");

    if (error.code === "auth/email-already-in-use") {
      console.log("✅ Superadmin user already exists!");
      console.log("📧 Email:", superAdminEmail);
      console.log("🔑 Password:", superAdminPassword);
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

createSuperAdminUser();
