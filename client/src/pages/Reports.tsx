import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeId: string;
  division?: string;
  timestamp: any;
  type: string;
  date: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Dummy Office Location (Example: Jakarta Monas)
// Replace with actual office coordinates
const OFFICE_LOCATION = {
  latitude: -6.175392,
  longitude: 106.827153,
};

const MAX_DISTANCE_METERS = 100; // 100 meters radius

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function Reports() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const q = query(
        collection(db, "attendance"),
        orderBy("timestamp", "desc"),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];
      setAttendance(data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationStatus = (record: AttendanceRecord) => {
    if (!record.location) return "Unknown";
    const distance = calculateDistance(
      record.location.latitude,
      record.location.longitude,
      OFFICE_LOCATION.latitude,
      OFFICE_LOCATION.longitude
    );
    return distance <= MAX_DISTANCE_METERS ? "In Office" : "Remote";
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      attendance.map((row) => ({
        Name: row.employeeName,
        "Employee ID": row.employeeId,
        Division: row.division || "-",
        Date: row.date,
        Time: row.timestamp
          ? new Date(row.timestamp.seconds * 1000).toLocaleTimeString()
          : "-",
        Type: row.type,
        Location: getLocationStatus(row),
        Coordinates: row.location
          ? `${row.location.latitude}, ${row.location.longitude}`
          : "-",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, "attendance-report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 15);

    const tableData = attendance.map((row) => [
      row.employeeName,
      row.division || "-",
      row.date,
      row.timestamp
        ? new Date(row.timestamp.seconds * 1000).toLocaleTimeString()
        : "-",
      row.type,
      getLocationStatus(row),
    ]);

    autoTable(doc, {
      head: [["Name", "Division", "Date", "Time", "Type", "Location"]],
      body: tableData,
      startY: 20,
    });

    doc.save("attendance-report.pdf");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Reports
          </h1>
          <p className="text-gray-500 mt-2">View and export attendance logs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToPDF}>
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    Loading data...
                  </TableCell>
                </TableRow>
              ) : attendance.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                attendance.map((record) => {
                  const locStatus = getLocationStatus(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employeeName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {record.division || "-"}
                      </TableCell>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>
                        {record.timestamp
                          ? new Date(
                              record.timestamp.seconds * 1000
                            ).toLocaleTimeString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record.location ? (
                          <a
                            href={`https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <MapPin className="h-3 w-3" />
                            {locStatus}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {record.type.toUpperCase()}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
