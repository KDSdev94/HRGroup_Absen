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
import { Trash2, Mail, User, Search, AlertTriangle } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
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

export default function DataCleanup() {
  const [cleanupUsers, setCleanupUsers] = useState<CleanupUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredUsers = cleanupUsers.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.division?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Pembersihan Data
        </h1>
        <p className="text-gray-500 mt-2">
          Kelola dan hapus akun user yang terdaftar dengan Google tetapi tidak
          memiliki data lengkap (nama/divisi).
        </p>
      </div>

      {/* Warning Alert */}
      {cleanupUsers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              Ditemukan {cleanupUsers.length} akun tidak lengkap
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Akun-akun ini terdaftar dengan Google tetapi tidak memiliki data
              divisi atau nama lengkap. Disarankan untuk menghapus akun ini agar
              database tetap bersih.
            </p>
          </div>
        </div>
      )}

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
        {cleanupUsers.length > 0 && (
          <Button
            onClick={handleBulkDelete}
            variant="destructive"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Semua ({cleanupUsers.length})
          </Button>
        )}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Data User Tidak Lengkap ({filteredUsers.length})
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
    </div>
  );
}
