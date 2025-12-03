import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  division: string;
  uid?: string;
  email?: string;
}

interface User {
  id: string;
  employeeId: string;
  email: string;
  role: string;
}

export default function DataCleanup() {
  const [loading, setLoading] = useState(false);
  const [orphanedEmployees, setOrphanedEmployees] = useState<Employee[]>([]);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const scanForOrphans = async () => {
    setScanning(true);
    try {
      // Get all employees
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const employees = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];

      // Get all users with role employee
      const usersQuery = query(
        collection(db, "users"),
        where("role", "==", "employee")
      );
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];

      // Find employees with uid/email but no corresponding user
      const orphans = employees.filter((emp) => {
        if (!emp.uid && !emp.email) return false; // Not registered, skip

        // Check if user exists
        const userExists = users.some(
          (user) => user.id === emp.uid || user.employeeId === emp.id
        );

        return !userExists; // Orphan if user doesn't exist
      });

      setOrphanedEmployees(orphans);

      toast({
        title: "Scan Selesai",
        description: `Ditemukan ${orphans.length} karyawan dengan data tidak valid.`,
      });
    } catch (error) {
      console.error("Error scanning:", error);
      toast({
        title: "Error",
        description: "Gagal melakukan scan data",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const cleanupOrphans = async () => {
    if (orphanedEmployees.length === 0) {
      toast({
        title: "Tidak Ada Data",
        description: "Tidak ada data yang perlu dibersihkan.",
      });
      return;
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin membersihkan ${orphanedEmployees.length} data karyawan?\n\nIni akan menghapus uid dan email dari karyawan yang tidak memiliki akun user.`
      )
    )
      return;

    setLoading(true);
    try {
      let cleaned = 0;

      for (const emp of orphanedEmployees) {
        const employeeRef = doc(db, "employees", emp.id);
        await updateDoc(employeeRef, {
          uid: null,
          email: null,
          isActive: false,
          lastLogin: null,
        });
        cleaned++;
      }

      toast({
        title: "Berhasil",
        description: `${cleaned} data karyawan berhasil dibersihkan.`,
      });

      setOrphanedEmployees([]);
    } catch (error) {
      console.error("Error cleaning up:", error);
      toast({
        title: "Error",
        description: "Gagal membersihkan data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Pembersihan Data
        </h1>
        <p className="text-gray-500 mt-2">
          Tool untuk membersihkan data karyawan yang tidak valid (memiliki
          uid/email tapi tidak ada user account).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Data Karyawan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan akan mencari karyawan yang memiliki field{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
              uid
            </code>{" "}
            atau{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
              email
            </code>{" "}
            tapi tidak memiliki akun user di sistem.
          </p>

          <Button
            onClick={scanForOrphans}
            disabled={scanning}
            className="gap-2"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Scan Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {orphanedEmployees.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Data Tidak Valid Ditemukan ({orphanedEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                Karyawan berikut memiliki uid/email tapi tidak ada akun user:
              </p>
              <ul className="space-y-2">
                {orphanedEmployees.map((emp) => (
                  <li
                    key={emp.id}
                    className="text-sm bg-white dark:bg-gray-800 p-3 rounded border border-orange-100 dark:border-orange-900"
                  >
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {emp.id} | Divisi: {emp.division}
                      {emp.email && ` | Email: ${emp.email}`}
                      {emp.uid && ` | UID: ${emp.uid}`}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={cleanupOrphans}
              disabled={loading}
              variant="destructive"
              className="gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Membersihkan...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Bersihkan Data ({orphanedEmployees.length})
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {!scanning && orphanedEmployees.length === 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="py-8">
            <div className="text-center text-green-600 dark:text-green-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-3" />
              <p className="font-medium">Data Bersih</p>
              <p className="text-sm text-gray-500 mt-1">
                Tidak ada data karyawan yang tidak valid.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
