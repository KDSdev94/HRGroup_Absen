import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixUserProfiles() {
  console.log("🔧 Starting user profile fix...\n");

  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, "users"));
    console.log(`📊 Found ${usersSnapshot.size} user documents\n`);

    // Get all employees to map UID to Employee ID
    const employeesSnapshot = await getDocs(collection(db, "employees"));
    const employeeMap = new Map<string, string>(); // uid -> employeeId

    employeesSnapshot.docs.forEach((empDoc) => {
      const data = empDoc.data();
      if (data.uid) {
        employeeMap.set(data.uid, empDoc.id);
      }
    });

    console.log(`📋 Employee map created with ${employeeMap.size} entries\n`);

    let fixed = 0;
    let alreadyGood = 0;
    let notFound = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const email = userData.email || "unknown";

      // Check if employeeId already exists and is valid
      if (userData.employeeId) {
        console.log(
          `✅ ${email} - already has employeeId: ${userData.employeeId}`
        );
        alreadyGood++;
        continue;
      }

      // Try to find employeeId from UID
      const employeeId = employeeMap.get(userId);

      if (employeeId) {
        console.log(`🔄 Fixing ${email} - adding employeeId: ${employeeId}`);

        await updateDoc(doc(db, "users", userId), {
          employeeId: employeeId,
        });

        fixed++;
        console.log(`✅ Fixed!\n`);
      } else {
        console.log(`⚠️  ${email} - No matching employee found`);
        notFound++;
      }
    }

    console.log("\n📊 Summary:");
    console.log(`✅ Already good: ${alreadyGood}`);
    console.log(`🔄 Fixed: ${fixed}`);
    console.log(`⚠️  Not found: ${notFound}`);
    console.log(`\n✅ User profile fix completed!`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing user profiles:", error);
    process.exit(1);
  }
}

fixUserProfiles();
