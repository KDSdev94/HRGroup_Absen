import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  Clock,
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
  const [isScanning, setIsScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(
    null
  );
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

  // Fetch logged-in user's employee ID
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Try users collection
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().employeeId) {
            setCurrentEmployeeId(userDoc.data().employeeId);
            return;
          }

          // 2. Try employees collection (doc ID = UID)
          const empDoc = await getDoc(doc(db, "employees", user.uid));
          if (empDoc.exists()) {
            setCurrentEmployeeId(empDoc.id);
            return;
          }

          // 3. Try querying employees by uid field
          const q = query(
            collection(db, "employees"),
            where("uid", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setCurrentEmployeeId(snapshot.docs[0].id);
          }
        } catch (error) {
          console.error("Error fetching employee ID:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Initialize scanner only if we are in scanning mode and haven't initialized yet
    if (isScanning && !scannerRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            "reader",
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
              // Add explicit camera constraint for HTTPS/Netlify compatibility
              disableFlip: false,
            },
            /* verbose= */ false
          );

          scanner.render(onScanSuccess, onScanFailure);
          scannerRef.current = scanner;
        } catch (error) {
          console.error("Failed to initialize scanner:", error);
          toast({
            variant: "destructive",
            title: "Camera Error",
            description:
              "Could not access camera. Please check permissions and ensure HTTPS is enabled.",
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    // Cleanup function
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning, toast, currentEmployeeId]);

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
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
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

      // 3. Check Operating Hours
      let startTime = 8.0; // 08:00 WIB
      let endTime = 16.0; // 16:00 WIB

      if (day === 6) {
        // Saturday
        endTime = 12.0; // 12:00 WIB
      }

      console.log(`🕒 Operating Hours: ${startTime}:00 - ${endTime}:00`);

      if (currentTime < startTime) {
        throw new Error(`Absensi belum dibuka. Dimulai pukul 08:00 WIB.`);
      }

      if (currentTime > endTime) {
        throw new Error(
          `Absensi sudah ditutup. Berakhir pukul ${
            day === 6 ? "12:00" : "16:00"
          } WIB.`
        );
      }

      // Get Location
      const location = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser"));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        }
      );

      const { latitude, longitude } = location.coords;

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

      // Logic:
      // - If no check-in -> Check-in
      // - If check-in exists but no check-out -> Check-out
      // - If check-out exists -> Error (Already done)

      if (checkInSnapshot.empty) {
        // First scan of the day: Check-in
        attendanceType = "check-in";
        successMessage = `Selamat Pagi, ${data.name}! Absen Masuk berhasil.`;
      } else if (checkOutSnapshot.empty) {
        // Second scan of the day: Check-out
        attendanceType = "check-out";
        successMessage = `Selamat Jalan, ${data.name}! Absen Pulang berhasil.`;
      } else {
        // Already checked out
        throw new Error("Anda sudah melakukan absen pulang hari ini.");
      }

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

      toast({
        title:
          attendanceType === "check-in"
            ? "Check In Berhasil"
            : "Check Out Berhasil",
        description: successMessage,
      });
    } catch (error: any) {
      console.error("Scan error", error);
      let errorMessage = "Could not recognize employee QR code.";

      if (error.code === 1) {
        // PERMISSION_DENIED
        errorMessage =
          "Location permission denied. Please enable location services.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setScanResult({ error: errorMessage });
      toast({
        variant: "destructive",
        title: "Scan Gagal",
        description: errorMessage,
      });
    } finally {
      setProcessing(false);
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Scan Attendance
        </h1>
        <p className="text-gray-500 mt-2">
          Place the QR code within the frame to check in/out.
        </p>
      </div>

      <Card className="overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl">
        <CardContent className="p-0">
          {isScanning ? (
            <div className="bg-black relative min-h-[400px] flex flex-col items-center justify-center text-white p-4">
              <div
                id="reader"
                className="w-full rounded-lg overflow-hidden"
              ></div>
              <p className="text-sm text-gray-400 mt-4 text-center">
                Ensure good lighting for best results
              </p>
            </div>
          ) : (
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-gray-50/50">
              {processing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium text-gray-600">
                    Processing attendance...
                  </p>
                </div>
              ) : scanResult?.error ? (
                <>
                  <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                    <AlertTriangle className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Scan Failed
                    </h2>
                    <p className="text-gray-500 mt-1">{scanResult.error}</p>
                  </div>
                  <Button onClick={resetScan} size="lg" className="mt-4">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {scanResult?.type === "check-out"
                        ? "Check Out Successful!"
                        : "Check In Successful!"}
                    </h2>
                    <p className="text-gray-500 mt-1">
                      {scanResult?.type === "check-out"
                        ? "Goodbye!"
                        : "Welcome!"}
                      {" Recorded at "}
                      {new Date().toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  </div>

                  <Card className="w-full max-w-xs border-dashed bg-white">
                    <CardContent className="p-4 text-left space-y-2">
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Name
                        </span>
                        <p className="font-medium">{scanResult?.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Division
                        </span>
                        <p className="text-sm">{scanResult?.division}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Employee ID
                        </span>
                        <p className="font-mono text-xs text-gray-600">
                          {scanResult?.id}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Type
                        </span>
                        <p className="font-medium">
                          {scanResult?.type === "check-out"
                            ? "Check Out"
                            : "Check In"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button onClick={resetScan} size="lg" className="mt-4">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Scan Next
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
