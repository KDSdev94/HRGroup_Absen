import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, XCircle, UserX, LogOut, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string;
  division?: string;
  employeeId?: string;
  batch?: string;
  checkInDocId?: string;
}

interface AttendanceRecord {
  employeeId: string;
  type: "check-in" | "check-out";
}

export default function AbsentToday() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [notCheckedIn, setNotCheckedIn] = useState<Employee[]>([]);
  const [filterBatch, setFilterBatch] = useState("all");
  const BATCHES = ["Batch 1", "Batch 2", "Batch 3", "Batch 4", "Batch 5"];
  const [notCheckedOut, setNotCheckedOut] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Get date from URL query parameter or default to today
  const getInitialDate = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("date") || new Date().toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate);

  useEffect(() => {
    fetchAbsentEmployees();
  }, [selectedDate]);

  const fetchAbsentEmployees = async () => {
    try {
      setLoading(true);
      const targetDate = selectedDate;

      // Fetch all employees
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const allEmployees: Employee[] = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        division: doc.data().division,
        employeeId: doc.data().employeeId || doc.id,
        batch: doc.data().batch,
      }));

      // Fetch all attendance for the selected date
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", targetDate))
      );

      // Fetch approved permissions for the selected date
      const permissionsSnapshot = await getDocs(
        query(
          collection(db, "permissions"),
          where("date", "==", targetDate),
          where("status", "==", "approved")
        )
      );

      const permissionEmployeeIds = new Set<string>();
      permissionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.employeeId) {
          permissionEmployeeIds.add(data.employeeId);
        }
      });

      const checkInMap = new Map<string, string>(); // employeeId -> docId
      const checkOutEmployeeIds = new Set<string>();

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data() as AttendanceRecord;
        if (data.type === "check-in") {
          checkInMap.set(data.employeeId, doc.id);
        } else if (data.type === "check-out") {
          checkOutEmployeeIds.add(data.employeeId);
        }
      });

      // Find employees who haven't checked in AND don't have approved permission
      const notCheckedInList = allEmployees.filter((emp) => {
        const hasCheckedIn =
          checkInMap.has(emp.id) || checkInMap.has(emp.employeeId || "");
        const hasPermission =
          permissionEmployeeIds.has(emp.id) ||
          permissionEmployeeIds.has(emp.employeeId || "");

        return !hasCheckedIn && !hasPermission;
      });

      // Find employees who checked in but haven't checked out
      const notCheckedOutList = allEmployees
        .filter((emp) => {
          const hasCheckedIn =
            checkInMap.has(emp.id) || checkInMap.has(emp.employeeId || "");
          const hasCheckedOut =
            checkOutEmployeeIds.has(emp.id) ||
            checkOutEmployeeIds.has(emp.employeeId || "");
          return hasCheckedIn && !hasCheckedOut;
        })
        .map((emp) => ({
          ...emp,
          checkInDocId:
            checkInMap.get(emp.id) || checkInMap.get(emp.employeeId || ""),
        }));

      // Sort alphabetically by name
      notCheckedInList.sort((a, b) => a.name.localeCompare(b.name));
      notCheckedOutList.sort((a, b) => a.name.localeCompare(b.name));

      setNotCheckedIn(notCheckedInList);
      setNotCheckedOut(notCheckedOutList);
    } catch (error) {
      // Error fetching absent employees
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCheckIn = async (docId: string) => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menghapus data check-in peserta ini? Status akan kembali menjadi 'Belum Absen Masuk'."
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "attendance", docId));
      toast({
        title: "Berhasil",
        description: "Data check-in berhasil dihapus",
      });
      fetchAbsentEmployees();
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus data absensi",
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white md:hidden">
            Absen Hari Ini
          </h1>
        </div>

        <div className="flex-1 w-full">
          <h1 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Data Ketidakhadiran Hari Ini
          </h1>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
            <p className="text-gray-500 text-sm md:text-base">
              Daftar peserta yang belum melakukan absensi
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Semua Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Batch</SelectItem>
                  {BATCHES.map((batch) => (
                    <SelectItem key={batch} value={batch}>
                      {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Filter Tanggal:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="not-checked-in" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="not-checked-in" className="gap-2">
            <UserX className="h-4 w-4" />
            Belum Absen Masuk (
            {
              notCheckedIn.filter(
                (e) => filterBatch === "all" || e.batch === filterBatch
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="not-checked-out" className="gap-2">
            <LogOut className="h-4 w-4" />
            Belum Absen Pulang (
            {
              notCheckedOut.filter(
                (e) => filterBatch === "all" || e.batch === filterBatch
              ).length
            }
            )
          </TabsTrigger>
        </TabsList>

        <TabsContent value="not-checked-in" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Belum Check-in
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : notCheckedIn.length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">
                    Semua peserta sudah check-in!
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Kehadiran 100% hari ini
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama Peserta</TableHead>
                        <TableHead>ID Peserta</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notCheckedIn
                        .filter(
                          (employee) =>
                            filterBatch === "all" ||
                            employee.batch === filterBatch
                        )
                        .map((employee, index) => (
                          <TableRow key={employee.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {employee.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {employee.employeeId || employee.id}
                            </TableCell>
                            <TableCell>{employee.division || "-"}</TableCell>
                            <TableCell>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                Belum Hadir
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="not-checked-out" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-orange-600" />
                Belum Check-out
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : notCheckedOut.length === 0 ? (
                <div className="text-center py-12">
                  <LogOut className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">
                    Tidak ada peserta yang perlu check-out
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Semua sudah check-out atau belum check-in
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama Peserta</TableHead>
                        <TableHead>ID Peserta</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notCheckedOut
                        .filter(
                          (employee) =>
                            filterBatch === "all" ||
                            employee.batch === filterBatch
                        )
                        .map((employee, index) => (
                          <TableRow key={employee.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {employee.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {employee.employeeId || employee.id}
                            </TableCell>
                            <TableCell>{employee.division || "-"}</TableCell>
                            <TableCell>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                Masih di Tempat
                              </span>
                            </TableCell>
                            <TableCell>
                              {employee.checkInDocId && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteCheckIn(employee.checkInDocId!)
                                  }
                                  title="Hapus Check-in"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
