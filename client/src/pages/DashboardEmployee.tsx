import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

      // Execute attendance queries in parallel
      const [todayAttendanceSnapshot, recentSnapshot] = await Promise.all([
        // Query today's attendance
        getDocs(
          query(
            collection(db, "attendance"),
            where("employeeId", "==", employeeId),
            where("date", "==", today)
          )
        ),
        // Query all attendance for this employee (filter by date on client side)
        // This avoids composite index requirement while index is building
        getDocs(
          query(
            collection(db, "attendance"),
            where("employeeId", "==", employeeId),
            limit(50) // Get last 50 records, filter client-side
          )
        ),
      ]);

      // Process today's attendance
      let status = "absent";
      let checkInTime = null;
      let checkOutTime = null;
      let isLate = false;

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

          if (timeStr > "11:00:00") {
            isLate = true;
          }
        } else if (data.type === "check-out") {
          checkOutTime = data.timestamp;
        }
      });

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
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !employeeStats) {
    return (
      <div className="space-y-8">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string, isLate: boolean) => {
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
    employeeStats.isLate
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Halo, {employeeStats.name}! 👋
        </h1>
        <p className="text-gray-500 mt-2">
          Selamat datang di dashboard kehadiran Anda - {employeeStats.division}
        </p>
      </div>

      {/* Status Today */}
      <Card
        className="border-t-4"
        style={{
          borderTopColor:
            statusColor.bg.split("-")[1] === "red"
              ? "#ef4444"
              : statusColor.bg.split("-")[1] === "orange"
              ? "#f59e0b"
              : "#10b981",
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status Kehadiran Hari Ini</span>
            <span
              className={`text-sm font-semibold px-4 py-2 rounded-full ${statusColor.bg} ${statusColor.text}`}
            >
              {statusColor.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Jam Masuk</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(employeeStats.checkInTime)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Jam Keluar</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(employeeStats.checkOutTime)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Kehadiran 7 Hari Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttendance.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Belum ada data kehadiran.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAttendance.map((attendance, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(attendance.date)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
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
