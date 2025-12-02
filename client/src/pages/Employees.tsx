import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, QrCode, Search, Download, Trash2, Pencil } from "lucide-react";
import QRCode from "react-qr-code";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  division: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Form State
  const [formData, setFormData] = useState({
    employeeId: "",
    name: "",
    division: "",
  });

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
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "employees"));
      const employeesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async (
    employeeName: string,
    action: string,
    type: "add-employee" | "edit-employee",
    division: string
  ) => {
    try {
      const adminEmail = auth.currentUser?.email || "Unknown";
      const timestamp = new Date().toISOString();

      await addDoc(collection(db, "activities"), {
        employeeName,
        employeeId: formData.employeeId,
        action,
        type,
        division,
        adminEmail,
        timestamp,
      });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if employee ID already exists
      const employeeRef = doc(db, "employees", formData.employeeId);

      // Use setDoc with custom ID instead of addDoc
      await setDoc(employeeRef, {
        employeeId: formData.employeeId,
        name: formData.name,
        division: formData.division,
      });

      // Log activity
      await logActivity(
        formData.name,
        `Menambahkan karyawan baru: ${formData.name} (${formData.employeeId})`,
        "add-employee",
        formData.division
      );

      toast({
        title: "Karyawan Ditambahkan",
        description: `${formData.name} berhasil ditambahkan.`,
      });
      setIsAddOpen(false);
      setFormData({ employeeId: "", name: "", division: "" });
      fetchEmployees();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menambahkan karyawan.",
      });
    }
  };

  const handleEditClick = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({
      employeeId: emp.employeeId || emp.id,
      name: emp.name,
      division: emp.division,
    });
    setIsEditOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      const employeeRef = doc(db, "employees", editingId);
      const oldData = employees.find((emp) => emp.id === editingId);

      await updateDoc(employeeRef, {
        name: formData.name,
        division: formData.division,
        // Note: employeeId (document ID) cannot be changed easily in Firestore
      });

      // Log activity
      const changes = [];
      if (oldData?.name !== formData.name) {
        changes.push(`nama: ${oldData?.name} → ${formData.name}`);
      }
      if (oldData?.division !== formData.division) {
        changes.push(`divisi: ${oldData?.division} → ${formData.division}`);
      }

      await logActivity(
        formData.name,
        `Mengedit data karyawan. Perubahan: ${changes.join(", ")}`,
        "edit-employee",
        formData.division
      );

      toast({
        title: "Karyawan Diperbarui",
        description: "Data karyawan berhasil diperbarui.",
      });
      setIsEditOpen(false);
      setFormData({ employeeId: "", name: "", division: "" });
      setEditingId(null);
      fetchEmployees();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memperbarui karyawan.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus karyawan ini?")) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      toast({
        title: "Dihapus",
        description: "Karyawan berhasil dihapus.",
      });
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.division.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QR-${selectedEmployee?.name}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Karyawan
          </h1>
          <p className="text-gray-500 mt-2">
            Kelola data karyawan dan generate QR code.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Karyawan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Karyawan Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  required
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  placeholder="EMP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Budi Santoso"
                />
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  required
                  value={formData.division}
                  onValueChange={(value) =>
                    setFormData({ ...formData, division: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVISIONS.map((div) => (
                      <SelectItem key={div} value={div}>
                        {div}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Simpan Karyawan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Karyawan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input
                disabled
                value={formData.employeeId}
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-500">
                ID Karyawan tidak dapat diubah.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Division</Label>
              <Select
                required
                value={formData.division}
                onValueChange={(value) =>
                  setFormData({ ...formData, division: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((div) => (
                    <SelectItem key={div} value={div}>
                      {div}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Perbarui Karyawan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Cari berdasarkan nama, ID karyawan, atau divisi..."
              className="pl-8 max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-gray-500"
                  >
                    Loading karyawan...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-gray-500"
                  >
                    Tidak ada karyawan ditemukan. Tambahkan untuk memulai.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs">
                      {emp.id}
                    </TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.division}</TableCell>
                    <TableCell className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSelectedEmployee(emp)}
                          >
                            <QrCode className="h-4 w-4" /> QR Code
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>QR Code Karyawan</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col items-center justify-center p-6 space-y-4">
                            <div className="bg-white p-4 rounded-xl border shadow-sm">
                              <QRCode
                                id="qr-code-svg"
                                value={JSON.stringify({
                                  id: emp.id,
                                  name: emp.name,
                                  division: emp.division,
                                })}
                                size={200}
                              />
                            </div>
                            <div className="text-center space-y-1">
                              <h3 className="font-bold text-lg">{emp.name}</h3>
                              <p className="text-sm text-gray-500">
                                {emp.division}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                ID: {emp.id}
                              </p>
                            </div>
                            <Button
                              className="w-full gap-2"
                              onClick={downloadQR}
                            >
                              <Download className="h-4 w-4" /> Unduh QR
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleEditClick(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(emp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
