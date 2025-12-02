import { initializeApp } from "firebase/app";
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
const db = getFirestore(app);

const employees = [
  { id: "DAK1", name: "Sephi Aulia Fakhri" },
  { id: "DAK2", name: "Nawang Wulan Cahya Ningrum" },
  { id: "DAK3", name: "Lina Khoeruni'mah" },
  { id: "DAK4", name: "Nida Azkiya Putri" },
  { id: "DAK5", name: "Puji Indah Rahayu" },
  { id: "DAK6", name: "Armita Hasna Salsabila" },
  { id: "DT1", name: "Zahra Anggreina Pramesti" },
  { id: "DT2", name: "Syauqia Azminun Nisa" },
  { id: "DT3", name: "Nadia Izatul Aqidah" },
  { id: "DT4", name: "Indah Kurniawati Salongan" },
  { id: "DH1", name: "Aurraegita" },
  { id: "DH2", name: "Anief Khaefatun Nisa" },
  { id: "DL1", name: "Abibita Hamdal" },
  { id: "DL2", name: "Siti Iqsobayani Putri Yuliani" },
  { id: "DL3", name: "Ira Nurul Latifah" },
  { id: "DDG1", name: "Kurniawan Dwi Saputra" },
  { id: "DDG2", name: "Amalia Nur Islami" },
  { id: "DDG3", name: "Khurotul Nisa" },
  { id: "DMS1", name: "Nindy Putri Ardiyati" },
  { id: "DMS2", name: "Jesica Haevelty" },
  { id: "DMS3", name: "Maulana Rozaq Fadhila" },
  { id: "DAK7", name: "Roihanah Distya Pramesthi" },
  { id: "DAK8", name: "Istin Ghairiah" },
  { id: "DAP1", name: "Wafa Nurlaely Yuniar" },
  { id: "DAP2", name: "Tasbiatul Rizki" },
  { id: "DAP3", name: "Tiara Firdaniasih" },
  { id: "DAP4", name: "Rini Muslikha Ningrum" },
  { id: "DCC1", name: "Wafa Aulia" },
  { id: "DCC2", name: "Haya Farah Afifah" },
  { id: "DMS4", name: "Novia Ezza Setyani" },
  { id: "DMS5", name: "Windi Yani" },
  { id: "DMS6", name: "Ahmad Rizal" },
  { id: "DMS7", name: "Dimas Nurraihan" },
  { id: "DMS8", name: "Khusnul Khotimah NF" },
  { id: "DMT1", name: "Amira Nur Asyaroh" },
  { id: "DMT2", name: "Widya Ayu Utari" },
  { id: "DMT3", name: "Maylinda Rizqi Fitriani" },
  { id: "DMT4", name: "Hikmah Fitriyani" },
  { id: "DMT5", name: "Shinta Virgiana" },
  { id: "DMT6", name: "Maftukha Julianti Anis" },
  { id: "DMT7", name: "Qhordafi Akbar Diraputra Efendi" },
];

function getDivision(id: string): string {
  if (id.startsWith("DAK")) return "Akuntansi & Keuangan";
  if (id.startsWith("DT")) return "Teknik";
  if (id.startsWith("DH")) return "HRD";
  if (id.startsWith("DL")) return "Legal";
  if (id.startsWith("DDG")) return "Design Grafis";
  if (id.startsWith("DMS")) return "Marketing & Sosmed";
  if (id.startsWith("DAP")) return "Administrasi Pemberkasan";
  if (id.startsWith("DCC")) return "Content Creative";
  if (id.startsWith("DMT")) return "Marketing";
  return "General";
}

async function importEmployees() {
  console.log("🚀 Starting employee import...");

  let successCount = 0;
  let failCount = 0;

  for (const emp of employees) {
    try {
      const division = getDivision(emp.id);
      const email = `${emp.id.toLowerCase()}@hrgroup.com`; // Dummy email

      await setDoc(doc(db, "employees", emp.id), {
        employeeId: emp.id,
        name: emp.name,
        division: division,
        email: email,
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Imported: ${emp.id} - ${emp.name} (${division})`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to import ${emp.id}:`, error.message);
      failCount++;
    }
  }

  console.log("\n📊 Import Summary:");
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total: ${employees.length}`);

  process.exit(0);
}

importEmployees();
