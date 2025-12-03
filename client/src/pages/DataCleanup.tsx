import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Mail, User, Search, AlertTriangle, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { formatDateTable } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

interface CleanupUser {
  id: string;
  uid: string;
  email: string;
  employeeId?: string;
  role: string;
  createdAt: any;
  // Employee data
  name?: string;
  division?: string;
}

interface DataInconsistency {
  type: "orphaned_auth" | "orphaned_firestore" | "missing_employee_ref";
  uid: string;
  email?: string;
  employeeId?: string;
  details: string;
}

export default function DataCleanup() {
  const [cleanupUsers, setCleanupUsers] = useState<CleanupUser[]>([]);
  const [inconsistencies, setInconsistencies] = useState<DataInconsistency[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningData, setScanningData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"incomplete" | "inconsistencies">("incomplete");
  const { toast } = useToast();

  useEffect(() => {
    fetchCleanupUsers();
  }, []);

  const fetchCleanupUsers = async () => {
    try {
      setLoading(true);
      // Query users collection where role is "employee"
      const q = query(collection(db, "users"), where("role", "==", "employee"));
      const querySnapshot = await getDocs(q);

      const usersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        uid: doc.id,
        ...doc.data(),
      })) as CleanupUser[];

      console.log("🔍 All employee users:", usersData);

      // Filter users that DON'T have name or division
      // These are users who registered with Google but didn't select division/name
      const incompleteUsers = usersData.filter((user) => {
        const hasNoName = !user.name || user.name === "";
        const hasNoDivision = !user.division || user.division === "";
        const hasNoEmployeeId = !user.employeeId || user.employeeId === "";

        // User is incomplete if they lack name, division, or employeeId
        return hasNoName || hasNoDivision || hasNoEmployeeId;
      });

      console.log("🗑️ Incomplete users (cleanup needed):", incompleteUsers);

      setCleanupUsers(incompleteUsers);
    } catch (error) {
      console.error("Error fetching cleanup users:", error);
      toast({
        title: "Error",
        description: "Gagal memuat daftar user yang perlu dibersihkan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus akun ${email}?\n\nAkun ini tidak memiliki data lengkap (nama/divisi) dan akan dihapus permanen.`
      )
    )
      return;

    try {
      // Delete from Firestore users collection
      await deleteDoc(doc(db, "users", userId));

      toast({
        title: "Berhasil",
        description: `Akun ${email} berhasil dihapus dari sistem.`,
      });

      fetchCleanupUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Gagal menghapus akun user",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (cleanupUsers.length === 0) {
      toast({
        title: "Info",
        description: "Tidak ada data yang perlu dibersihkan",
      });
      return;
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus SEMUA ${cleanupUsers.length} akun yang tidak lengkap?\n\nTindakan ini tidak dapat dibatalkan!`
      )
    )
      return;

    try {
      setLoading(true);

      // Delete all incomplete users
      const deletePromises = cleanupUsers.map((user) =>
        deleteDoc(doc(db, "users", user.id))
      );

      await Promise.all(deletePromises);

      toast({
        title: "Berhasil",
        description: `${cleanupUsers.length} akun berhasil dihapus dari sistem.`,
      });

      fetchCleanupUsers();
    } catch (error) {
      console.error("Error bulk deleting users:", error);
      toast({
        title: "Error",
        description: "Gagal menghapus beberapa akun user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // SCAN DATA INCONSISTENCIES
  const scanDataInconsistencies = async () => {
    try {
      setScanningData(true);
      console.log("🔍 Starting data consistency scan...");
      
      const issues: DataInconsistency[] = [];

      // Get all users from Firestore
      const usersSnapshot = await getDocs(collection(db, "users"));
      const allUsers = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (CleanupUser & { uid?: string })[];

      // Get all employees from Firestore
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const allEmployees = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      console.log("📊 Total users:", allUsers.length);
      console.log("📊 Total employees:", allEmployees.length);

      // Check 1: Users with missing employee references
      for (const user of allUsers) {
        if (user.employeeId) {
          const employeeExists = allEmployees.some(
            (emp) => emp.id === user.employeeId
          );
          
          if (!employeeExists) {
            issues.push({
              type: "missing_employee_ref",
              uid: user.id,
              email: user.email,
              employeeId: user.employeeId,
              details: `User "${user.email}" referensi ke employee ID "${user.employeeId}" yang tidak ada di database`,
            });
          }
        }
      }

      // Check 2: Employees with orphaned user references
      for (const employee of allEmployees) {
        if (employee.uid) {
          const userExists = allUsers.some((user) => user.id === employee.uid);
          
          if (!userExists) {
            issues.push({
              type: "orphaned_auth",
              uid: employee.uid,
              email: employee.email,
              employeeId: employee.id,
              details: `Employee "${employee.name}" punya referensi UID "${employee.uid}" tetapi user tidak ada di database`,
            });
          }
        }
      }

      console.log("🔍 Data inconsistencies found:", issues.length);
      console.log("📋 Issues:", issues);

      setInconsistencies(issues);

      toast({
        title: "Scan Selesai",
        description: `Ditemukan ${issues.length} masalah data yang perlu diperbaiki`,
      });
    } catch (error) {
      console.error("Error scanning data:", error);
      toast({
        title: "Error",
        description: "Gagal melakukan scan data",
        variant: "destructive",
      });
    } finally {
      setScanningData(false);
    }
  };

  // FIX INCONSISTENCIES
  const fixInconsistency = async (issue: DataInconsistency) => {
    try {
      if (issue.type === "missing_employee_ref") {
        // Delete user with missing employee reference
        await deleteDoc(doc(db, "users", issue.uid));
        toast({
          title: "Berhasil",
          description: `User "${issue.email}" dihapus karena employee reference tidak valid`,
        });
      } else if (issue.type === "orphaned_auth") {
        // Remove UID reference from employee
        if (issue.employeeId) {
          await updateDoc(doc(db, "employees", issue.employeeId), {
            uid: null,
            email: null,
            isActive: false,
          });
          toast({
            title: "Berhasil",
            description: `Reference UID dihapus dari employee "${issue.employeeId}"`,
          });
        }
      }
      
      // Rescan after fix
      await scanDataInconsistencies();
    } catch (error) {
      console.error("Error fixing inconsistency:", error);
      toast({
        title: "Error",
        description: "Gagal memperbaiki masalah data",
        variant: "destructive",
      });
    }
  };

  // FIX ALL INCONSISTENCIES
  const fixAllInconsistencies = async () => {
    if (inconsistencies.length === 0) {
      toast({
        title: "Info",
        description: "Tidak ada masalah data yang perlu diperbaiki",
      });
      return;
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin memperbaiki SEMUA ${inconsistencies.length} masalah data?\n\nTindakan ini tidak dapat dibatalkan!`
      )
    )
      return;

    try {
      setScanningData(true);

      for (const issue of inconsistencies) {
        if (issue.type === "missing_employee_ref") {
          await deleteDoc(doc(db, "users", issue.uid));
        } else if (issue.type === "orphaned_auth") {
          if (issue.employeeId) {
            await updateDoc(doc(db, "employees", issue.employeeId), {
              uid: null,
              email: null,
              isActive: false,
            });
          }
        }
      }

      toast({
        title: "Berhasil",
        description: `${inconsistencies.length} masalah data berhasil diperbaiki`,
      });

      // Rescan
      await scanDataInconsistencies();
    } catch (error) {
      console.error("Error fixing all inconsistencies:", error);
      toast({
        title: "Error",
        description: "Gagal memperbaiki masalah data",
        variant: "destructive",
      });
    } finally {
      setScanningData(false);
    }
  };

  const filteredUsers = cleanupUsers.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.division?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const filteredInconsistencies = inconsistencies.filter((issue) => {
    const matchesSearch =
      issue.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.details?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });



  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Pembersihan Data
        </h1>
        <p className="text-gray-500 mt-2">
          Kelola dan perbaiki akun user yang tidak lengkap atau data yang tidak konsisten di database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("incomplete")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "incomplete"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Akun Tidak Lengkap ({cleanupUsers.length})
        </button>
        <button
          onClick={() => setActiveTab("inconsistencies")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "inconsistencies"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Masalah Data ({inconsistencies.length})
        </button>
      </div>

      {/* Search and Bulk Action Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari berdasarkan email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Tab-specific actions */}
        {activeTab === "incomplete" && cleanupUsers.length > 0 && (
          <Button
            onClick={handleBulkDelete}
            variant="destructive"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Semua ({cleanupUsers.length})
          </Button>
        )}
        
        {activeTab === "inconsistencies" && (
          <>
            <Button
              onClick={scanDataInconsistencies}
              disabled={scanningData}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${scanningData ? "animate-spin" : ""}`} />
              {scanningData ? "Scanning..." : "Scan Data"}
            </Button>
            {inconsistencies.length > 0 && (
              <Button
                onClick={fixAllInconsistencies}
                disabled={scanningData}
                variant="default"
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Perbaiki Semua ({inconsistencies.length})
              </Button>
            )}
          </>
        )}
      </div>

      {/* TAB 1: INCOMPLETE USERS */}
      {activeTab === "incomplete" && (
        <Card>
          <CardHeader>
            <CardTitle>
              Akun Tidak Lengkap ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat daftar user...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-lg">
                Database Bersih!
              </p>
              <p className="text-gray-500 mt-1">
                {cleanupUsers.length === 0
                  ? "Tidak ada user yang perlu dibersihkan."
                  : "Tidak ada user yang cocok dengan pencarian."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead>ID Peserta</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          {user.name || (
                            <span className="text-red-500 italic">
                              Tidak ada
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.division || (
                          <span className="text-red-500 italic">Tidak ada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.employeeId ? (
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {user.employeeId}
                          </span>
                        ) : (
                          <span className="text-red-500 italic">Tidak ada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDateTable(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* TAB 2: DATA INCONSISTENCIES */}
      {activeTab === "inconsistencies" && (
        <Card>
          <CardHeader>
            <CardTitle>
              Masalah Data ({filteredInconsistencies.length})
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">
              {inconsistencies.length === 0
                ? "Belum ada scan data. Klik 'Scan Data' untuk memulai."
                : "Ditemukan masalah data yang perlu diperbaiki."}
            </p>
          </CardHeader>
          <CardContent>
            {scanningData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Scanning data...</p>
              </div>
            ) : filteredInconsistencies.length === 0 ? (
              <div className="text-center py-8">
                {inconsistencies.length === 0 ? (
                  <>
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-900 dark:text-white font-semibold text-lg">
                      Belum ada scan
                    </p>
                    <p className="text-gray-500 mt-1">
                      Klik tombol "Scan Data" di atas untuk memulai pemeriksaan data.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-gray-900 dark:text-white font-semibold text-lg">
                      Database Konsisten!
                    </p>
                    <p className="text-gray-500 mt-1">
                      Tidak ada masalah data yang ditemukan.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInconsistencies.map((issue, index) => (
                  <div
                    key={index}
                    className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-semibold text-amber-900 dark:text-amber-200">
                            {issue.type === "missing_employee_ref"
                              ? "User tanpa Employee Reference"
                              : "Orphaned Auth Reference"}
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          {issue.details}
                        </p>
                        {issue.email && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-mono">
                            Email: {issue.email}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => fixInconsistency(issue)}
                        disabled={scanningData}
                        size="sm"
                        variant="outline"
                        className="ml-4"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Perbaiki
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
