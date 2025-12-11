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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Download,
  FileSpreadsheet,
  MapPin,
  Eye,
  Trash2,
  CalendarIcon,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

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

// --- KONFIGURASI SERPAPI (GOOGLE MAPS ENGINE) ---
// Menggunakan SerpApi untuk mendapatkan data presisi dari Google Maps
const SERPAPI_KEY =
  "4c37835c05a346b06072180220ca7fa43820c61c3248b2e462a5a419dfde1b91";

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
  const [filterType, setFilterType] = useState("all"); // all, check-in, check-out
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [locationAddresses, setLocationAddresses] = useState<
    Record<string, string>
  >({});
  const [recordAddresses, setRecordAddresses] = useState<
    Record<string, string>
  >({});
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  // Filter attendance by division, type, and date range
  const filteredAttendance = attendance.filter((record) => {
    // Filter by division
    if (filterDivision !== "all" && record.division !== filterDivision) {
      return false;
    }

    // Filter by type (check-in / check-out)
    if (filterType !== "all" && record.type !== filterType) {
      return false;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0); // Reset time to compare dates only

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (recordDate < fromDate) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(0, 0, 0, 0);
        if (recordDate > toDate) return false;
      }
    }

    return true;
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

    // 1. COBA PAKAI SERPAPI (Google Maps Data)
    if (SERPAPI_KEY) {
      try {
        console.log(`🔍 Fetching SerpApi for ${latitude},${longitude}...`);
        // Note: Panggilan client-side ke SerpApi mungkin terkena masalah CORS di browser.
        // Idealnya ini dipanggil dari backend. Untuk testing development, kita coba fetch langsung.
        const response = await fetch(
          `https://serpapi.com/search.json?engine=google_maps&q=${latitude},${longitude}&ll=@${latitude},${longitude},18z&api_key=${SERPAPI_KEY}`
        );
        const data = await response.json();
        console.log("📦 SerpApi Response:", data);

        let fullAddress = "";

        if (data.place_results) {
          const title = data.place_results.title || "";
          const addr =
            data.place_results.address ||
            data.place_results.formatted_address ||
            "";

          // Jika title sudah ada di dalam address, jangan diulang
          if (addr.toLowerCase().includes(title.toLowerCase())) {
            fullAddress = addr;
          } else {
            fullAddress = `${title}, ${addr}`;
          }
        } else if (data.local_results && data.local_results.length > 0) {
          // Fallback ke local results jika place_results kosong
          const place = data.local_results[0];
          fullAddress = `${place.title}, ${place.address || ""}`;
        } else if (data.address) {
          fullAddress = data.address;
        }

        // Clean up address
        fullAddress = fullAddress.replace(/^, /, "").replace(/, $/, "").trim();

        if (fullAddress && fullAddress.length > 5) {
          setLocationAddresses((prev) => ({ ...prev, [key]: fullAddress }));
          return fullAddress;
        }
      } catch (error) {
        console.error("❌ SerpApi Error:", error);
        // Lanjut ke fallback OpenStreetMap jika error
      }
    }

    // 2. FALLBACK: OPENSTREETMAP (Gratis)
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

      // Build accurate address from detailed components
      const parts: string[] = [];

      if (data.address) {
        const addr = data.address;

        // 1. Specific Place Name (POI/Building)
        // "Pasar Batang" might be an amenity or building name
        if (addr.amenity) parts.push(addr.amenity);
        else if (addr.building) parts.push(addr.building);
        else if (addr.shop) parts.push(addr.shop);
        else if (addr.tourism) parts.push(addr.tourism);
        else if (addr.leisure) parts.push(addr.leisure);

        // 2. Road / Street
        // "Jl Yos Sudarso"
        if (addr.road) {
          parts.push(addr.road);
        } else if (addr.pedestrian) {
          parts.push(addr.pedestrian);
        }

        // 3. House Number
        if (addr.house_number && parts.length > 0) {
          // Append to the last part (usually road)
          parts[parts.length - 1] += ` No. ${addr.house_number}`;
        }

        // 4. Village / Kelurahan / Neighbourhood (Most specific area)
        // "Pasar Batang" might be a village
        if (addr.village) parts.push(addr.village);
        else if (addr.neighbourhood) parts.push(addr.neighbourhood);
        else if (addr.hamlet) parts.push(addr.hamlet);

        // 5. Suburb / District / Kecamatan
        // "Pesanggrahan" might be here
        if (addr.suburb) parts.push(addr.suburb);
        else if (addr.city_district) parts.push(addr.city_district);

        // 6. City / Regency
        if (addr.city) parts.push(addr.city);
        else if (addr.town) parts.push(addr.town);
        else if (addr.county) parts.push(addr.county);

        // 7. State / Province (Wajib muncul)
        if (addr.state) {
          parts.push(addr.state);
        }
      }

      // Filter duplicates and join
      // Sometimes village and suburb are the same
      const uniqueParts = parts.filter(
        (item, index) => parts.indexOf(item) === index
      );

      const address =
        uniqueParts.length > 0
          ? uniqueParts.join(", ")
          : data.display_name ||
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      // Cache the address
      setLocationAddresses((prev) => ({ ...prev, [key]: address }));

      return address;
    } catch (error) {
      console.error("Error getting address:", error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
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

  // Handle checkbox selection
  const toggleRecordSelection = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  // Select all records
  const selectAllRecords = () => {
    const allIds = new Set(filteredAttendance.map((r) => r.id));
    setSelectedRecords(allIds);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedRecords(new Set());
  };

  // Check if all records are selected
  const isAllSelected =
    filteredAttendance.length > 0 &&
    selectedRecords.size === filteredAttendance.length;

  // Handle delete selected records
  const handleDeleteSelected = async () => {
    if (selectedRecords.size === 0) return;

    setDeleting(true);
    try {
      // Delete all selected records
      const deletePromises = Array.from(selectedRecords).map((recordId) =>
        deleteDoc(doc(db, "attendance", recordId))
      );
      await Promise.all(deletePromises);

      // Show success toast
      toast({
        title: "✅ Berhasil Dihapus",
        description: `${selectedRecords.size} data laporan berhasil dihapus.`,
        duration: 3000,
      });

      // Refresh data and clear selection
      await fetchAttendance();
      setSelectedRecords(new Set());
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting records:", error);
      toast({
        variant: "destructive",
        title: "❌ Gagal Menghapus",
        description: "Terjadi kesalahan saat menghapus data.",
        duration: 4000,
      });
    } finally {
      setDeleting(false);
    }
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
        <div className="flex gap-2 flex-wrap">
          {selectedRecords.size > 0 && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Hapus ({selectedRecords.size})
            </Button>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Division Filter */}
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

            {/* Type Filter (Check-in / Check-out) */}
            <div className="flex-1">
              <Label>Tipe Absensi</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="check-in">Absen Masuk</SelectItem>
                  <SelectItem value="check-out">Absen Pulang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="flex-1">
              <Label>Dari Tanggal</Label>
              <div className="mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? (
                        format(dateFrom, "dd MMMM yyyy", { locale: localeId })
                      ) : (
                        <span>Pilih tanggal awal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                    {dateFrom && (
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setDateFrom(undefined)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Hapus Filter
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Date To Filter */}
            <div className="flex-1">
              <Label>Sampai Tanggal</Label>
              <div className="mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? (
                        format(dateTo, "dd MMMM yyyy", { locale: localeId })
                      ) : (
                        <span>Pilih tanggal akhir</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      disabled={(date) => (dateFrom ? date < dateFrom : false)}
                    />
                    {dateTo && (
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setDateTo(undefined)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Hapus Filter
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(dateFrom ||
            dateTo ||
            filterDivision !== "all" ||
            filterType !== "all") && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center flex-wrap gap-2">
                  <span>Filter aktif:</span>
                  {filterDivision !== "all" && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                      {filterDivision}
                    </span>
                  )}
                  {filterType !== "all" && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs">
                      {filterType === "check-in"
                        ? "Absen Masuk"
                        : "Absen Pulang"}
                    </span>
                  )}
                  {dateFrom && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                      Dari: {format(dateFrom, "dd/MM/yyyy")}
                    </span>
                  )}
                  {dateTo && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                      Sampai: {format(dateTo, "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterDivision("all");
                    setFilterType("all");
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                  className="text-xs"
                >
                  Reset Semua Filter
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Rekap Kehadiran Terbaru ({filteredAttendance.length})
            </CardTitle>
            {selectedRecords.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSelections}
                className="text-sm"
              >
                Bersihkan Pilihan
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllRecords();
                      } else {
                        clearAllSelections();
                      }
                    }}
                  />
                </TableHead>
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
                    colSpan={9}
                    className="text-center py-8 text-gray-500"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredAttendance.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-gray-500"
                  >
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendance.map((record, index) => {
                  const locStatus = getLocationStatus(record);
                  const isSelected = selectedRecords.has(record.id);
                  return (
                    <TableRow
                      key={record.id}
                      className={
                        isSelected ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            toggleRecordSelection(record.id)
                          }
                        />
                      </TableCell>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedRecords.size} data
              laporan?
              <br />
              <span className="font-semibold text-red-600">
                Tindakan ini tidak dapat dibatalkan.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
