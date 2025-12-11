import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  Camera,
  Upload,
  Zap,
  ZapOff,
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
  const [isSunday, setIsSunday] = useState(false);
  const [isWithinTimeWindow, setIsWithinTimeWindow] = useState(true);
  const [timeMessage, setTimeMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const isProcessingRef = useRef(false); // Immediate flag to prevent duplicate scans
  const { toast } = useToast();

  // Check if it's Sunday and time window on component mount
  useEffect(() => {
    const { day, hours, minutes } = getWIBTime();
    if (day === 0) {
      setIsSunday(true);
      setExpectedAttendanceType(null);
      setIsWithinTimeWindow(false);
      setTimeMessage(null);
    } else {
      setIsSunday(false);
      // Check time window will be done in checkTodayAttendance
    }
  }, []);

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
      // Check if today is Sunday first
      const { day } = getWIBTime();
      if (day === 0) {
        // It's Sunday - disable attendance
        setIsSunday(true);
        setExpectedAttendanceType(null);
        setIsWithinTimeWindow(false);
        setTimeMessage(null);
        return;
      }

      setIsSunday(false);

      const { dateString } = getWIBTime();

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

      // Check time window for check-in
      const { hours, minutes } = getWIBTime();
      const currentTime = hours + minutes / 60;

      // Define check-in time windows
      let CHECK_IN_START = 7.5; // 07:30 - default
      let CHECK_IN_END = 9.0; // 09:00 - default

      if (day === 1) {
        // Monday special hours
        CHECK_IN_START = 8.5; // 08:30
        CHECK_IN_END = 12.0; // 10:00
      }

      if (checkInSnapshot.empty) {
        // No check-in yet - check if within time window
        if (currentTime < CHECK_IN_START) {
          const startTime = day === 1 ? "08:30" : "07:30";
          setIsWithinTimeWindow(false);
          setTimeMessage(
            `Absen masuk belum dibuka. Dimulai pukul ${startTime} WIB.`
          );
          setExpectedAttendanceType("check-in"); // Still set type but disable button
        } else if (currentTime > CHECK_IN_END) {
          const endTime = day === 1 ? "12:00" : "09:00";
          setIsWithinTimeWindow(false);
          setTimeMessage(
            `Absen masuk sudah ditutup. Berakhir pukul ${endTime} WIB.`
          );
          setExpectedAttendanceType(null);
        } else {
          setIsWithinTimeWindow(true);
          setTimeMessage(null);
          setExpectedAttendanceType("check-in");
        }
      } else if (checkOutSnapshot.empty) {
        // Check-in exists, check check-out time window
        let CHECK_OUT_START = 15.5; // 15:30 - default
        let CHECK_OUT_END = 16.5; // 16:30 - default

        if (day === 6) {
          // Saturday special hours
          CHECK_OUT_START = 11.5; // 11:30
          CHECK_OUT_END = 12.5; // 12:30
        }

        if (currentTime < CHECK_OUT_START) {
          const startTime = day === 6 ? "11:30" : "15:30";
          setIsWithinTimeWindow(false);
          setTimeMessage(
            `Absen pulang belum dibuka. Dimulai pukul ${startTime} WIB.`
          );
          setExpectedAttendanceType("check-out"); // Still set type but disable button
        } else if (currentTime > CHECK_OUT_END) {
          const endTime = day === 6 ? "12:30" : "16:30";
          setIsWithinTimeWindow(false);
          setTimeMessage(
            `Absen pulang sudah ditutup. Berakhir pukul ${endTime} WIB.`
          );
          setExpectedAttendanceType(null);
        } else {
          setIsWithinTimeWindow(true);
          setTimeMessage(null);
          setExpectedAttendanceType("check-out");
        }
      } else {
        // Already done for today
        // Already done for today
        setIsWithinTimeWindow(false);
        setTimeMessage(null);
        setExpectedAttendanceType(null);
      }
    } catch (error) {
      console.error("Error checking attendance:", error);
    }
  };

  // Initialize scanner instance only once
  useEffect(() => {
    if (!isInitializedRef.current) {
      try {
        scannerRef.current = new Html5Qrcode("reader");
        isInitializedRef.current = true;
        console.log("📷 Scanner instance created");
      } catch (error) {
        console.error("Error creating scanner:", error);
      }
    }

    return () => {
      // Cleanup on unmount
      if (scannerRef.current && isCameraActive) {
        console.log("🧹 Cleaning up scanner...");
        scannerRef.current
          .stop()
          .then(() => {
            console.log("✅ Scanner stopped successfully");
          })
          .catch((err) => {
            console.error("⚠️ Error stopping scanner:", err);
          });
      }
    };
  }, []);

  // Start camera scanning
  const startScanning = async () => {
    if (!scannerRef.current || isCameraActive || processing) {
      console.log("⚠️ Cannot start: scanner not ready or already active");
      return;
    }

    setProcessing(true);
    // Give React time to render the visible container so html5-qrcode can attach correctly
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("🎥 Starting camera...");

    try {
      // Simple approach: try rear camera first, then front
      const cameraConfigs = [
        { facingMode: "environment" }, // Rear camera
        { facingMode: "user" }, // Front camera fallback
      ];

      let started = false;

      for (const config of cameraConfigs) {
        try {
          console.log(`🔄 Trying camera with config:`, config);

          // Calculate optimal qrbox size based on screen width
          const screenWidth = window.innerWidth;
          const qrboxSize = Math.min(screenWidth * 0.7, 300); // 70% of screen width, max 300px

          await scannerRef.current.start(
            config,
            {
              fps: 30, // Increased FPS for better detection
              qrbox: qrboxSize, // Use calculated size
              aspectRatio: 1.0, // Square aspect ratio
              disableFlip: false, // Allow flipping for better detection
            },
            onScanSuccess,
            onScanFailure
          );

          started = true;
          console.log("✅ Camera started successfully with qrbox:", qrboxSize);
          break;
        } catch (err: any) {
          console.log(`⚠️ Failed with this config:`, err.message);
          // Continue to next config
        }
      }

      if (!started) {
        throw new Error("Tidak dapat memulai kamera");
      }

      setIsCameraActive(true);
      setIsScanning(true);
    } catch (error: any) {
      console.error("❌ Failed to start scanner:", error);

      let errorMessage = "Tidak dapat mengakses kamera.";

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage =
          "Izin kamera ditolak. Silakan aktifkan izin kamera di pengaturan browser.";
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        errorMessage = "Kamera tidak ditemukan pada perangkat Anda.";
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        errorMessage = "Kamera sedang digunakan oleh aplikasi lain.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Error Kamera",
        description: errorMessage,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Stop camera scanning
  const stopScanning = async () => {
    if (!scannerRef.current) return;

    try {
      console.log("🛑 Stopping scanner...");
      // Turn off torch if on
      if (torchOn) {
        try {
          await scannerRef.current.applyVideoConstraints({
            advanced: [{ torch: false } as any],
          });
          setTorchOn(false);
        } catch (err) {
          console.warn("Could not turn off torch:", err);
        }
      }

      await scannerRef.current.stop();
      setIsCameraActive(false);
      setIsScanning(false);
      console.log("✅ Scanner stopped successfully");
    } catch (error) {
      console.error("❌ Failed to stop scanner:", error);
      // Force reset state even if stop fails
      setIsCameraActive(false);
      setIsScanning(false);
    }
  };

  // Toggle Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !isCameraActive) return;

    try {
      const newTorchState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState } as any],
      });
      setTorchOn(newTorchState);
    } catch (error) {
      console.error("Torch error:", error);
      toast({
        variant: "destructive",
        title: "Fitur Tidak Tersedia",
        description: "Flashlight tidak didukung di perangkat/browser ini.",
      });
    }
  };

  // Handle Tap to Focus
  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scannerRef.current || !isCameraActive) return;

    // Visual feedback
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusPoint({ x, y });

    // Remove visual feedback after animation
    setTimeout(() => setFocusPoint(null), 1000);

    try {
      // Attempt to trigger focus by re-applying continuous focus mode
      // Note: Specific point focus (x,y) is not widely supported in WebRTC yet
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ focusMode: "continuous" } as any],
      });
      console.log("🎯 Focus triggered");
    } catch (error) {
      console.warn("Focus adjust not supported:", error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !scannerRef.current) return;

    // Check if already processing
    if (isProcessingRef.current || processing) {
      console.log("⚠️ Already processing, ignoring file upload");
      return;
    }

    try {
      setProcessing(true);
      const result = await scannerRef.current.scanFile(file, false);
      // onScanSuccess will handle isProcessingRef
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
    const year = wibDate.getFullYear();
    const month = String(wibDate.getMonth() + 1).padStart(2, "0");
    const dayDate = String(wibDate.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${dayDate}`;

    return {
      date: wibDate,
      day: wibDate.getDay(), // 0 = Sunday, 1 = Monday, ...
      hours: wibDate.getHours(),
      minutes: wibDate.getMinutes(),
      dateString: dateString,
    };
  };

  // List of holidays (YYYY-MM-DD)
  const HOLIDAYS = [
    "2025-01-01", // New Year
    "2025-12-25", // Christmas
    // Add more holidays here
  ];

  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
    // IMMEDIATE CHECK - Use ref to prevent race conditions
    if (isProcessingRef.current) {
      console.log("⚠️ Already processing, ignoring duplicate scan");
      return;
    }

    // Set ref immediately (synchronous)
    isProcessingRef.current = true;

    // Also check state-based processing
    if (processing) {
      isProcessingRef.current = false;
      return;
    }

    // Stop scanning immediately to prevent more scans
    if (isCameraActive && scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setIsCameraActive(false);
        setIsScanning(false);
        console.log("✅ Camera stopped after scan");
      } catch (err) {
        console.error("⚠️ Error stopping camera:", err);
      }
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

      // 3. Define flexible time windows (in WIB)
      // Monday (day === 1): 08:30 - 10:00
      // Other days: 07:30 - 09:00
      let CHECK_IN_START = 7.5; // 07:30 - default
      let CHECK_IN_END = 9.0; // 09:00 - default

      if (day === 1) {
        // Monday special hours
        CHECK_IN_START = 8.5; // 08:30
        CHECK_IN_END = 10.0; // 10:00
      }

      // Check-out time depends on day of week
      // Saturday (day === 6): 11:30 - 12:30
      // Other days: 15:30 - 16:30
      let CHECK_OUT_START = 15.5; // 15:30 (3:30pm) - default
      let CHECK_OUT_END = 16.5; // 16:30 (4:30pm) - default

      if (day === 6) {
        // Saturday special hours
        CHECK_OUT_START = 11.5; // 11:30
        CHECK_OUT_END = 12.5; // 12:30
      }

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
        // Format time for error messages
        const checkInStartTime = day === 1 ? "08:30" : "07:30";
        const checkInEndTime = day === 1 ? "10:00" : "09:00";

        if (currentTime < CHECK_IN_START) {
          throw new Error(
            `Absen masuk belum dibuka. Dimulai pukul ${checkInStartTime} WIB.`
          );
        }
        if (currentTime > CHECK_IN_END) {
          throw new Error(
            `Absen masuk sudah ditutup. Berakhir pukul ${checkInEndTime} WIB.`
          );
        }
        attendanceType = "check-in";
        successMessage = `Selamat Pagi, ${data.name}! Absen Masuk berhasil.`;
      } else if (checkOutSnapshot.empty) {
        // Check-in exists, no check-out yet - must be check-out time
        const checkOutStartTime = day === 6 ? "11:30" : "15:30";
        const checkOutEndTime = day === 6 ? "12:30" : "16:30";

        if (currentTime < CHECK_OUT_START) {
          throw new Error(
            `Absen pulang belum dibuka. Dimulai pukul ${checkOutStartTime} WIB.`
          );
        }
        if (currentTime > CHECK_OUT_END) {
          throw new Error(
            `Absen pulang sudah ditutup. Berakhir pukul ${checkOutEndTime} WIB.`
          );
        }
        attendanceType = "check-out";
        successMessage = `Selamat Jalan, ${data.name}! Absen Pulang berhasil.`;
      } else {
        // Already checked out
        throw new Error("Semoga Harimu Menyenangkan 🤗");
      }

      // Get Location - Try to get location but don't block attendance
      let latitude = -6.2; // Default Jakarta coordinates
      let longitude = 106.816666;
      let locationObtained = false;

      if (navigator.geolocation) {
        try {
          console.log("📍 Attempting to get location (non-blocking)...");

          // Try low accuracy first (faster and more reliable)
          const locationPromise = new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  resolve(position);
                },
                (error) => {
                  reject(error);
                },
                {
                  enableHighAccuracy: false, // Use network/wifi location (faster)
                  timeout: 8000, // 8 second timeout
                  maximumAge: 60000, // Accept cached position up to 60 seconds old
                }
              );
            }
          );

          // Race between location and timeout - but don't fail if location times out
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 8000)
          );

          const result = await Promise.race([locationPromise, timeoutPromise]);

          if (result) {
            latitude = result.coords.latitude;
            longitude = result.coords.longitude;
            locationObtained = true;
            console.log("✅ Location obtained:", { latitude, longitude });
          } else {
            console.warn("⚠️ Location timeout, using default location");
          }
        } catch (locationError: any) {
          console.warn(
            "⚠️ Location error (using default):",
            locationError.message || locationError.code
          );
          // Keep default location - don't fail attendance
        }
      } else {
        console.warn("⚠️ Geolocation not supported, using default location");
      }

      // Update scan result to include attendance type
      setScanResult({
        ...data,
        type: attendanceType,
      });

      // Log attendance to Firebase with Location
      const attendanceData: any = {
        employeeId: data.id,
        employeeName: data.name,
        division: data.division,
        timestamp: serverTimestamp(), // Server timestamp is safer
        date: dateString,
        type: attendanceType,
        location: {
          latitude,
          longitude,
          accuracy: locationObtained ? "high/low" : "default",
          obtained: locationObtained,
        },
      };

      console.log("📍 Saving attendance with location:", attendanceData);

      try {
        const docRef = await addDoc(
          collection(db, "attendance"),
          attendanceData
        );
        console.log(
          "✅ Attendance saved successfully to Firebase with ID:",
          docRef.id
        );
      } catch (saveError: any) {
        console.error("❌ Error saving to Firebase:", saveError);
        throw new Error(
          `Gagal menyimpan data absensi: ${
            saveError.message || "Unknown error"
          }`
        );
      }

      // Get current time for display
      const displayTime = new Date().toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Show detailed success toast
      const locationStatus = locationObtained
        ? "📍 Lokasi: Terdeteksi"
        : "📍 Lokasi: Default (GPS tidak tersedia)";

      toast({
        title:
          attendanceType === "check-in"
            ? "✅ Absen Masuk Berhasil"
            : "✅ Absen Pulang Berhasil",
        description: `${data.name} - ${data.division}\n${displayTime} WIB\n${locationStatus}\n✓ Data tersimpan ke database`,
        duration: 5000,
      });

      // Refresh attendance status immediately after successful save
      await checkTodayAttendance(data.id);

      // Auto-reset to scanning mode after 2 seconds
      setTimeout(() => {
        resetScan();
      }, 2000);
    } catch (error: any) {
      console.error("❌ Scan error:", error);
      let errorMessage = "Could not recognize employee QR code.";

      // Process error message
      if (error.message) {
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
      // Reset the ref flag
      isProcessingRef.current = false;
    }
  };

  const onScanFailure = (error: any) => {
    // Silently handle scan failures (no QR code detected yet)
    // Only log occasionally to avoid console spam
    if (Math.random() < 0.01) {
      console.log("🔍 Scanning for QR code...");
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(false);
    isProcessingRef.current = false; // Reset processing flag
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
              <div className="relative w-full">
                <div
                  id="reader"
                  className={`w-full rounded-lg overflow-hidden min-h-[300px] ${
                    isCameraActive || processing ? "" : "hidden"
                  }`}
                ></div>

                {/* Camera Overlays */}
                {isCameraActive && !processing && (
                  <>
                    {/* Tap to Focus Area */}
                    <div
                      className="absolute inset-0 z-10 cursor-crosshair"
                      onClick={handleTapToFocus}
                    >
                      {/* Focus Indicator */}
                      {focusPoint && (
                        <div
                          className="absolute w-16 h-16 border-2 border-yellow-400 rounded-sm transform -translate-x-1/2 -translate-y-1/2 animate-ping pointer-events-none"
                          style={{
                            left: focusPoint.x,
                            top: focusPoint.y,
                          }}
                        />
                      )}
                    </div>

                    {/* Flashlight Button */}
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-4 right-4 z-20 bg-black/50 text-white hover:bg-black/70 border border-white/20"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent focus trigger
                        toggleTorch();
                      }}
                    >
                      {torchOn ? (
                        <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      ) : (
                        <ZapOff className="h-5 w-5" />
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* Controls - Show when camera is not active */}
              {!isCameraActive && !processing && (
                <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                  {/* Status Badge */}
                  {isSunday ? (
                    <div className="px-4 py-2 rounded-full text-sm font-semibold mb-2 bg-red-500/20 text-red-400 border border-red-500/30">
                      🚫 Hari Minggu - Absensi Libur
                    </div>
                  ) : timeMessage ? (
                    <div className="px-4 py-2 rounded-full text-sm font-semibold mb-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      ⏰ {timeMessage}
                    </div>
                  ) : expectedAttendanceType ? (
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
                  ) : (
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
                      isSunday || !isWithinTimeWindow
                        ? "bg-gray-500 cursor-not-allowed"
                        : expectedAttendanceType === "check-in"
                        ? "bg-green-600 hover:bg-green-700"
                        : expectedAttendanceType === "check-out"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : ""
                    }`}
                    disabled={
                      isSunday ||
                      !isWithinTimeWindow ||
                      expectedAttendanceType === null ||
                      processing
                    }
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memulai Kamera...
                      </>
                    ) : isSunday ? (
                      <>
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Absens Gak Tersedia (Hari Libur)
                      </>
                    ) : !isWithinTimeWindow ? (
                      <>
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Belum Waktunya Scan
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-5 w-5" />
                        {expectedAttendanceType === "check-in"
                          ? "Scan Absen Masuk"
                          : expectedAttendanceType === "check-out"
                          ? "Scan Absen Pulang"
                          : "Scan"}
                      </>
                    )}
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
