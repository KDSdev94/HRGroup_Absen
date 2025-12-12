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
import { ArrowLeft, XCircle, UserX, LogOut } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useLocation } from "wouter";

interface Employee {
  id: string;
  name: string;
  division?: string;
  employeeId?: string;
}

interface AttendanceRecord {
  employeeId: string;
  type: "check-in" | "check-out";
}

export default function AbsentToday() {
  const [, setLocation] = useLocation();
  const [notCheckedIn, setNotCheckedIn] = useState<Employee[]>([]);
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
      }));

      // Fetch all attendance for the selected date
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", targetDate))
      );

      const checkInEmployeeIds = new Set<string>();
      const checkOutEmployeeIds = new Set<string>();

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data() as AttendanceRecord;
        if (data.type === "check-in") {
          checkInEmployeeIds.add(data.employeeId);
        } else if (data.type === "check-out") {
          checkOutEmployeeIds.add(data.employeeId);
        }
      });

      // Find employees who haven't checked in
      const notCheckedInList = allEmployees.filter((emp) => {
        return (
          !checkInEmployeeIds.has(emp.id) &&
          !checkInEmployeeIds.has(emp.employeeId || "")
        );
      });

      // Find employees who checked in but haven't checked out
      const notCheckedOutList = allEmployees.filter((emp) => {
        const hasCheckedIn =
          checkInEmployeeIds.has(emp.id) ||
          checkInEmployeeIds.has(emp.employeeId || "");
        const hasCheckedOut =
          checkOutEmployeeIds.has(emp.id) ||
          checkOutEmployeeIds.has(emp.employeeId || "");
        return hasCheckedIn && !hasCheckedOut;
      });

      // Sort alphabetically by name
      notCheckedInList.sort((a, b) => a.name.localeCompare(b.name));
      notCheckedOutList.sort((a, b) => a.name.localeCompare(b.name));

      setNotCheckedIn(notCheckedInList);
      setNotCheckedOut(notCheckedOutList);
    } catch (error) {
      console.error("Error fetching absent employees:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Data Ketidakhadiran Hari Ini
          </h1>
          <div className="flex items-center justify-between gap-4 mt-2">
            <p className="text-gray-500">
              Daftar peserta yang belum melakukan absensi
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Filter Tanggal:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="not-checked-in" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="not-checked-in" className="gap-2">
            <UserX className="h-4 w-4" />
            Belum Absen Masuk ({notCheckedIn.length})
          </TabsTrigger>
          <TabsTrigger value="not-checked-out" className="gap-2">
            <LogOut className="h-4 w-4" />
            Belum Absen Pulang ({notCheckedOut.length})
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
                      {notCheckedIn.map((employee, index) => (
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notCheckedOut.map((employee, index) => (
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
