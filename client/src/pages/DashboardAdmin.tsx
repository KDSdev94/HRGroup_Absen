import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Activity {
  id: string;
  employeeName: string;
  action: string;
  type: "check-in" | "check-out" | "add-employee" | "edit-employee";
  timestamp: string;
  division?: string;
}

const DIVISION_COLORS: { [key: string]: string } = {
  "Akuntansi & Keuangan": "#3b82f6",
  Teknik: "#ef4444",
  HRD: "#10b981",
  Legal: "#f59e0b",
  "Design Grafis": "#8b5cf6",
  "Marketing & Sosmed": "#ec4899",
  "Administrasi Pemberkasan": "#14b8a6",
  "Content Creative": "#f97316",
  Marketing: "#6366f1",
};

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function DashboardAdmin() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
  });
  const [divisionData, setDivisionData] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    console.log("🔄 DashboardAdmin: Starting fetchAllData");
    try {
      // Fetch employees
      console.log("📊 Fetching employees from Firestore...");
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const totalEmployees = employeesSnapshot.size;
      console.log("✅ Total employees found:", totalEmployees);

      const employeesData = employeesSnapshot.docs.map((doc) => {
        const data = doc.data();
        console.log(
          "👤 Employee:",
          doc.id,
          data.name,
          "Division:",
          data.division
        );
        return {
          id: doc.id,
          ...data,
        };
      }) as any[];

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      console.log("📅 Today's date:", todayStr);

      // Fetch attendance for today
      console.log("📊 Fetching today's attendance...");
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", todayStr))
      );

      const presentToday = attendanceSnapshot.size;
      console.log("✅ Present today:", presentToday);

      // Calculate late arrivals (check-in after 9:00 AM)
      let late = 0;
      const presentEmployeeIds = new Set<string>();

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        presentEmployeeIds.add(data.employeeId);

        if (data.type === "check-in") {
          // Handle different timestamp formats
          let checkInTime = "00:00:00";

          if (data.timestamp) {
            // If it's a Firestore Timestamp object
            if (
              data.timestamp.toDate &&
              typeof data.timestamp.toDate === "function"
            ) {
              const date = data.timestamp.toDate();
              checkInTime = date.toTimeString().split(" ")[0]; // Get HH:MM:SS
            }
            // If it's a timestamp with seconds property
            else if (data.timestamp.seconds) {
              const date = new Date(data.timestamp.seconds * 1000);
              checkInTime = date.toTimeString().split(" ")[0];
            }
            // If it's already a string
            else if (typeof data.timestamp === "string") {
              checkInTime = data.timestamp.split("T")[1] || "00:00:00";
            }
          }

          if (checkInTime > "11:00:00") {
            late++;
            console.log("⏰ Late check-in:", data.employeeName, checkInTime);
          }
        }
      });

      console.log("📊 Late arrivals:", late);

      // Calculate division breakdown
      const divisionCounts: { [key: string]: number } = {};
      employeesData.forEach((emp) => {
        const division = emp.division || "Unknown";
        divisionCounts[division] = (divisionCounts[division] || 0) + 1;
      });

      console.log("📊 Division breakdown:", divisionCounts);

      const chartData = Object.entries(divisionCounts).map(([name, value]) => ({
        name,
        value,
      }));

      console.log("📊 Chart data:", chartData);

      // Fetch recent activities - use attendance records as activities
      console.log("📊 Fetching recent activities...");

      // Try to get from activities collection first
      let activitiesSnapshot = await getDocs(
        query(
          collection(db, "activities"),
          orderBy("timestamp", "desc"),
          limit(3)
        )
      );

      let activitiesList: Activity[] = [];

      // If activities collection is empty, create activities from recent attendance
      if (activitiesSnapshot.empty) {
        console.log(
          "⚠️ Activities collection is empty, using attendance records instead"
        );

        // Get recent attendance records (last 10)
        const recentAttendance = await getDocs(
          query(
            collection(db, "attendance"),
            orderBy("timestamp", "desc"),
            limit(10)
          )
        );

        activitiesList = recentAttendance.docs.slice(0, 3).map((doc) => {
          const data = doc.data();

          // Convert Firestore Timestamp to ISO string for consistent handling
          let timestampStr = "";
          if (data.timestamp) {
            if (
              data.timestamp.toDate &&
              typeof data.timestamp.toDate === "function"
            ) {
              timestampStr = data.timestamp.toDate().toISOString();
            } else if (data.timestamp.seconds) {
              timestampStr = new Date(
                data.timestamp.seconds * 1000
              ).toISOString();
            } else if (typeof data.timestamp === "string") {
              timestampStr = data.timestamp;
            }
          }

          return {
            id: doc.id,
            employeeName: data.employeeName || "Unknown",
            action: `${data.type === "check-in" ? "Check in" : "Check out"}`,
            type: data.type as
              | "check-in"
              | "check-out"
              | "add-employee"
              | "edit-employee",
            timestamp: timestampStr,
            division: data.division,
          };
        }) as Activity[];
      } else {
        activitiesList = activitiesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Activity[];
      }

      console.log("✅ Activities found:", activitiesList.length);

      const stats = {
        totalEmployees,
        presentToday,
        lateToday: late,
        absentToday: totalEmployees - presentToday,
      };

      console.log("✅ Final stats:", stats);

      setStats(stats);
      setDivisionData(chartData);
      setActivities(activitiesList);
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      // Log the full error for debugging
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    } finally {
      console.log("✅ DashboardAdmin: Finished loading");
      setLoadingStats(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: color }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 leading-tight">
          {title}
        </CardTitle>
        <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {loadingStats ? (
            <span className="animate-pulse">...</span>
          ) : (
            value
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">{subtext}</p>
      </CardContent>
    </Card>
  );

  const getActivityTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      "check-in": "Check In",
      "check-out": "Check Out",
      "add-employee": "Tambah Peserta",
      "edit-employee": "Edit Peserta",
    };
    return labels[type] || type;
  };

  const getActivityTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      "check-in": "bg-green-100 text-green-800",
      "check-out": "bg-blue-100 text-blue-800",
      "add-employee": "bg-purple-100 text-purple-800",
      "edit-employee": "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();

      if (isToday) {
        return (
          date.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }) + " WIB"
        );
      } else {
        return (
          date.toLocaleDateString("id-ID", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }) + " WIB"
        );
      }
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Dashboard Admin
        </h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          Overview statistik kehadiran dan aktivitas terbaru.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Peserta"
          value={stats.totalEmployees}
          icon={Users}
          color="hsl(var(--primary))"
          subtext="Aktif dalam sistem"
        />
        <StatCard
          title="Hadir Hari Ini"
          value={stats.presentToday}
          icon={CheckCircle2}
          color="#10b981"
          subtext="Sudah check in"
        />
        <StatCard
          title="Terlambat"
          value={stats.lateToday}
          icon={Clock}
          color="#f59e0b"
          subtext="Setelah 11:00 AM"
        />
        <StatCard
          title="Tidak Hadir"
          value={stats.absentToday}
          icon={XCircle}
          color="#ef4444"
          subtext="Belum check in"
        />
      </div>

      <div className="grid gap-4 sm:gap-4 grid-cols-1 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="lg:col-span-4 shadow-sm border-t-2 border-t-primary/20">
          <CardHeader className="px-5 sm:px-6 py-5 sm:py-6">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl font-bold">Aktivitas Terbaru</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            {loadingStats ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8 sm:py-12">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Belum ada aktivitas terbaru.</p>
              </div>
            ) : (
              <div className="space-y-3.5 sm:space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="mt-0.5 hidden sm:block">
                      <div className="rounded-full p-2 bg-white dark:bg-gray-700 shadow-sm">
                        <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                            {activity.employeeName}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {activity.division && (
                              <span className="font-medium">{activity.division}</span>
                            )}
                            {activity.division && " • "}
                            <span>{formatTimestamp(activity.timestamp)}</span>
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap self-start ${getActivityTypeColor(
                            activity.type
                          )}`}
                        >
                          {getActivityTypeLabel(activity.type)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {activity.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Division Overview - Pie Chart */}
        <Card className="lg:col-span-3 shadow-sm border-t-2 border-t-blue-500/20">
          <CardHeader className="px-5 sm:px-6 py-5 sm:py-6">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg p-2 bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle className="text-lg sm:text-xl font-bold">Overview Per Divisi</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            {loadingStats ? (
              <div className="h-64 sm:h-72 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : divisionData.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8 sm:py-12">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada data divisi.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 280 : 320}>
                <PieChart>
                  <Pie
                    data={divisionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {divisionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          DIVISION_COLORS[entry.name] ||
                          COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
