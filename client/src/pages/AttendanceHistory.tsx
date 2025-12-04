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
import { MapPin, Calendar, Clock, Eye } from "lucide-react";
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
    address?: string; // Add address field
  };
}

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
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
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
      let addressParts: string[] = [];

      if (data.address) {
        const addr = data.address;

        // Road/street information (most specific)
        if (addr.road) {
          addressParts.push(addr.road);
        } else if (addr.pedestrian) {
          addressParts.push(addr.pedestrian);
        } else if (addr.footway) {
          addressParts.push(addr.footway);
        }

        // Building/house number
        if (addr.house_number) {
          addressParts[addressParts.length - 1] = `${addr.house_number} ${
            addressParts[addressParts.length - 1] || ""
          }`.trim();
        }

        // Neighbourhood/suburb/village
        if (addr.neighbourhood) {
          addressParts.push(addr.neighbourhood);
        } else if (addr.suburb) {
          addressParts.push(addr.suburb);
        } else if (addr.village) {
          addressParts.push(addr.village);
        } else if (addr.hamlet) {
          addressParts.push(addr.hamlet);
        }

        // City/town/district
        if (addr.city) {
          addressParts.push(addr.city);
        } else if (addr.town) {
          addressParts.push(addr.town);
        } else if (addr.municipality) {
          addressParts.push(addr.municipality);
        } else if (addr.city_district) {
          addressParts.push(addr.city_district);
        }

        // State/province
        if (addr.state) {
          addressParts.push(addr.state);
        }

        // Country
        if (addr.country) {
          addressParts.push(addr.country);
        }
      }

      // If we couldn't build address from components, use display_name as fallback
      const address =
        addressParts.length > 0
          ? addressParts.join(", ")
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
                  {filteredRecords.map((record) => (
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
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
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
