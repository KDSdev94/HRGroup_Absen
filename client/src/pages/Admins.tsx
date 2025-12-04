import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, Mail, Shield } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { formatDateTable } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

interface Admin {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: any;
}

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    password: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      // Query users collection where role is "admin" or "superadmin"
      const qAdmin = query(
        collection(db, "users"),
        where("role", "==", "admin")
      );
      const qSuperadmin = query(
        collection(db, "users"),
        where("role", "==", "superadmin")
      );

      const [adminSnapshot, superadminSnapshot] = await Promise.all([
        getDocs(qAdmin),
        getDocs(qSuperadmin),
      ]);

      const adminsData = [
        ...adminSnapshot.docs.map((doc) => ({
          id: doc.id,
          uid: doc.id,
          ...doc.data(),
        })),
        ...superadminSnapshot.docs.map((doc) => ({
          id: doc.id,
          uid: doc.id,
          ...doc.data(),
        })),
      ] as Admin[];

      setAdmins(adminsData);
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast({
        title: "Error",
        description: "Gagal memuat daftar admin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.displayName || !formData.password) {
      toast({
        title: "Error",
        description: "Harap isi semua kolom",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Create user profile in Firestore with admin role
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        email: formData.email,
        displayName: formData.displayName,
        role: "admin",
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Berhasil",
        description: `Admin ${formData.displayName} berhasil dibuat`,
      });

      setFormData({ email: "", displayName: "", password: "" });
      setIsAddDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      console.error("Error creating admin:", error);
      let errorMessage = "Gagal membuat admin";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email sudah digunakan";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password terlalu lemah";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdmin || !formData.displayName) {
      toast({
        title: "Error",
        description: "Harap isi kolom yang diperlukan",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update Firestore document
      await updateDoc(doc(db, "users", selectedAdmin.id), {
        displayName: formData.displayName,
        // Note: Cannot change email directly, would need Firebase Admin SDK
      });

      toast({
        title: "Berhasil",
        description: "Admin berhasil diperbarui",
      });

      setFormData({ email: "", displayName: "", password: "" });
      setIsEditDialogOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error) {
      console.error("Error updating admin:", error);
      toast({
        title: "Error",
        description: "Gagal memperbarui admin",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminEmail: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${adminEmail}?`)) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "users", adminId));

      toast({
        title: "Berhasil",
        description: "Admin berhasil dihapus",
      });

      fetchAdmins();
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast({
        title: "Error",
        description: "Gagal menghapus admin",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (admin: Admin) => {
    setSelectedAdmin(admin);
    setFormData({
      email: admin.email,
      displayName: admin.displayName,
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Kelola Admin
        </h1>
        <p className="text-gray-500 mt-2">
          Buat, edit, dan hapus akun admin dan superadmin. Admin memiliki akses
          ke manajemen peserta dan laporan.
        </p>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah Admin
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Admin Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@contoh.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="displayName">Nama</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Budi Santoso"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan kata sandi"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Buat Admin
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search Bar */}
      <div>
        <Input
          placeholder="Cari berdasarkan email atau nama..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle>Akun Admin ({filteredAdmins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat daftar admin...</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {admins.length === 0
                  ? "Tidak ada admin ditemukan."
                  : "Tidak ada admin yang cocok dengan pencarian."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-amber-600" />
                          {admin.displayName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {admin.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-sm font-medium capitalize ${
                            admin.role === "superadmin"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {admin.role === "superadmin" ? "Superadmin" : "Admin"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDateTable(admin.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(admin)}
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Ubah
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDeleteAdmin(admin.id, admin.email)
                            }
                            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Admin Dialog */}
      {selectedAdmin && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateAdmin} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-gray-100 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email tidak dapat diubah
                </p>
              </div>
              <div>
                <Label htmlFor="edit-displayName">Nama</Label>
                <Input
                  id="edit-displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Perbarui Admin
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
