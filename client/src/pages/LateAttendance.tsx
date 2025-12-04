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
import { ArrowLeft, Clock, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useLocation } from "wouter";

interface LateRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  division?: string;
  date: string;
  timestamp: any;
  type: "check-in";
}

export default function LateAttendance() {
  const [, setLocation] = useLocation();
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLateAttendance();
  }, []);

  const fetchLateAttendance = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      // Fetch all check-in attendance for today
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, "attendance"),
          where("date", "==", today),
          where("type", "==", "check-in")
        )
      );

      const lateList: LateRecord[] = [];

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data() as LateRecord;

        // Check if the check-in is late (after 11:00 AM)
        let checkInTime = "00:00:00";

        if (data.timestamp) {
          if (
            data.timestamp.toDate &&
            typeof data.timestamp.toDate === "function"
          ) {
            const date = data.timestamp.toDate();
            checkInTime = date.toTimeString().split(" ")[0];
          } else if (data.timestamp.seconds) {
            const date = new Date(data.timestamp.seconds * 1000);
            checkInTime = date.toTimeString().split(" ")[0];
          } else if (typeof data.timestamp === "string") {
            checkInTime = data.timestamp.split("T")[1] || "00:00:00";
          }
        }

        // If check-in time is after 11:00:00, it's late
        if (checkInTime > "11:00:00") {
          lateList.push({
            ...data,
            id: doc.id,
          });
        }
      });

      // Sort by timestamp (latest first)
      lateList.sort((a, b) => {
        const timeA = getTimestamp(a.timestamp);
        const timeB = getTimestamp(b.timestamp);
        return timeA - timeB;
      });

      setLateRecords(lateList);
    } catch (error) {
      console.error("Error fetching late attendance:", error);
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

  const calculateLateDuration = (timestamp: any) => {
    try {
      let date: Date;

      if (timestamp?.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      } else {
        return "-";
      }

      // Calculate difference from 11:00 AM
      const checkInTime = date.getTime();
      const today = new Date(date);
      today.setHours(11, 0, 0, 0);
      const targetTime = today.getTime();

      const diffMs = checkInTime - targetTime;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 60) {
        return `${diffMins} menit`;
      } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours} jam ${mins} menit`;
      }
    } catch {
      return "-";
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Peserta Terlambat Hari Ini
          </h1>
          <p className="text-gray-500 mt-2">
            Daftar peserta yang check-in setelah pukul 11:00 WIB
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Daftar Keterlambatan ({lateRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat data...</p>
            </div>
          ) : lateRecords.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">
                Tidak ada peserta yang terlambat hari ini
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Semua peserta datang tepat waktu!
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
                    <TableHead>Durasi Terlambat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lateRecords.map((record, index) => (
                    <TableRow key={record.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {record.employeeName}
                      </TableCell>
                      <TableCell>{record.division || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span className="text-amber-700 dark:text-amber-500 font-medium">
                            {formatTime(record.timestamp)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {calculateLateDuration(record.timestamp)}
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
    </div>
  );
}
