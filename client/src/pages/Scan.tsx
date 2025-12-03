import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  Camera,
  Upload,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged } from "firebase/auth";

export default function Scan() {
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(
    null
  );
  const [expectedAttendanceType, setExpectedAttendanceType] = useState<
    "check-in" | "check-out" | null
  >(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch logged-in user's employee ID
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Try users collection
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().employeeId) {
            const empId = userDoc.data().employeeId;
            setCurrentEmployeeId(empId);
            await checkTodayAttendance(empId);
            return;
          }

          // 2. Try employees collection (doc ID = UID)
          const empDoc = await getDoc(doc(db, "employees", user.uid));
          if (empDoc.exists()) {
            setCurrentEmployeeId(empDoc.id);
            await checkTodayAttendance(empDoc.id);
            return;
          }

          // 3. Try querying employees by uid field
          const q = query(
            collection(db, "employees"),
            where("uid", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const empId = snapshot.docs[0].id;
            setCurrentEmployeeId(empId);
            await checkTodayAttendance(empId);
          }
        } catch (error) {
          console.error("Error fetching employee ID:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Check today's attendance to determine expected type
  const checkTodayAttendance = async (employeeId: string) => {
    try {
      const today = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
      });
      const dateString = new Date(today).toISOString().split("T")[0];

      const checkInQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", employeeId),
        where("date", "==", dateString),
        where("type", "==", "check-in")
      );
      const checkInSnapshot = await getDocs(checkInQuery);

      const checkOutQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", employeeId),
        where("date", "==", dateString),
        where("type", "==", "check-out")
      );
      const checkOutSnapshot = await getDocs(checkOutQuery);

      if (checkInSnapshot.empty) {
        setExpectedAttendanceType("check-in");
      } else if (checkOutSnapshot.empty) {
        setExpectedAttendanceType("check-out");
      } else {
        setExpectedAttendanceType(null); // Already done for today
      }
    } catch (error) {
      console.error("Error checking attendance:", error);
    }
  };

  // Initialize scanner instance
  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }

    return () => {
      // Cleanup on unmount
      if (scannerRef.current && isCameraActive) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Start camera scanning
  const startScanning = async () => {
    if (!scannerRef.current || isCameraActive) return;

    try {
      // Request camera permissions
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        onScanFailure
      );

      setIsCameraActive(true);
      setIsScanning(true);
    } catch (error: any) {
      console.error("Failed to start scanner:", error);
      toast({
        variant: "destructive",
        title: "Error Kamera",
        description:
          "Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin kamera.",
      });
    }
  };

  // Stop camera scanning
  const stopScanning = async () => {
    if (!scannerRef.current || !isCameraActive) return;

    try {
      await scannerRef.current.stop();
      setIsCameraActive(false);
      setIsScanning(false);
    } catch (error) {
      console.error("Failed to stop scanner:", error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !scannerRef.current) return;

    try {
      setProcessing(true);
      const result = await scannerRef.current.scanFile(file, false);
      await onScanSuccess(result, null);
    } catch (error: any) {
      console.error("File scan error:", error);
      toast({
        variant: "destructive",
        title: "Scan Gagal",
        description: "Tidak dapat membaca QR code dari file.",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Helper to get current time in WIB
  const getWIBTime = () => {
    const now = new Date();
    const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const wibDate = new Date(wibString);
    return {
      date: wibDate,
      day: wibDate.getDay(), // 0 = Sunday, 1 = Monday, ...
      hours: wibDate.getHours(),
      minutes: wibDate.getMinutes(),
      dateString: wibDate.toISOString().split("T")[0],
    };
  };

  // List of holidays (YYYY-MM-DD)
  const HOLIDAYS = [
    "2025-01-01", // New Year
    "2025-12-25", // Christmas
    // Add more holidays here
  ];

  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
    if (processing) return;

    // Stop scanning temporarily
    if (isCameraActive) {
      await stopScanning();
    }
    setProcessing(true);

    try {
      const data = JSON.parse(decodedText);
      if (!data.id || !data.name) throw new Error("Invalid QR Code");

      // --- SECURITY CHECK ---
      if (!currentEmployeeId) {
        throw new Error("Gagal memverifikasi akun. Pastikan Anda sudah login.");
      }

      if (data.id !== currentEmployeeId) {
        throw new Error(
          "QR Code ini bukan milik akun Anda. Dilarang menggunakan QR Code orang lain."
        );
      }

      // --- TIME VALIDATION LOGIC (WIB) ---
      const { date, day, hours, minutes, dateString } = getWIBTime();
      const currentTime = hours + minutes / 60; // Decimal hours (e.g., 8.5 for 08:30)

      console.log("🕒 Time Check (WIB):", {
        fullDate: date,
        day,
        hours,
        minutes,
        currentTime,
        dateString,
      });

      // 1. Check Sunday
      if (day === 0) {
        throw new Error("Absensi libur pada hari Minggu.");
      }

      // 2. Check Holidays
      if (HOLIDAYS.includes(dateString)) {
        throw new Error("Absensi libur pada tanggal merah.");
      }

      // 3. Define flexible time windows
      const CHECK_IN_START = 7.5; // 07:30
      const CHECK_IN_END = 11.5; // 11:30
      const CHECK_OUT_START = 15 + 55 / 60; // 15:55
      const CHECK_OUT_END = 18.0; // 18:00

      // Check if employee has already checked in today
      const checkInQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", data.id),
        where("date", "==", dateString),
        where("type", "==", "check-in")
      );
      const checkInSnapshot = await getDocs(checkInQuery);

      // Check if employee has already checked out today
      const checkOutQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", data.id),
        where("date", "==", dateString),
        where("type", "==", "check-out")
      );
      const checkOutSnapshot = await getDocs(checkOutQuery);

      let attendanceType = "check-in";
      let successMessage = `Welcome, ${data.name}! Check-in recorded.`;

      // Determine what type of attendance is allowed based on time and existing records
      if (checkInSnapshot.empty) {
        // No check-in yet - must be check-in time
        if (currentTime < CHECK_IN_START) {
          throw new Error(`Absen masuk belum dibuka. Dimulai pukul 07:30 WIB.`);
        }
        if (currentTime > CHECK_IN_END) {
          throw new Error(
            `Absen masuk sudah ditutup. Berakhir pukul 11:30 WIB.`
          );
        }
        attendanceType = "check-in";
        successMessage = `Selamat Pagi, ${data.name}! Absen Masuk berhasil.`;
      } else if (checkOutSnapshot.empty) {
        // Check-in exists, no check-out yet - must be check-out time
        if (currentTime < CHECK_OUT_START) {
          throw new Error(
            `Absen pulang belum dibuka. Dimulai pukul 15:55 WIB.`
          );
        }
        if (currentTime > CHECK_OUT_END) {
          throw new Error(
            `Absen pulang sudah ditutup. Berakhir pukul 18:00 WIB.`
          );
        }
        attendanceType = "check-out";
        successMessage = `Selamat Jalan, ${data.name}! Absen Pulang berhasil.`;
      } else {
        // Already checked out
        throw new Error("Anda sudah melakukan absen pulang hari ini.");
      }

      // Get Location with high accuracy
      const location = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser"));
          } else {
            // Request high accuracy location with timeout
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, // Use GPS if available
              timeout: 10000, // 10 second timeout
              maximumAge: 0, // Don't use cached position
            });
          }
        }
      );

      const { latitude, longitude } = location.coords;

      // Update scan result to include attendance type
      setScanResult({
        ...data,
        type: attendanceType,
      });

      // Log attendance to Firebase with Location
      await addDoc(collection(db, "attendance"), {
        employeeId: data.id,
        employeeName: data.name,
        division: data.division,
        timestamp: serverTimestamp(), // Server timestamp is safer
        date: dateString,
        type: attendanceType,
        location: {
          latitude,
          longitude,
        },
      });

      // Get current time for display
      const displayTime = new Date().toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Show detailed success toast
      toast({
        title:
          attendanceType === "check-in"
            ? "✅ Absen Masuk Berhasil"
            : "✅ Absen Pulang Berhasil",
        description: `${data.name} - ${data.division}\n${displayTime} WIB`,
        duration: 3000,
      });

      // Auto-reset to scanning mode after 2 seconds
      setTimeout(() => {
        resetScan();
      }, 2000);
    } catch (error: any) {
      console.error("Scan error", error);
      let errorMessage = "Could not recognize employee QR code.";

      if (error.code === 1) {
        // PERMISSION_DENIED
        errorMessage = "Izin lokasi ditolak. Mohon aktifkan layanan lokasi.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setScanResult({ error: errorMessage });

      // Show error toast
      toast({
        variant: "destructive",
        title: "❌ Scan Gagal",
        description: errorMessage,
        duration: 4000,
      });

      // Auto-reset to scanning mode after 3 seconds
      setTimeout(() => {
        resetScan();
      }, 3000);
    } finally {
      setProcessing(false);
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(false);
    // Refresh attendance status
    if (currentEmployeeId) {
      checkTodayAttendance(currentEmployeeId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header - Compact for mobile */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Scan Absensi
        </h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
          Arahkan QR code ke kamera
        </p>
      </div>

      <Card className="overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl">
        <CardContent className="p-0">
          {!scanResult ? (
            <div className="bg-black relative min-h-[350px] md:min-h-[400px] flex flex-col items-center justify-center text-white p-3 md:p-4">
              {/* Scanner Container */}
              <div
                id="reader"
                className={`w-full rounded-lg overflow-hidden ${
                  isCameraActive ? "" : "hidden"
                }`}
              ></div>

              {/* Controls - Show when camera is not active */}
              {!isCameraActive && !processing && (
                <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                  {/* Status Badge */}
                  {expectedAttendanceType && (
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-semibold mb-2 ${
                        expectedAttendanceType === "check-in"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      }`}
                    >
                      {expectedAttendanceType === "check-in"
                        ? "🌅 Absen Masuk"
                        : "🌆 Absen Pulang"}
                    </div>
                  )}

                  {expectedAttendanceType === null && (
                    <div className="px-4 py-2 rounded-full text-sm font-semibold mb-2 bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      ✅ Absen Hari Ini Sudah Selesai
                    </div>
                  )}

                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${
                      expectedAttendanceType === "check-in"
                        ? "bg-green-500/20"
                        : expectedAttendanceType === "check-out"
                        ? "bg-orange-500/20"
                        : "bg-gray-500/20"
                    }`}
                  >
                    <Camera
                      className={`w-10 h-10 ${
                        expectedAttendanceType === "check-in"
                          ? "text-green-400"
                          : expectedAttendanceType === "check-out"
                          ? "text-orange-400"
                          : "text-gray-400"
                      }`}
                    />
                  </div>

                  <Button
                    onClick={startScanning}
                    size="lg"
                    className={`w-full text-base font-semibold ${
                      expectedAttendanceType === "check-in"
                        ? "bg-green-600 hover:bg-green-700"
                        : expectedAttendanceType === "check-out"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : ""
                    }`}
                    disabled={expectedAttendanceType === null}
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    {expectedAttendanceType === "check-in"
                      ? "Scan Absen Masuk"
                      : expectedAttendanceType === "check-out"
                      ? "Scan Absen Pulang"
                      : "Scan"}
                  </Button>

                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 h-px bg-gray-700"></div>
                    <span className="text-xs text-gray-400">ATAU</span>
                    <div className="flex-1 h-px bg-gray-700"></div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="qr-file-input"
                  />
                  <label
                    htmlFor="qr-file-input"
                    className="w-full cursor-pointer"
                  >
                    <div className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-secondary hover:bg-accent text-foreground rounded-lg font-semibold transition-all border-2 border-border">
                      <Upload className="h-5 w-5" />
                      Upload QR Code
                    </div>
                  </label>
                </div>
              )}

              {/* Processing State */}
              {processing && (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-primary" />
                  <p className="text-base md:text-lg font-medium text-gray-300">
                    Memproses...
                  </p>
                </div>
              )}

              {/* Camera Active - Show Stop Button */}
              {isCameraActive && !processing && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <Button
                    onClick={stopScanning}
                    variant="destructive"
                    size="lg"
                    className="shadow-lg"
                  >
                    Stop Scan
                  </Button>
                </div>
              )}

              {/* Hint Text */}
              {isCameraActive && !processing && (
                <p className="text-xs md:text-sm text-gray-400 mt-3 text-center absolute top-4">
                  💡 Pastikan pencahayaan cukup
                </p>
              )}
            </div>
          ) : (
            <div className="min-h-[350px] md:min-h-[400px] flex flex-col items-center justify-center p-4 md:p-8 text-center space-y-4 md:space-y-6 bg-linear-to-br from-gray-50/50 to-gray-100/30 dark:from-gray-900/50 dark:to-gray-800/30">
              {scanResult?.error ? (
                <>
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 animate-in zoom-in duration-300">
                    <AlertTriangle className="h-8 w-8 md:h-10 md:w-10" />
                  </div>
                  <div className="space-y-1 px-2">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                      Gagal
                    </h2>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-sm">
                      {scanResult.error}
                    </p>
                  </div>
                  <Button onClick={resetScan} size="lg" className="mt-2">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Coba Lagi
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-8 w-8 md:h-10 md:w-10" />
                  </div>

                  {/* Success Message - Compact */}
                  <div className="space-y-1 px-2">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                      {scanResult?.type === "check-out"
                        ? "✅ Absen Pulang"
                        : "✅ Absen Masuk"}
                    </h2>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                      {new Date().toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      WIB
                    </p>
                  </div>

                  {/* Info Card - Compact & Clean */}
                  <Card className="w-full max-w-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <CardContent className="p-3 md:p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Nama
                        </span>
                        <p className="font-semibold text-sm md:text-base text-gray-900 dark:text-white">
                          {scanResult?.name}
                        </p>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700"></div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Divisi
                        </span>
                        <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                          {scanResult?.division}
                        </p>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700"></div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Status
                        </span>
                        <span
                          className={`text-xs md:text-sm font-semibold px-2.5 py-1 rounded-full ${
                            scanResult?.type === "check-out"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          }`}
                        >
                          {scanResult?.type === "check-out"
                            ? "Pulang"
                            : "Masuk"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={resetScan}
                    size="lg"
                    className="mt-2 w-full max-w-sm"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Scan Berikutnya
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
