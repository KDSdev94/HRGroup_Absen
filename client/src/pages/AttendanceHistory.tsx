import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Calendar,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  timestamp: any; // Can be Firestore Timestamp or string
  type: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    obtained?: boolean;
    // Address fields from Firebase
    address?: string | null;
    street?: string | null;
    district?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
  };
}

// --- KONFIGURASI SERPAPI (GOOGLE MAPS ENGINE) ---
// Menggunakan SerpApi untuk mendapatkan data presisi dari Google Maps
const SERPAPI_KEY =
  "4c37835c05a346b06072180220ca7fa43820c61c3248b2e462a5a419dfde1b91";

export default function AttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [filterDate, setFilterDate] = useState("");
  const [locationAddresses, setLocationAddresses] = useState<
    Record<string, string>
  >({});
  const [recordAddresses, setRecordAddresses] = useState<
    Record<string, string>
  >({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    // Wait for auth state to be ready
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchAttendanceHistory();
      } else {
        setLoading(false);
        toast({
          title: "Error",
          description: "Silakan masuk untuk melihat riwayat kehadiran",
          variant: "destructive",
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch addresses for all records
  useEffect(() => {
    const fetchAddresses = async () => {
      for (const record of records) {
        if (record.location && !recordAddresses[record.id]) {
          // PRIORITAS 1: Gunakan alamat yang sudah tersimpan di Firebase
          if (record.location.address) {
            setRecordAddresses((prev) => ({
              ...prev,
              [record.id]: record.location!.address!,
            }));
            console.log(
              `✅ Using stored address for ${record.id}:`,
              record.location.address
            );
          }
          // PRIORITAS 2: Jika tidak ada alamat, coba build dari komponen
          else if (
            record.location.city ||
            record.location.street ||
            record.location.district
          ) {
            const parts = [
              record.location.street,
              record.location.district,
              record.location.city,
              record.location.province,
            ].filter(Boolean);
            const builtAddress = parts.join(", ");
            setRecordAddresses((prev) => ({
              ...prev,
              [record.id]: builtAddress,
            }));
            console.log(
              `✅ Built address from components for ${record.id}:`,
              builtAddress
            );
          }
          // PRIORITAS 3: Fallback ke reverse geocoding (untuk data lama)
          else {
            console.log(
              `⚠️ No stored address, fetching via reverse geocoding for ${record.id}`
            );
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
      }
    };

    if (records.length > 0) {
      fetchAddresses();
    }
  }, [records]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        toast({
          title: "Error",
          description: "Pengguna tidak terautentikasi",
          variant: "destructive",
        });
        return;
      }

      // Try to get the employeeId from multiple sources
      let employeeId: string | null = null;

      console.log(
        "🔍 Looking for employee ID for user:",
        currentUser.uid,
        currentUser.email
      );

      // 1. Try to get employeeId from the users collection
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          employeeId = userData.employeeId || userDoc.id; // fallback to doc ID
          console.log("✅ Found employeeId in users collection:", employeeId);
        }
      } catch (error) {
        console.log("User profile not found in users collection:", error);
      }

      // 2. If not found in users, try to find employee document with matching UID
      if (!employeeId) {
        try {
          const empDoc = await getDoc(doc(db, "employees", currentUser.uid));
          if (empDoc.exists()) {
            employeeId = empDoc.id; // Use document ID as employeeId
            console.log(
              "✅ Found employeeId in employees collection (by UID as doc ID):",
              employeeId
            );
          }
        } catch (error) {
          console.log("Employee doc not found in employees collection:", error);
        }
      }

      // 3. If still not found, query employees collection where uid matches
      if (!employeeId) {
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("uid", "==", currentUser.uid)
          );
          const empSnapshot = await getDocs(empQuery);
          if (!empSnapshot.empty) {
            employeeId = empSnapshot.docs[0].id;
            console.log("✅ Found employeeId by UID field query:", employeeId);
          }
        } catch (error) {
          console.log("No employee found by UID query:", error);
        }
      }

      // 4. If still no employeeId, try to get it from employee's document fields
      if (!employeeId) {
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("email", "==", currentUser.email)
          );
          const empSnapshot = await getDocs(empQuery);
          if (!empSnapshot.empty) {
            employeeId = empSnapshot.docs[0].id;
            console.log("✅ Found employeeId by email query:", employeeId);
          }
        } catch (error) {
          console.log("No employee found by email query:", error);
        }
      }

      // If still no employeeId, show error
      if (!employeeId) {
        console.log("❌ No employeeId found for user");
        toast({
          title: "Error",
          description:
            "Profil karyawan tidak ditemukan. Silakan hubungi admin untuk menghubungkan akun Anda.",
          variant: "destructive",
        });
        return;
      }

      console.log("📋 Querying attendance for employeeId:", employeeId);

      // Query attendance records for this employee
      // Note: Removed orderBy to avoid needing a composite index
      // We'll sort on the client side instead
      const q = query(
        collection(db, "attendance"),
        where("employeeId", "==", employeeId)
      );

      const querySnapshot = await getDocs(q);
      const attendanceData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];

      console.log(`✅ Found ${attendanceData.length} attendance records`);
      if (attendanceData.length > 0) {
        console.log("Sample record:", attendanceData[0]);
      }

      // Sort by timestamp descending on client side
      attendanceData.sort((a, b) => {
        const getMillis = (timestamp: any) => {
          if (!timestamp) return 0;
          // Firestore Timestamp object
          if (timestamp.toDate && typeof timestamp.toDate === "function") {
            return timestamp.toDate().getTime();
          }
          // Firestore Timestamp-like object (seconds)
          if (timestamp.seconds) {
            return timestamp.seconds * 1000;
          }
          // Date object
          if (timestamp instanceof Date) {
            return timestamp.getTime();
          }
          // String or Number
          return new Date(timestamp).getTime();
        };

        const timeA = getMillis(a.timestamp);
        const timeB = getMillis(b.timestamp);
        return timeB - timeA; // descending order (newest first)
      });

      setRecords(attendanceData);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      toast({
        title: "Error",
        description: "Gagal memuat riwayat kehadiran",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    if (!filterDate) return true;
    return record.date === filterDate;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const openMapLink = (latitude: number, longitude: number) => {
    const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    window.open(mapUrl, "_blank");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    });
  };

  const formatTime = (timestamp: any) => {
    try {
      let date: Date;

      // Handle Firestore Timestamp object
      if (timestamp?.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      }
      // Handle timestamp with seconds property (Firestore format)
      else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      // Handle ISO string or regular date string
      else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      }
      // Handle number (milliseconds)
      else if (typeof timestamp === "number") {
        date = new Date(timestamp);
      }
      // Handle Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        console.error("Unknown timestamp format:", timestamp);
        return "Waktu tidak valid";
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date created from timestamp:", timestamp);
        return "Waktu tidak valid";
      }

      // Format with WIB timezone (Asia/Jakarta)
      return (
        date.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
          hour12: false,
        }) + " WIB"
      );
    } catch (error) {
      console.error("Error formatting time:", error, "Timestamp:", timestamp);
      return "Waktu tidak valid";
    }
  };

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
        // Note: Panggilan client-side ke SerpApi mungkin terkena masalah CORS di browser.
        const response = await fetch(
          `https://serpapi.com/search.json?engine=google_maps&q=${latitude},${longitude}&ll=@${latitude},${longitude},18z&api_key=${SERPAPI_KEY}`
        );
        const data = await response.json();
        let fullAddress = "";

        // Strategi: Cek local_results dulu karena biasanya berisi tempat spesifik di sekitar koordinat
        if (data.local_results && data.local_results.length > 0) {
          const place = data.local_results[0];
          const title = place.title || "";
          const addr = place.address || "";

          if (addr.toLowerCase().includes(title.toLowerCase())) {
            fullAddress = addr;
          } else {
            fullAddress = `${title}, ${addr}`;
          }
        }

        // Jika tidak ada local_results, cek place_results (biasanya untuk alamat presisi/rumah)
        if ((!fullAddress || fullAddress.length < 10) && data.place_results) {
          const place = data.place_results;
          const title = place.title || "";
          const addr = place.address || place.formatted_address || "";

          if (addr.toLowerCase().includes(title.toLowerCase())) {
            fullAddress = addr;
          } else {
            fullAddress = `${title}, ${addr}`;
          }
        }

        // Fallback terakhir ke data.address top level
        if (!fullAddress && data.address) {
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

        // 7. State / Province (Optional, maybe too long)
        // if (addr.state) parts.push(addr.state);
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Riwayat Kehadiran
        </h1>
        <p className="text-gray-500 mt-2">
          Lihat catatan kehadiran dan lokasi check-in Anda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Filter berdasarkan Tanggal
              </label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full"
              />
            </div>
            {filterDate && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilterDate("")}
                  className="gap-2"
                >
                  Bersihkan Filter
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catatan Kehadiran ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Memuat riwayat kehadiran...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {records.length === 0
                  ? "Tidak ada catatan kehadiran ditemukan."
                  : "Tidak ada catatan yang cocok dengan tanggal yang dipilih."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDate(record.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {formatTime(record.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${
                            record.type === "check-in"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}
                        >
                          {record.type === "check-in"
                            ? "Check In"
                            : "Check Out"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.location ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span
                              className="text-sm text-gray-700 dark:text-gray-300 truncate"
                              title={recordAddresses[record.id]}
                            >
                              {recordAddresses[record.id] || "Memuat alamat..."}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
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
                            Lihat Peta
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Dialog */}
      {selectedRecord && selectedRecord.location && (
        <Dialog
          open={!!selectedRecord}
          onOpenChange={() => setSelectedRecord(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Lokasi - {formatDate(selectedRecord.date)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                <div>
                  <p className="text-sm text-gray-500">Koordinat</p>
                  <p className="font-mono font-semibold">
                    {selectedRecord.location.latitude.toFixed(6)},{" "}
                    {selectedRecord.location.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Waktu</p>
                  <p className="font-semibold">
                    {formatTime(selectedRecord.timestamp)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    openMapLink(
                      selectedRecord.location!.latitude,
                      selectedRecord.location!.longitude
                    )
                  }
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
