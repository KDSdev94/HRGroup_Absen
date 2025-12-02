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
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  timestamp: string;
  type: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export default function AttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [filterDate, setFilterDate] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Get user's employeeId from users collection
      let employeeId: string | null = null;

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          employeeId = userDoc.data().employeeId;
        }
      } catch (error) {
        console.log(
          "User profile not found in users collection, trying employees..."
        );
      }

      // If no employeeId found, try to find by UID in employees collection
      if (!employeeId) {
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("uid", "==", currentUser.uid)
          );
          const empSnapshot = await getDocs(empQuery);
          if (!empSnapshot.empty) {
            employeeId = empSnapshot.docs[0].id;
          }
        } catch (error) {
          console.log("No employee found by UID");
        }
      }

      // If still no employeeId, show error
      if (!employeeId) {
        toast({
          title: "Error",
          description:
            "Employee profile not found. Please contact admin to link your account.",
          variant: "destructive",
        });
        return;
      }

      // Query attendance records for this employee
      const q = query(
        collection(db, "attendance"),
        where("employeeId", "==", employeeId),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      const attendanceData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];

      setRecords(attendanceData);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance history",
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
    });
  };

  const formatTime = (timestampString: string) => {
    const date = new Date(timestampString);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Attendance History
        </h1>
        <p className="text-gray-500 mt-2">
          View your attendance records and check-in locations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Filter by Date
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
                  Clear Filter
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading attendance history...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {records.length === 0
                  ? "No attendance records found."
                  : "No records match the selected date."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Action</TableHead>
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
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs">
                              {record.location.latitude.toFixed(4)},{" "}
                              {record.location.longitude.toFixed(4)}
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
                            View Map
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
                Location - {formatDate(selectedRecord.date)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                <div>
                  <p className="text-sm text-gray-500">Coordinates</p>
                  <p className="font-mono font-semibold">
                    {selectedRecord.location.latitude.toFixed(6)},{" "}
                    {selectedRecord.location.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
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
                  Open in Google Maps
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
                      title: "Copied",
                      description: "Coordinates copied to clipboard",
                    });
                  }}
                >
                  Copy Coordinates
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
