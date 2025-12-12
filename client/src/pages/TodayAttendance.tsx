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
import { ArrowLeft, Clock, CheckCircle2, LogOut } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useLocation } from "wouter";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  division?: string;
  date: string;
  timestamp: any;
  type: "check-in" | "check-out";
}

export default function TodayAttendance() {
  const [, setLocation] = useLocation();
  const [checkInRecords, setCheckInRecords] = useState<AttendanceRecord[]>([]);
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

      const checkIns: AttendanceRecord[] = [];
      const checkOuts: AttendanceRecord[] = [];

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data() as AttendanceRecord;
        const record = {
          ...data,
          id: doc.id,
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

  const isLate = (timestamp: any) => {
    try {
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
      return timeString > "11:00:00";
    } catch {
      return false;
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
            Absensi Hari Ini
          </h1>
          <div className="flex items-center justify-between gap-4 mt-2">
            <p className="text-gray-500">
              Detail kehadiran peserta pada tanggal yang dipilih
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

      <Tabs defaultValue="check-in" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="check-in" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Absen Masuk ({checkInRecords.length})
          </TabsTrigger>
          <TabsTrigger value="check-out" className="gap-2">
            <LogOut className="h-4 w-4" />
            Absen Pulang ({checkOutRecords.length})
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkInRecords.map((record, index) => (
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
                            {isLate(record.timestamp) ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                Terlambat
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                Tepat Waktu
                              </span>
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
                        <TableHead>Waktu Check-out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkOutRecords.map((record, index) => (
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
