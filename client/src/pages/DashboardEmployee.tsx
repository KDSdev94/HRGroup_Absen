import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

export default function DashboardEmployee() {
  const [employeeStats, setEmployeeStats] = useState<any>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    try {
      if (!auth.currentUser) {
        console.error("❌ No authenticated user found");
        setLoading(false);
        return;
      }

      // STEP 1: Get employeeId using multiple fallback methods (same as AttendanceHistory)
      let employeeId: string | null = null;
      let employeeInfo: any = null;

      console.log(
        "🔍 Starting employee data fetch for user:",
        auth.currentUser.uid
      );
      console.log("📧 User email:", auth.currentUser.email);

      // Try to get employeeId from the users collection
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        console.log("👤 User doc exists:", userDoc.exists());
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("📄 User data from users collection:", userData);
          employeeId = userData.employeeId || userDoc.id;
          employeeInfo = userData;
          console.log("✅ Got employeeId from users collection:", employeeId);
          console.log("✅ Employee info from users:", {
            name: employeeInfo?.name,
            division: employeeInfo?.division,
          });
        }
      } catch (error) {
        console.log("❌ User profile not found in users collection:", error);
      }

      // If not found in users, try to find employee document with matching UID
      if (!employeeId) {
        console.log("🔄 Trying employees collection by UID...");
        try {
          const empDoc = await getDoc(
            doc(db, "employees", auth.currentUser.uid)
          );
          console.log("👥 Employee doc exists (by UID):", empDoc.exists());
          if (empDoc.exists()) {
            employeeId = empDoc.id;
            const empData = empDoc.data();
            console.log("📄 Employee data (by UID):", empData);
            // Merge employee data with user data
            employeeInfo = { ...employeeInfo, ...empData };
            console.log("✅ Merged employee info:", {
              name: employeeInfo?.name,
              division: employeeInfo?.division,
            });
          }
        } catch (error) {
          console.log(
            "❌ Employee doc not found in employees collection:",
            error
          );
        }
      }

      // If still not found, query employees collection where uid matches
      if (!employeeId) {
        console.log("🔄 Trying employees query by uid field...");
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("uid", "==", auth.currentUser.uid)
          );
          const empSnapshot = await getDocs(empQuery);
          console.log(
            "👥 Employee query results:",
            empSnapshot.size,
            "documents"
          );
          if (!empSnapshot.empty) {
            employeeId = empSnapshot.docs[0].id;
            const empData = empSnapshot.docs[0].data();
            console.log("📄 Employee data (by query):", empData);
            employeeInfo = { ...employeeInfo, ...empData };
            console.log("✅ Merged employee info:", {
              name: employeeInfo?.name,
              division: employeeInfo?.division,
            });
          }
        } catch (error) {
          console.log("❌ No employee found by UID query:", error);
        }
      }

      // If still no employeeId, try to get it from employee's document fields by email
      if (!employeeId) {
        console.log("🔄 Trying employees query by email...");
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("email", "==", auth.currentUser.email)
          );
          const empSnapshot = await getDocs(empQuery);
          console.log(
            "👥 Employee query by email results:",
            empSnapshot.size,
            "documents"
          );
          if (!empSnapshot.empty) {
            employeeId = empSnapshot.docs[0].id;
            const empData = empSnapshot.docs[0].data();
            console.log("📄 Employee data (by email):", empData);
            employeeInfo = { ...employeeInfo, ...empData };
            console.log("✅ Merged employee info:", {
              name: employeeInfo?.name,
              division: employeeInfo?.division,
            });
          }
        } catch (error) {
          console.log("❌ No employee found by email query:", error);
        }
      }

      // If still no employeeId, use UID as fallback
      if (!employeeId) {
        console.log("⚠️ Using UID as fallback employeeId");
        employeeId = auth.currentUser.uid;
      }

      // If we have employeeId but no employeeInfo, fetch it
      if (employeeId && !employeeInfo) {
        console.log("🔄 Fetching employee info for employeeId:", employeeId);
        try {
          const empDoc = await getDoc(doc(db, "employees", employeeId));
          console.log("👥 Employee doc exists (final fetch):", empDoc.exists());
          if (empDoc.exists()) {
            const empData = empDoc.data();
            console.log("📄 Employee data (final fetch):", empData);
            employeeInfo = empData;
          }
        } catch (error) {
          console.log("❌ Could not fetch employee info:", error);
        }
      }

      console.log("🎯 Final employeeId:", employeeId);
      console.log("🎯 Final employeeInfo:", employeeInfo);

      // If we have employeeId but missing name or division, try to get it from employees collection
      if (employeeId && (!employeeInfo?.name || !employeeInfo?.division)) {
        console.log(
          "⚠️ Missing name or division, fetching from employees collection by employeeId:",
          employeeId
        );
        try {
          const empDoc = await getDoc(doc(db, "employees", employeeId));
          console.log(
            "👥 Employee doc exists (by employeeId):",
            empDoc.exists()
          );
          if (empDoc.exists()) {
            const empData = empDoc.data();
            console.log("📄 Employee data (by employeeId):", empData);
            // Merge with existing employeeInfo, prioritizing employee collection data
            employeeInfo = { ...employeeInfo, ...empData };
            console.log("✅ Updated employee info:", {
              name: employeeInfo?.name,
              division: employeeInfo?.division,
            });
          }
        } catch (error) {
          console.log("❌ Could not fetch employee by employeeId:", error);
        }
      }

      console.log("🎯 FINAL employeeInfo after all checks:", employeeInfo);

      // STEP 2: Query attendance with the found employeeId
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

      // Execute attendance and permissions queries in parallel
      const [
        todayAttendanceSnapshot,
        recentSnapshot,
        todayPermissionsSnapshot,
      ] = await Promise.all([
        // Query today's attendance
        getDocs(
          query(
            collection(db, "attendance"),
            where("employeeId", "==", employeeId),
            where("date", "==", today)
          )
        ),
        // Query all attendance for this employee (filter by date on client side)
        getDocs(
          query(
            collection(db, "attendance"),
            where("employeeId", "==", employeeId),
            limit(50) // Get last 50 records, filter client-side
          )
        ),
        // Query today's permissions
        getDocs(
          query(
            collection(db, "permissions"),
            where("employeeId", "==", employeeId),
            where("date", "==", today)
          )
        ),
      ]);

      // Process today's attendance
      // Check current time to determine if we should mark as absent
      const now = new Date();
      const wibString = now.toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
      });
      const wibDate = new Date(wibString);
      const currentHour = wibDate.getHours();
      const currentMinute = wibDate.getMinutes();
      const currentTime = currentHour + currentMinute / 60;
      const currentDay = wibDate.getDay();

      // Determine check-in end time based on day
      let checkInEndTime = 9.0; // 09:00 for Tue-Sat
      if (currentDay === 1) {
        checkInEndTime = 10.0; // 10:00 for Monday
      }

      // Default status: if still within check-in time, show "pending", otherwise "absent"
      let status = currentTime <= checkInEndTime ? "pending" : "absent";
      let checkInTime = null;
      let checkOutTime = null;
      let isLate = false;
      let permissionType = null;

      // Check permissions first
      if (!todayPermissionsSnapshot.empty) {
        const permissionData = todayPermissionsSnapshot.docs[0].data();
        // If there is a permission, set status to permission type regardless of approval status (as requested)
        // Or we can check status if needed. User said "SAAT ORANG TERNYATA UDAH SCAN ABSEN TAPI ABIS ITU MILIH ISI IZIN MAKA TAMPILAN DI DASHBOARD PESERTA/KARYAWAN BUKAN HADIR TAPI IZIN"
        // This implies immediate feedback.
        status = "permission";
        permissionType = permissionData.type; // sakit, izin, lainnya
      }

      // If no permission, check attendance
      if (status !== "permission") {
        todayAttendanceSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.type === "check-in") {
            status = "present";
            checkInTime = data.timestamp;

            // Handle different timestamp formats
            let timeStr = "00:00:00";
            if (data.timestamp) {
              // If it's a Firestore Timestamp object
              if (
                data.timestamp.toDate &&
                typeof data.timestamp.toDate === "function"
              ) {
                const date = data.timestamp.toDate();
                timeStr = date.toTimeString().split(" ")[0]; // Get HH:MM:SS
              }
              // If it's a timestamp with seconds property
              else if (data.timestamp.seconds) {
                const date = new Date(data.timestamp.seconds * 1000);
                timeStr = date.toTimeString().split(" ")[0];
              }
              // If it's already a string
              else if (typeof data.timestamp === "string") {
                timeStr = data.timestamp.split("T")[1] || "00:00:00";
              }
            }

            let threshold = "09:00:00";
            if (data.timestamp) {
              let date: Date | null = null;
              if (data.timestamp.toDate) date = data.timestamp.toDate();
              else if (data.timestamp.seconds)
                date = new Date(data.timestamp.seconds * 1000);
              else if (typeof data.timestamp === "string")
                date = new Date(data.timestamp);

              if (date && date.getDay() === 1) threshold = "10:00:00";
            }

            if (timeStr > threshold) {
              isLate = true;
            }
          } else if (data.type === "check-out") {
            checkOutTime = data.timestamp;
          }
        });
      } else {
        // If permission exists, we still might want to show check-in time if they scanned before permission?
        // User said "SAAT ORANG TERNYATA UDAH SCAN ABSEN TAPI ABIS ITU MILIH ISI IZIN MAKA TAMPILAN DI DASHBOARD PESERTA/KARYAWAN BUKAN HADIR TAPI IZIN"
        // So we prioritize permission status, but maybe we can still show times if they exist.
        todayAttendanceSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.type === "check-in") {
            checkInTime = data.timestamp;
          } else if (data.type === "check-out") {
            checkOutTime = data.timestamp;
          }
        });
      }

      // Process recent attendance and sort on client side
      const recentData = recentSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return data;
        })
        .filter((data) => {
          // Filter to only last 7 days on client side
          return data.date >= sevenDaysAgoStr;
        })
        .reduce((acc: any[], curr) => {
          const existing = acc.find((a) => a.date === curr.date);
          if (!existing) {
            acc.push(curr);
          }
          return acc;
        }, [])
        .sort((a, b) => {
          // Sort by date descending (newest first)
          return b.date.localeCompare(a.date);
        })
        .slice(0, 10); // Limit to 10 most recent

      const stats = {
        name:
          employeeInfo?.name ||
          auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "User",
        division: employeeInfo?.division || "Unknown",
        status,
        checkInTime,
        checkOutTime,
        isLate,
        permissionType,
      };

      console.log("📊 Final stats object:", stats);
      console.log("👤 Name being used:", stats.name);
      console.log("🏢 Division being used:", stats.division);

      setEmployeeStats(stats);
      setRecentAttendance(recentData);
    } catch (error) {
      console.error("❌ Error fetching employee data:", error);
      // Set default stats even on error so UI doesn't stay in loading state
      setEmployeeStats({
        name:
          auth.currentUser?.displayName ||
          auth.currentUser?.email?.split("@")[0] ||
          "User",
        division: "Unknown",
        status: "absent",
        checkInTime: null,
        checkOutTime: null,
        isLate: false,
        permissionType: null,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !employeeStats) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="h-8 sm:h-10 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-3 sm:gap-4 grid-cols-1">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 sm:h-40 bg-gray-200 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (
    status: string,
    isLate: boolean,
    permissionType?: string
  ) => {
    if (status === "permission") {
      let label = "Izin";
      if (permissionType === "sakit") label = "Sakit";
      else if (permissionType === "izin") label = "Izin";
      else if (permissionType === "lainnya") label = "Izin Lainnya";

      return { bg: "bg-blue-100", text: "text-blue-800", label: label };
    }
    if (status === "pending")
      return { bg: "bg-gray-100", text: "text-gray-800", label: "Belum Absen" };
    if (status === "absent")
      return { bg: "bg-red-100", text: "text-red-800", label: "Tidak Hadir" };
    if (isLate)
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        label: "Terlambat",
      };
    return {
      bg: "bg-green-100",
      text: "text-green-800",
      label: "Hadir Tepat Waktu",
    };
  };

  const statusColor = getStatusColor(
    employeeStats.status,
    employeeStats.isLate,
    employeeStats.permissionType
  );

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "-";

    let date: Date;

    // Handle different timestamp formats
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      // Firestore Timestamp object
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      // Timestamp with seconds property
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === "string") {
      // ISO string
      date = new Date(timestamp);
    } else {
      return "-";
    }

    return (
      date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB"
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 sm:space-y-2">
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight transition-transform hover:scale-[1.02]
               animate-in fade-in slide-in-from-left-3 duration-400 "
          >
            Halo,{" "}
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
              {employeeStats.name}
            </span>
            !{" "}
            <span className="inline-block animate-wave origin-[70%_70%]">
              👋
            </span>
          </h1>

          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Welkam di dashboard absensimu –{" "}
            <span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-0.5 text-indigo-600 dark:text-indigo-400 font-medium">
              {employeeStats.division}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/permission-request">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Ajukan Izin</span>
            </Button>
          </Link>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Info className="h-5 w-5 text-blue-600" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ketentuan Absensi</DialogTitle>
                <DialogDescription>
                  Informasi jadwal dan aturan penggunaan aplikasi absensi.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    Jadwal Absen Masuk
                  </h3>
                  <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                    <li className="flex justify-between">
                      <span>Senin:</span>
                      <span className="font-medium">08:30 - 10:00 WIB</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Selasa - Sabtu:</span>
                      <span className="font-medium">07:30 - 09:00 WIB</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-800">
                  <h3 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">
                    Jadwal Absen Pulang
                  </h3>
                  <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                    <li className="flex justify-between">
                      <span>Senin - Jumat:</span>
                      <span className="font-medium">15:30 - 16:30 WIB</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Sabtu:</span>
                      <span className="font-medium">11:30 - 12:30 WIB</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Ketentuan Keterlambatan
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Jika Anda melakukan scan masuk{" "}
                    <strong>
                      melewati batas waktu <em className="italic">check-in</em>
                    </strong>{" "}
                    (misal: lewat jam 10:00 WIB), sistem akan tetap mencatat
                    kehadiranmu namun statusnya akan ditandai sebagai{" "}
                    <strong>"Terlambat"</strong>.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Syarat Melakukan Scan
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    <li>Wajib izinkan akses lokasi pada browser.</li>
                    <li>Wajib izinkan akses kamera pada browser.</li>
                    <li>QR Code harus sesuai dengan akun Anda.</li>
                    <li>Pastikan koneksi internet stabil.</li>
                  </ul>
                </div>

                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 italic">
                  Mohon maaf jika nama lokasi kurang akurat karena tidak
                  menggunakan data dari Google Maps (Developer tidak memiliki
                  dana untuk membeli API-nya) 😁.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Today */}
      <Card
        className="border-t-4 shadow-md hover:shadow-lg transition-shadow"
        style={{
          borderTopColor:
            statusColor.bg.split("-")[1] === "red"
              ? "#ef4444"
              : statusColor.bg.split("-")[1] === "orange"
              ? "#f59e0b"
              : statusColor.bg.split("-")[1] === "blue"
              ? "#3b82f6"
              : "#10b981",
        }}
      >
        <CardHeader className="px-5 sm:px-6 py-5 sm:py-6">
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-lg sm:text-xl font-bold">
              Status Kehadiran Hari Ini
            </span>
            <span
              className={`text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full whitespace-nowrap ${statusColor.bg} ${statusColor.text} shadow-sm`}
            >
              {statusColor.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-linier-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-700">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">
                Jam Masuk
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {formatTime(employeeStats.checkInTime)}
              </p>
            </div>
            <div className="bg-linier-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-700">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">
                Jam Keluar
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {formatTime(employeeStats.checkOutTime)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card className="shadow-md">
        <CardHeader className="px-5 sm:px-6 py-5 sm:py-6 border-b">
          <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <div className="rounded-lg p-2 bg-primary/10">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            Kehadiran 7 Hari Terakhir
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 sm:pt-5">
          {recentAttendance.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8 sm:py-12">
              <svg
                className="h-12 w-12 mx-auto mb-3 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p>Belum ada data kehadiran.</p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {recentAttendance.map((attendance, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-linier-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-lg p-2 bg-white dark:bg-gray-700 shadow-sm">
                      <svg
                        className="h-4 w-4 text-green-600 dark:text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                      {formatDate(attendance.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs sm:text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 sm:px-4 py-1.5 rounded-full whitespace-nowrap shadow-sm">
                      {formatTime(attendance.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
