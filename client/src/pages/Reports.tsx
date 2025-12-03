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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, MapPin, Eye } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";

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
  const [filterDivision, setFilterDivision] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [locationAddresses, setLocationAddresses] = useState<
    Record<string, string>
  >({});
  const [recordAddresses, setRecordAddresses] = useState<
    Record<string, string>
  >({});
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
    fetchAttendance();
  }, []);

  // Fetch addresses for all records
  useEffect(() => {
    const fetchAddresses = async () => {
      for (const record of attendance) {
        if (record.location && !recordAddresses[record.id]) {
          const address = await getAddressFromCoordinates(
            record.location.latitude,
            record.location.longitude
          );
          setRecordAddresses((prev) => ({
            ...prev,
            [record.id]: address,
          }));
        }
      }
    };

    if (attendance.length > 0) {
      fetchAddresses();
    }
  }, [attendance]);

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

  // Filter attendance by division
  const filteredAttendance = attendance.filter((record) => {
    if (filterDivision === "all") return true;
    return record.division === filterDivision;
  });

  // Reverse geocoding to get address from coordinates
  const getAddressFromCoordinates = async (
    latitude: number,
    longitude: number
  ): Promise<string> => {
    const key = `${latitude},${longitude}`;

    // Check if we already have this address cached
    if (locationAddresses[key]) {
      return locationAddresses[key];
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "HRGroup-Attendance-App",
          },
        }
      );
      const data = await response.json();

      // Extract meaningful address parts
      const address =
        data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      // Cache the address
      setLocationAddresses((prev) => ({ ...prev, [key]: address }));

      return address;
    } catch (error) {
      console.error("Error getting address:", error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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

  // Format date to Indonesian format (e.g., "Senin, 3 Desember 2025")
  const formatDateIndonesian = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredAttendance.map((row) => ({
        Nama: row.employeeName,
        "ID Peserta": row.employeeId,
        Divisi: row.division || "-",
        Tanggal: formatDateIndonesian(row.date),
        Waktu: row.timestamp
          ? new Date(row.timestamp.seconds * 1000).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Jakarta",
              hour12: false,
            }) + " WIB"
          : "-",
        Tipe: row.type === "check-in" ? "Check In" : "Check Out",
        Lokasi: getLocationStatus(row),
        Koordinat: row.location
          ? `${row.location.latitude}, ${row.location.longitude}`
          : "-",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
    XLSX.writeFile(wb, "laporan-kehadiran.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Laporan Kehadiran Peserta", 14, 15);

    const tableData = filteredAttendance.map((row) => [
      row.employeeName,
      row.division || "-",
      formatDateIndonesian(row.date),
      row.timestamp
        ? new Date(row.timestamp.seconds * 1000).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Jakarta",
            hour12: false,
          }) + " WIB"
        : "-",
      row.type === "check-in" ? "Check In" : "Check Out",
      getLocationStatus(row),
    ]);

    autoTable(doc, {
      head: [["Nama", "Divisi", "Tanggal", "Waktu", "Tipe", "Lokasi"]],
      body: tableData,
      startY: 20,
    });

    doc.save("laporan-kehadiran.pdf");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Laporan Kehadiran
          </h1>
          <p className="text-gray-500 mt-2">
            Lihat dan ekspor data kehadiran peserta.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Ekspor Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToPDF}>
            <Download className="h-4 w-4" /> Ekspor PDF
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Filter Divisi</Label>
              <Select value={filterDivision} onValueChange={setFilterDivision}>
                <SelectTrigger className="w-full mt-2">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Rekap Kehadiran Terbaru ({filteredAttendance.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredAttendance.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendance.map((record, index) => {
                  const locStatus = getLocationStatus(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="text-gray-500 text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.employeeName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {record.division || "-"}
                      </TableCell>
                      <TableCell>{formatDateIndonesian(record.date)}</TableCell>
                      <TableCell>
                        {record.timestamp
                          ? new Date(
                              record.timestamp.seconds * 1000
                            ).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              timeZone: "Asia/Jakarta",
                              hour12: false,
                            })
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
                          <span className="text-gray-400 text-xs">
                            Tidak Diketahui
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {record.type.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.location && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Detail
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Location Detail Dialog */}
      {selectedRecord && selectedRecord.location && (
        <Dialog
          open={!!selectedRecord}
          onOpenChange={() => setSelectedRecord(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Detail Lokasi - {selectedRecord.employeeName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nama Peserta
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedRecord.employeeName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Divisi
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedRecord.division || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tanggal & Waktu
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatDateIndonesian(selectedRecord.date)} •{" "}
                    {selectedRecord.timestamp
                      ? new Date(
                          selectedRecord.timestamp.seconds * 1000
                        ).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: "Asia/Jakarta",
                          hour12: false,
                        })
                      : "-"}{" "}
                    WIB
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Alamat Lengkap
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {recordAddresses[selectedRecord.id] || "Memuat alamat..."}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Koordinat
                  </p>
                  <p className="font-mono font-semibold text-gray-900 dark:text-white">
                    {selectedRecord.location.latitude.toFixed(6)},{" "}
                    {selectedRecord.location.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Status Lokasi
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {getLocationStatus(selectedRecord)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const mapUrl = `https://maps.google.com/?q=${
                      selectedRecord.location!.latitude
                    },${selectedRecord.location!.longitude}`;
                    window.open(mapUrl, "_blank");
                  }}
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Buka di Google Maps
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${selectedRecord.location!.latitude},${
                        selectedRecord.location!.longitude
                      }`
                    );
                    toast({
                      title: "Tersalin",
                      description: "Koordinat disalin ke clipboard",
                    });
                  }}
                >
                  Salin Koordinat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
