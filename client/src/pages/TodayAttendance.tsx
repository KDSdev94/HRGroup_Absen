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
import { ArrowLeft, Clock, CheckCircle2, LogOut, Trash2 } from "lucide-react";
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

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  division?: string;
  date: string;
  timestamp: any;
  type: "check-in" | "check-out";
  batch?: string;
  status?: string;
}

export default function TodayAttendance() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [checkInRecords, setCheckInRecords] = useState<AttendanceRecord[]>([]);
  const [filterBatch, setFilterBatch] = useState("all");
  const BATCHES = ["Batch 1", "Batch 2", "Batch 3", "Batch 4", "Batch 5"];
  const [checkOutRecords, setCheckOutRecords] = useState<AttendanceRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Get date from URL query parameter or default to today
  const getInitialDate = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("date") || new Date().toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate);

  useEffect(() => {
    fetchTodayAttendance();
  }, [selectedDate]);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const targetDate = selectedDate;

      // Fetch all attendance for the selected date
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", targetDate))
      );

      // Fetch employees to get batch info
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const employeeBatches = new Map<string, string>();
      employeesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        // Map both firestore ID and custom employeeId to batch
        if (data.batch) {
          employeeBatches.set(doc.id, data.batch);
          if (data.employeeId) employeeBatches.set(data.employeeId, data.batch);
        }
      });

      const checkIns: AttendanceRecord[] = [];
      const checkOuts: AttendanceRecord[] = [];

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data() as AttendanceRecord;
        const batch = employeeBatches.get(data.employeeId) || "-";
        const record = {
          ...data,
          id: doc.id,
          batch,
        };

        if (data.type === "check-in") {
          checkIns.push(record);
        } else if (data.type === "check-out") {
          checkOuts.push(record);
        }
      });

      // Sort by timestamp
      checkIns.sort((a, b) => {
        const timeA = getTimestamp(a.timestamp);
        const timeB = getTimestamp(b.timestamp);
        return timeA - timeB;
      });

      checkOuts.sort((a, b) => {
        const timeA = getTimestamp(a.timestamp);
        const timeB = getTimestamp(b.timestamp);
        return timeA - timeB;
      });

      setCheckInRecords(checkIns);
      setCheckOutRecords(checkOuts);
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimestamp = (timestamp: any): number => {
    if (timestamp?.toDate && typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime();
    } else if (timestamp?.seconds) {
      return timestamp.seconds * 1000;
    } else if (typeof timestamp === "string") {
      return new Date(timestamp).getTime();
    }
    return 0;
  };

  const formatTime = (timestamp: any) => {
    try {
      let date: Date;

      if (timestamp?.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      } else {
        return "Waktu tidak valid";
      }

      return (
        date.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jakarta",
          hour12: false,
        }) + " WIB"
      );
    } catch {
      return "Waktu tidak valid";
    }
  };

  const isLate = (record: AttendanceRecord) => {
    // Strictly check time, ignoring stored status which might be incorrect from manual entry
    try {
      const timestamp = record.timestamp;
      let date: Date;

      if (timestamp?.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      } else {
        return false;
      }

      const timeString = date.toTimeString().split(" ")[0];

      let threshold = "09:00:00";
      if (date.getDay() === 1) {
        threshold = "10:00:00";
      }

      return timeString > threshold;
    } catch {
      return false;
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus data ${
          type === "check-in" ? "absen masuk" : "absen pulang"
        } ini?`
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "attendance", id));
      toast({
        title: "Berhasil",
        description: "Data absensi berhasil dihapus",
      });
      fetchTodayAttendance();
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
            Absensi Hari Ini
          </h1>
        </div>

        <div className="flex-1 w-full">
          <h1 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Absensi Hari Ini
          </h1>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
            <p className="text-gray-500 text-sm md:text-base">
              Detail kehadiran peserta pada tanggal yang dipilih
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

      <Tabs defaultValue="check-in" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="check-in" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Absen Masuk (
            {
              checkInRecords.filter(
                (r) => filterBatch === "all" || r.batch === filterBatch
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="check-out" className="gap-2">
            <LogOut className="h-4 w-4" />
            Absen Pulang (
            {
              checkOutRecords.filter(
                (r) => filterBatch === "all" || r.batch === filterBatch
              ).length
            }
            )
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check-in" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Daftar Absen Masuk
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : checkInRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    Belum ada yang absen masuk hari ini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama Peserta</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Waktu Check-in</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkInRecords
                        .filter(
                          (record) =>
                            filterBatch === "all" ||
                            record.batch === filterBatch
                        )
                        .map((record, index) => (
                          <TableRow key={record.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {record.employeeName}
                            </TableCell>
                            <TableCell>{record.division || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                {formatTime(record.timestamp)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isLate(record) ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  Terlambat
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                  Tepat Waktu
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDelete(record.id, "check-in")
                                }
                              >
                                <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="check-out" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-blue-600" />
                Daftar Absen Pulang
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : checkOutRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    Belum ada yang absen pulang hari ini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama Peserta</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Divisi</TableHead>
                        <TableHead>Waktu Check-out</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkOutRecords
                        .filter(
                          (record) =>
                            filterBatch === "all" ||
                            record.batch === filterBatch
                        )
                        .map((record, index) => (
                          <TableRow key={record.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {record.employeeName}
                            </TableCell>
                            <TableCell>{record.division || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                {formatTime(record.timestamp)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDelete(record.id, "check-out")
                                }
                              >
                                <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
