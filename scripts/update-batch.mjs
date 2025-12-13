import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Configuration from client/src/lib/firebase.ts
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
const db = getFirestore(app);
const auth = getAuth(app);

async function updateBatch() {
  console.log("Starting batch update...");

  // Optional: Sign in if rules require it
  // You can hardcode credentials here temporarily if needed
  // await signInWithEmailAndPassword(auth, "admin@example.com", "password");

  try {
    const querySnapshot = await getDocs(collection(db, "employees"));
    console.log(`Found ${querySnapshot.size} employees.`);

    if (querySnapshot.empty) {
      console.log("No employees found.");
      return;
    }

    let updatedCount = 0;
    const updates = [];

    for (const document of querySnapshot.docs) {
      const employeeRef = doc(db, "employees", document.id);

      // Update the document
      const updatePromise = updateDoc(employeeRef, {
        batch: "Batch 2",
      })
        .then(() => {
          console.log(
            `✅ Updated ${document.data().name || document.id} to Batch 2`
          );
          updatedCount++;
        })
        .catch((err) => {
          console.error(`❌ Failed to update ${document.id}:`, err.message);
          if (err.code === "permission-denied") {
            console.error(
              "   -> Permission denied. You may need to sign in or update security rules."
            );
          }
        });

      updates.push(updatePromise);
    }

    await Promise.all(updates);
    console.log(
      `\nFinished! Successfully updated ${updatedCount} out of ${querySnapshot.size} employees.`
    );

    if (updatedCount < querySnapshot.size) {
      console.log("Some updates failed. Check the logs above.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error fetching documents:", error);
    process.exit(1);
  }
}

updateBatch();
