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
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTimeWIB, formatDateTimeWIB, getTodayWIB } from "@/lib/utils";

interface Activity {
  id: string;
  employeeName: string;
  action: string;
  type: "check-in" | "check-out" | "add-employee" | "edit-employee";
  timestamp: string;
  division?: string;
}

interface EmployeeStats {
  name: string;
  status: "present" | "absent" | "late";
  checkInTime?: string;
  division: string;
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

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            if (auth.currentUser.email === "admin@hrgroup.com") {
              setRole("superadmin");
            } else {
              setRole("employee");
            }
          }
        } catch (error) {
          console.error("Error fetching role:", error);
          setRole("employee");
        }
      }
      setLoading(false);
    };

    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {role === "employee" ? <EmployeeDashboard /> : <AdminDashboard />}
    </div>
  );
}

function AdminDashboard() {
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
    try {
      // Fetch employees
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const totalEmployees = employeesSnapshot.size;
      const employeesData = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Fetch attendance for today
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", todayStr))
      );

      const presentToday = attendanceSnapshot.size;

      // Calculate late arrivals (check-in after 9:00 AM)
      let late = 0;
      const presentEmployeeIds = new Set<string>();

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        presentEmployeeIds.add(data.employeeId);

        if (data.type === "check-in") {
          const checkInTime = data.timestamp
            ? data.timestamp.split("T")[1]
            : "00:00:00";
          if (checkInTime > "09:00:00") late++;
        }
      });

      // Calculate division breakdown
      const divisionCounts: { [key: string]: number } = {};
      employeesData.forEach((emp) => {
        const division = emp.division || "Unknown";
        divisionCounts[division] = (divisionCounts[division] || 0) + 1;
      });

      const chartData = Object.entries(divisionCounts).map(([name, value]) => ({
        name,
        value,
      }));

      // Fetch recent activities (max 3)
      const activitiesSnapshot = await getDocs(
        query(
          collection(db, "activities"),
          orderBy("timestamp", "desc"),
          limit(3)
        )
      );

      const activitiesList: Activity[] = activitiesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Activity[];

      setStats({
        totalEmployees,
        presentToday,
        lateToday: late,
        absentToday: totalEmployees - presentToday,
      });

      setDivisionData(chartData);
      setActivities(activitiesList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loadingStats ? "..." : value}</div>
        <p className="text-xs text-gray-500 mt-1">{subtext}</p>
      </CardContent>
    </Card>
  );

  const getActivityTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      "check-in": "Check In",
      "check-out": "Check Out",
      "add-employee": "Tambah Karyawan",
      "edit-employee": "Edit Karyawan",
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
        return date.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        return date.toLocaleDateString("id-ID", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      return timestamp;
    }
  };

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Dashboard Admin
        </h1>
        <p className="text-gray-500 mt-2">
          Overview statistik kehadiran dan aktivitas terbaru.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Karyawan"
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
          subtext="Setelah 09:00 AM"
        />
        <StatCard
          title="Tidak Hadir"
          value={stats.absentToday}
          icon={XCircle}
          color="#ef4444"
          subtext="Belum check in"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-600" />
              <CardTitle>Aktivitas Terbaru</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-200 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                Belum ada aktivitas terbaru.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, idx) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                  >
                    <div className="mt-1">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {activity.employeeName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {activity.division && `${activity.division} • `}
                            {formatTimestamp(activity.timestamp)}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${getActivityTypeColor(
                            activity.type
                          )}`}
                        >
                          {getActivityTypeLabel(activity.type)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-600" />
              <CardTitle>Overview Per Divisi</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="h-64 bg-gray-200 rounded animate-pulse" />
            ) : divisionData.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                Tidak ada data divisi.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
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
    </>
  );
}

function EmployeeDashboard() {
  const [employeeStats, setEmployeeStats] = useState<any>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    try {
      if (!auth.currentUser) return;

      // Get employee info
      const empQuery = query(
        collection(db, "employees"),
        where("uid", "==", auth.currentUser.uid)
      );
      const empSnapshot = await getDocs(empQuery);

      let employeeInfo: any = null;
      if (empSnapshot.docs.length > 0) {
        employeeInfo = empSnapshot.docs[0].data();
      } else {
        const empDoc = await getDoc(doc(db, "employees", auth.currentUser.uid));
        if (empDoc.exists()) {
          employeeInfo = empDoc.data();
        }
      }

      // Get today's attendance
      const today = new Date().toISOString().split("T")[0];
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", auth.currentUser.uid),
        where("date", "==", today)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      let status = "absent";
      let checkInTime = null;
      let checkOutTime = null;
      let isLate = false;

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.type === "check-in") {
          status = "present";
          checkInTime = data.timestamp;
          const time = data.timestamp?.split("T")[1];
          if (time && time > "09:00:00") {
            isLate = true;
          }
        } else if (data.type === "check-out") {
          checkOutTime = data.timestamp;
        }
      });

      // Get recent attendance (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

      const recentQuery = query(
        collection(db, "attendance"),
        where("employeeId", "==", auth.currentUser.uid),
        where("date", ">=", sevenDaysAgoStr),
        orderBy("date", "desc"),
        limit(10)
      );
      const recentSnapshot = await getDocs(recentQuery);

      const recentData = recentSnapshot.docs
        .map((doc) => doc.data())
        .reduce((acc: any[], curr) => {
          const existing = acc.find((a) => a.date === curr.date);
          if (!existing) {
            acc.push(curr);
          }
          return acc;
        }, []);

      setEmployeeStats({
        name: employeeInfo?.name || auth.currentUser.email?.split("@")[0],
        division: employeeInfo?.division || "Unknown",
        status,
        checkInTime,
        checkOutTime,
        isLate,
      });

      setRecentAttendance(recentData);
    } catch (error) {
      console.error("Error fetching employee data:", error);
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

  const formatTime = (timestamp: string) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
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
    </>
  );
}
