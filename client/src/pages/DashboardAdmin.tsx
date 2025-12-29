import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  FileText,
  Plus,
  Upload,
  QrCode,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/hooks/use-toast";
import { getCompleteLocation } from "@/utils/gpsUtils";

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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    permissionToday: 0,
  });
  const [divisionData, setDivisionData] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  // Selected date for filtering (YYYY-MM-DD). Default to today.
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  // Manual Attendance State
  const [employees, setEmployees] = useState<any[]>([]);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    checkInHour: "08",
    checkInMinute: "00",
    checkOutHour: "17",
    checkOutMinute: "00",
    enableCheckIn: true,
    enableCheckOut: false,
  });
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [selectedDate]);

  const fetchAllData = async () => {
    try {
      // Fetch employees
      const employeesSnapshot = await getDocs(collection(db, "employees"));
      const totalEmployees = employeesSnapshot.size;

      const employeesData = employeesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        };
      }) as any[];

      setEmployees(employeesData);

      // Get today's date in YYYY-MM-DD format
      // Determine target date (use selectedDate from state)
      const todayStr = selectedDate || new Date().toISOString().split("T")[0];

      // Fetch attendance for today
      const attendanceSnapshot = await getDocs(
        query(collection(db, "attendance"), where("date", "==", todayStr))
      );

      // Fetch permissions for today
      const permissionsSnapshot = await getDocs(
        query(
          collection(db, "permissions"),
          where("date", "==", todayStr),
          where("status", "==", "approved")
        )
      );

      const permissionEmployeeIds = new Set<string>();
      permissionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.employeeId) {
          permissionEmployeeIds.add(data.employeeId);
        }
      });

      const permissionToday = permissionEmployeeIds.size;

      // Calculate late arrivals (check-in after 11:00 AM) and unique present employees
      let late = 0;
      const presentEmployeeIds = new Set<string>();

      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Only count check-in records for presence
        if (data.type === "check-in") {
          presentEmployeeIds.add(data.employeeId);

          // Handle different timestamp formats
          let checkInTime = "00:00:00";
          let checkInDate: Date | null = null;

          if (data.timestamp) {
            // If it's a Firestore Timestamp object
            if (
              data.timestamp.toDate &&
              typeof data.timestamp.toDate === "function"
            ) {
              checkInDate = data.timestamp.toDate();
              checkInTime = checkInDate!.toTimeString().split(" ")[0]; // Get HH:MM:SS
            }
            // If it's a timestamp with seconds property
            else if (data.timestamp.seconds) {
              checkInDate = new Date(data.timestamp.seconds * 1000);
              checkInTime = checkInDate!.toTimeString().split(" ")[0];
            }
            // If it's already a string
            else if (typeof data.timestamp === "string") {
              checkInDate = new Date(data.timestamp);
              checkInTime = data.timestamp.split("T")[1] || "00:00:00";
            }
          }

          // Check if late using strict time check (ignoring potential false 'late' status in DB)
          let isLate = false;

          let threshold = "09:00:00";
          if (checkInDate && checkInDate.getDay() === 1) {
            threshold = "10:00:00";
          }

          if (checkInTime > threshold) {
            isLate = true;
          }

          if (isLate) {
            late++;
          }
        }
      });

      const presentToday = presentEmployeeIds.size;

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

      // Fetch recent activities - Get from attendance records (check-in/check-out)

      // Get recent attendance records to show employee check-in/check-out activities
      const recentAttendance = await getDocs(
        query(
          collection(db, "attendance"),
          orderBy("timestamp", "desc"),
          limit(10)
        )
      );

      const activitiesList: Activity[] = recentAttendance.docs
        .slice(0, 6)
        .map((doc) => {
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

      // Calculate union of present and permission for accurate absent count
      const presentOrPermission = new Set([
        ...Array.from(presentEmployeeIds),
        ...Array.from(permissionEmployeeIds),
      ]);
      const absentToday = Math.max(
        0,
        totalEmployees - presentOrPermission.size
      );

      const stats = {
        totalEmployees,
        presentToday,
        lateToday: late,
        permissionToday,
        absentToday: absentToday,
      };

      setStats(stats);
      setDivisionData(chartData);
      setActivities(activitiesList);
    } catch (error) {
      // Error handling without console logs
    } finally {
      setLoadingStats(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtext,
    onClick,
  }: any) => (
    <Card
      className="border-l-4 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
      style={{ borderLeftColor: color }}
      onClick={onClick}
    >
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
          {loadingStats ? <span className="animate-pulse">...</span> : value}
        </div>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">
          {subtext}
        </p>
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

  const handleManualSubmit = async () => {
    if (!manualForm.employeeId || !manualForm.date) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Mohon pilih karyawan dan tanggal.",
      });
      return;
    }

    if (!manualForm.enableCheckIn && !manualForm.enableCheckOut) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Mohon pilih setidaknya satu jenis absen (Masuk atau Pulang).",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedEmployee = employees.find(
        (e) => e.id === manualForm.employeeId
      );
      if (!selectedEmployee) throw new Error("Karyawan tidak ditemukan");

      // Get Admin Location
      let locationData = {
        obtained: false,
        address: "Manual Entry by Admin",
        latitude: 0,
        longitude: 0,
      };

      try {
        const gps = await getCompleteLocation(false);
        if (gps.obtained) {
          locationData = {
            obtained: true,
            address: gps.address || "Lokasi Admin Terdeteksi",
            latitude: gps.latitude,
            longitude: gps.longitude,
          };
        }
      } catch (err) {
        console.warn("Could not get admin location, using default");
      }

      const promises = [];

      // Handle Check In
      if (manualForm.enableCheckIn) {
        const checkInTimeStr = `${manualForm.checkInHour}:${manualForm.checkInMinute}`;
        const checkInDateTime = new Date(
          `${manualForm.date}T${checkInTimeStr}`
        );

        // Determine status (late logic)
        const day = checkInDateTime.getDay();
        const hour = parseInt(manualForm.checkInHour);
        const minute = parseInt(manualForm.checkInMinute);
        const timeDecimal = hour + minute / 60;

        let isLate = false;
        if (day === 1) {
          // Monday
          if (timeDecimal > 10.0) isLate = true; // > 10:00
        } else {
          if (timeDecimal > 9.0) isLate = true; // > 09:00
        }

        promises.push(
          addDoc(collection(db, "attendance"), {
            employeeId: selectedEmployee.id,
            employeeName: selectedEmployee.name,
            division: selectedEmployee.division,
            timestamp: Timestamp.fromDate(checkInDateTime),
            date: manualForm.date,
            type: "check-in",
            status: isLate ? "late" : "on-time",
            location: locationData,
            isManualEntry: true,
            createdBy: "admin",
          })
        );
      }

      // Handle Check Out
      if (manualForm.enableCheckOut) {
        const checkOutTimeStr = `${manualForm.checkOutHour}:${manualForm.checkOutMinute}`;
        const checkOutDateTime = new Date(
          `${manualForm.date}T${checkOutTimeStr}`
        );

        promises.push(
          addDoc(collection(db, "attendance"), {
            employeeId: selectedEmployee.id,
            employeeName: selectedEmployee.name,
            division: selectedEmployee.division,
            timestamp: Timestamp.fromDate(checkOutDateTime),
            date: manualForm.date,
            type: "check-out",
            status: "on-time",
            location: locationData,
            isManualEntry: true,
            createdBy: "admin",
          })
        );
      }

      await Promise.all(promises);

      toast({
        title: "Berhasil",
        description: "Data absensi berhasil ditambahkan.",
      });

      setIsManualOpen(false);
      // Reset form but keep date
      setManualForm((prev) => ({
        ...prev,
        employeeId: "",
        enableCheckIn: true,
        enableCheckOut: false,
      }));
      fetchAllData(); // Refresh stats
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingQR(true);
    try {
      const html5QrCode = new Html5Qrcode("reader-hidden");
      const result = await html5QrCode.scanFile(file, false);

      const data = JSON.parse(result);
      if (data.id) {
        const emp = employees.find((e) => e.id === data.id);
        if (emp) {
          setManualForm((prev) => ({ ...prev, employeeId: emp.id }));
          toast({
            title: "QR Terdeteksi",
            description: `Karyawan: ${emp.name}`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Karyawan tidak ditemukan dalam database.",
          });
        }
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Scan QR",
        description: "Tidak dapat membaca QR code dari gambar.",
      });
    } finally {
      setIsProcessingQR(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Dashboard Admin
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Overview statistik kehadiran dan aktivitas terbaru.
          </p>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Filter Tanggal:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 md:flex-none px-2 py-1 rounded border bg-white dark:bg-gray-800 text-sm"
            />

            <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Absen Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Absensi Manual</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Peserta</Label>
                    <div className="flex gap-2">
                      <Select
                        value={manualForm.employeeId}
                        onValueChange={(val) =>
                          setManualForm({ ...manualForm, employeeId: val })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih Peserta" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name} - {emp.division}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQRUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isProcessingQR}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isProcessingQR}
                        >
                          {isProcessingQR ? (
                            <QrCode className="h-4 w-4 animate-pulse" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pilih peserta atau upload QR Code peserta.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Tanggal</Label>
                    <Input
                      type="date"
                      value={manualForm.date}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, date: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Check In Section */}
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Jam Masuk (WIB)</Label>
                        <input
                          type="checkbox"
                          checked={manualForm.enableCheckIn}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              enableCheckIn: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Select
                          value={manualForm.checkInHour}
                          onValueChange={(val) =>
                            setManualForm({ ...manualForm, checkInHour: val })
                          }
                          disabled={!manualForm.enableCheckIn}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Jam" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 24 }, (_, i) =>
                              i.toString().padStart(2, "0")
                            ).map((hour) => (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="flex items-center text-lg font-bold">
                          :
                        </span>
                        <Select
                          value={manualForm.checkInMinute}
                          onValueChange={(val) =>
                            setManualForm({ ...manualForm, checkInMinute: val })
                          }
                          disabled={!manualForm.enableCheckIn}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Menit" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 60 }, (_, i) =>
                              i.toString().padStart(2, "0")
                            ).map((min) => (
                              <SelectItem key={min} value={min}>
                                {min}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Check Out Section */}
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Jam Pulang (WIB)</Label>
                        <input
                          type="checkbox"
                          checked={manualForm.enableCheckOut}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              enableCheckOut: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Select
                          value={manualForm.checkOutHour}
                          onValueChange={(val) =>
                            setManualForm({ ...manualForm, checkOutHour: val })
                          }
                          disabled={!manualForm.enableCheckOut}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Jam" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 24 }, (_, i) =>
                              i.toString().padStart(2, "0")
                            ).map((hour) => (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="flex items-center text-lg font-bold">
                          :
                        </span>
                        <Select
                          value={manualForm.checkOutMinute}
                          onValueChange={(val) =>
                            setManualForm({
                              ...manualForm,
                              checkOutMinute: val,
                            })
                          }
                          disabled={!manualForm.enableCheckOut}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Menit" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 60 }, (_, i) =>
                              i.toString().padStart(2, "0")
                            ).map((min) => (
                              <SelectItem key={min} value={min}>
                                {min}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleManualSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Absensi"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Hidden div for QR scanning */}
            <div id="reader-hidden" className="hidden"></div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Total Peserta"
          value={stats.totalEmployees}
          icon={Users}
          color="hsl(var(--primary))"
          subtext="Aktif dalam sistem"
          onClick={() => setLocation("/employees")}
        />
        <StatCard
          title="Hadir Hari Ini"
          value={stats.presentToday}
          icon={CheckCircle2}
          color="#10b981"
          subtext={`Sudah check in (${selectedDate})`}
          onClick={() => setLocation(`/attendance/today?date=${selectedDate}`)}
        />
        <StatCard
          title="Terlambat"
          value={stats.lateToday}
          icon={Clock}
          color="#f59e0b"
          subtext={`Terlambat (${selectedDate})`}
          onClick={() => setLocation(`/attendance/late?date=${selectedDate}`)}
        />
        <StatCard
          title="Izin"
          value={stats.permissionToday}
          icon={FileText}
          color="#8b5cf6"
          subtext={`Izin disetujui (${selectedDate})`}
          onClick={() => setLocation("/admin/permissions")}
        />
        <StatCard
          title="Tidak Hadir"
          value={stats.absentToday}
          icon={XCircle}
          color="#ef4444"
          subtext={`Belum check in (${selectedDate})`}
          onClick={() => setLocation(`/attendance/absent?date=${selectedDate}`)}
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
              <CardTitle className="text-lg sm:text-xl font-bold">
                Aktivitas Terbaru
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            {loadingStats ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
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
                              <span className="font-medium">
                                {activity.division}
                              </span>
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
                        {activity.type === "check-in"
                          ? `Sudah absen masuk`
                          : activity.type === "check-out"
                          ? `Sudah absen pulang`
                          : activity.action}
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
              <div className="flex-1">
                <CardTitle className="text-lg sm:text-xl font-bold">
                  Overview Per Divisi
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Distribusi peserta berdasarkan divisi
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            {loadingStats ? (
              <div className="space-y-4">
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : divisionData.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8 sm:py-12">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada data divisi.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pie Chart - Clean Version with Shadow */}
                <div className="flex justify-center p-4">
                  <div
                    className="relative"
                    style={{
                      filter:
                        "drop-shadow(0 10px 25px rgba(0, 0, 0, 0.15)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.1))",
                    }}
                  >
                    <PieChart width={220} height={220}>
                      <defs>
                        {divisionData.map((entry, index) => {
                          const color =
                            DIVISION_COLORS[entry.name] ||
                            COLORS[index % COLORS.length];
                          return (
                            <filter
                              key={`shadow-${index}`}
                              id={`shadow-${index}`}
                              height="150%"
                            >
                              <feGaussianBlur
                                in="SourceAlpha"
                                stdDeviation="3"
                              />
                              <feOffset dx="0" dy="2" result="offsetblur" />
                              <feComponentTransfer>
                                <feFuncA type="linear" slope="0.3" />
                              </feComponentTransfer>
                              <feMerge>
                                <feMergeNode />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          );
                        })}
                      </defs>
                      <Pie
                        data={divisionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={90}
                        innerRadius={55}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {divisionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              DIVISION_COLORS[entry.name] ||
                              COLORS[index % COLORS.length]
                            }
                            className="transition-all hover:opacity-90"
                            style={{
                              filter: "brightness(1.05)",
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.98)",
                          border: "none",
                          borderRadius: "12px",
                          padding: "12px 16px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                        }}
                        formatter={(value: any, name: string) => {
                          const total = divisionData.reduce(
                            (sum, item) => sum + item.value,
                            0
                          );
                          const percentage = ((value / total) * 100).toFixed(1);
                          return [`${value} orang (${percentage}%)`, name];
                        }}
                      />
                    </PieChart>
                  </div>
                </div>

                {/* Legend dengan detail statistik */}
                <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                  {divisionData
                    .sort((a, b) => b.value - a.value)
                    .map((division, index) => {
                      const total = divisionData.reduce(
                        (sum, item) => sum + item.value,
                        0
                      );
                      const percentage = (
                        (division.value / total) *
                        100
                      ).toFixed(1);
                      const color =
                        DIVISION_COLORS[division.name] ||
                        COLORS[index % COLORS.length];

                      return (
                        <div
                          key={division.name}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
                        >
                          {/* Color indicator with shadow */}
                          <div
                            className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-transparent group-hover:ring-opacity-50 transition-all"
                            style={{
                              backgroundColor: color,
                              boxShadow: `0 2px 8px ${color}40, 0 0 0 0 ${color}20`,
                            }}
                          />

                          {/* Division info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {division.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    backgroundColor: color,
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {division.value}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {percentage}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Total summary */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between px-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total Peserta
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {divisionData.reduce((sum, item) => sum + item.value, 0)}{" "}
                      orang
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
