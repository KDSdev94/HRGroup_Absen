import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        const totalEmployees = employeesSnapshot.size;

        const today = new Date().toISOString().split('T')[0];
        // In a real app, you'd query by date range. 
        // For now just simulating fetching today's records
        const attendanceSnapshot = await getDocs(
          query(
            collection(db, "attendance"),
            where("date", "==", today)
          )
        );
        
        const presentToday = attendanceSnapshot.size;
        
        // Mock logic for late/absent based on timestamp
        let late = 0;
        attendanceSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const time = data.timestamp?.split('T')[1];
          if (time && time > '09:00:00') late++;
        });

        setStats({
          totalEmployees,
          presentToday,
          lateToday: late,
          absentToday: totalEmployees - presentToday
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "..." : value}</div>
        <p className="text-xs text-gray-500 mt-1">
          {subtext}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 mt-2">Overview of today's attendance and statistics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Employees" 
          value={stats.totalEmployees}
          icon={Users}
          color="hsl(var(--primary))"
          subtext="Active in system"
        />
        <StatCard 
          title="Present Today" 
          value={stats.presentToday}
          icon={CheckCircle2}
          color="#10b981" // Green
          subtext="Checked in"
        />
        <StatCard 
          title="Late Arrivals" 
          value={stats.lateToday}
          icon={Clock}
          color="#f59e0b" // Amber
          subtext="After 9:00 AM"
        />
        <StatCard 
          title="Absent" 
          value={stats.absentToday}
          icon={XCircle}
          color="#ef4444" // Red
          subtext="Not checked in"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500 text-center py-8">
              Recent check-in data will appear here.
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Department Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500 text-center py-8">
              Department distribution charts will appear here.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}