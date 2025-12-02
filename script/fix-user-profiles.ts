import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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
        console.log(`✅ ${email} - already has employeeId: ${userData.employeeId}`);
        alreadyGood++;
        continue;
      }

      // Try to find employeeId from UID
      const employeeId = employeeMap.get(userId);

      if (employeeId) {
        console.log(
          `🔄 Fixing ${email} - adding employeeId: ${employeeId}`
        );

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
