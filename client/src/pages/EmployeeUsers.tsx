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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Mail, User, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { formatDateTable } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

interface EmployeeUser {
  id: string;
  uid: string;
  email: string;
  employeeId: string;
  role: string;
  createdAt: any;
  // Employee data
  name?: string;
  division?: string;
}

export default function EmployeeUsers() {
  const [employeeUsers, setEmployeeUsers] = useState<EmployeeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("all");
  const { toast } = useToast();

  const DIVISIONS = [
    "Akuntansi & Keuangan",
    "Teknik",
    "HRD",
    "Legal",
    "Design Grafis",
    "Marketing & Sosmed",
    "Administrasi Pemberkasan",
    "Content Creative",
    "Marketing",
  ];

  useEffect(() => {
    fetchEmployeeUsers();
  }, []);

  const fetchEmployeeUsers = async () => {
    try {
      setLoading(true);
      // Query users collection where role is "employee"
      const q = query(collection(db, "users"), where("role", "==", "employee"));
      const querySnapshot = await getDocs(q);

      const usersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        uid: doc.id,
        ...doc.data(),
      })) as EmployeeUser[];

      // Fetch employee details for each user
      const enrichedData = await Promise.all(
        usersData.map(async (user) => {
          if (user.employeeId) {
            try {
              const employeeDocRef = doc(db, "employees", user.employeeId);
              const employeeDocSnap = await getDoc(employeeDocRef);

              if (employeeDocSnap.exists()) {
                const empData = employeeDocSnap.data();
                return {
                  ...user,
                  name: empData.name,
                  division: empData.division,
                };
              }
            } catch (error) {
              console.error("Error fetching employee data:", error);
            }
          }
          return user;
        })
      );

      // Filter to only show users with COMPLETE data (name, division, employeeId)
      const completeUsers = enrichedData.filter((user) => {
        const hasName = user.name && user.name !== "";
        const hasDivision = user.division && user.division !== "";
        const hasEmployeeId = user.employeeId && user.employeeId !== "";

        // Only show users with ALL required fields
        return hasName && hasDivision && hasEmployeeId;
      });

      console.log("✅ Complete users:", completeUsers);
      console.log(
        "🗑️ Filtered out incomplete users:",
        enrichedData.length - completeUsers.length
      );

      setEmployeeUsers(completeUsers);
    } catch (error) {
      console.error("Error fetching employee users:", error);
      toast({
        title: "Error",
        description: "Gagal memuat daftar user peserta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (
    userId: string,
    employeeId: string,
    email: string,
    name: string
  ) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus akun ${
          name || email
        }?\n\nPeserta ini akan bisa mendaftar ulang setelah akun dihapus.`
      )
    )
      return;

    try {
      // 1. Delete from Firestore users collection
      await deleteDoc(doc(db, "users", userId));

      // 2. Reset uid and email in employees document
      if (employeeId) {
        const employeeRef = doc(db, "employees", employeeId);
        await updateDoc(employeeRef, {
          uid: null,
          email: null,
          isActive: false,
          lastLogin: null,
        });
      }

      toast({
        title: "Berhasil",
        description: `Akun ${
          name || email
        } berhasil dihapus. Peserta dapat mendaftar ulang.`,
      });

      fetchEmployeeUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Gagal menghapus akun user",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = employeeUsers.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.division?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDivision =
      filterDivision === "all" || user.division === filterDivision;

    return matchesSearch && matchesDivision;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Kelola User Peserta
        </h1>
        <p className="text-gray-500 mt-2">
          Kelola akun user peserta yang sudah terdaftar. Hapus akun untuk
          memungkinkan peserta mendaftar ulang.
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari berdasarkan nama, email, divisi, atau ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterDivision} onValueChange={setFilterDivision}>
          <SelectTrigger className="w-full md:w-[250px]">
            <SelectValue placeholder="Semua Divisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Divisi</SelectItem>
            {DIVISIONS.map((div) => (
              <SelectItem key={div} value={div}>
                {div}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Peserta Terdaftar ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat daftar user peserta...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {employeeUsers.length === 0
                  ? "Tidak ada user peserta terdaftar."
                  : "Tidak ada user yang cocok dengan pencarian."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID Peserta</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          {user.name || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {user.employeeId || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.division || "-"}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDateTable(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDeleteUser(
                              user.id,
                              user.employeeId,
                              user.email,
                              user.name || ""
                            )
                          }
                          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus Akun
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
