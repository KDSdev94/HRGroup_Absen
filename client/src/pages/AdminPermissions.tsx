import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Check, X, Loader2 } from "lucide-react";

export default function AdminPermissions() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(
      collection(db, "permissions"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPermissions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (
    permissionId: string,
    newStatus: "approved" | "rejected",
    reason?: string
  ) => {
    setProcessingId(permissionId);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (reason) {
        updateData.rejectionReason = reason;
      }

      await updateDoc(doc(db, "permissions", permissionId), updateData);

      toast({
        title: "Berhasil",
        description: `Pengajuan izin berhasil ${
          newStatus === "approved" ? "disetujui" : "ditolak"
        }.`,
      });

      setRejectReason("");
      setSelectedPermission(null);
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Terjadi kesalahan saat memperbarui status.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500 text-white hover:bg-yellow-600"
          >
            Menunggu
          </Badge>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sakit":
        return "Sakit";
      case "izin":
        return "Izin";
      case "lainnya":
        return "Lainnya";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Izin Peserta</h1>
          <p className="text-muted-foreground">
            Kelola pengajuan izin sakit, cuti, dan lainnya dari peserta.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengajuan</CardTitle>
          <CardDescription>
            Daftar semua pengajuan izin yang masuk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Pengajuan</TableHead>
                  <TableHead>Nama Peserta</TableHead>
                  <TableHead>Tanggal Izin</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Belum ada pengajuan izin.
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell>
                        {permission.createdAt?.toDate
                          ? format(
                              permission.createdAt.toDate(),
                              "dd MMM yyyy HH:mm",
                              { locale: id }
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {permission.name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(permission.date), "dd MMM yyyy", {
                          locale: id,
                        })}
                      </TableCell>
                      <TableCell>{getTypeLabel(permission.type)}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={permission.description}
                      >
                        {permission.description}
                      </TableCell>
                      <TableCell>{getStatusBadge(permission.status)}</TableCell>
                      <TableCell className="text-right">
                        {permission.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                              onClick={() =>
                                handleStatusUpdate(permission.id, "approved")
                              }
                              disabled={processingId === permission.id}
                            >
                              {processingId === permission.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  onClick={() =>
                                    setSelectedPermission(permission)
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Tolak Pengajuan Izin
                                  </DialogTitle>
                                  <DialogDescription>
                                    Berikan alasan penolakan untuk pengajuan
                                    izin dari {permission.name}.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <Textarea
                                    placeholder="Alasan penolakan..."
                                    value={rejectReason}
                                    onChange={(e) =>
                                      setRejectReason(e.target.value)
                                    }
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="destructive"
                                    onClick={() =>
                                      handleStatusUpdate(
                                        permission.id,
                                        "rejected",
                                        rejectReason
                                      )
                                    }
                                    disabled={
                                      !rejectReason.trim() ||
                                      processingId === permission.id
                                    }
                                  >
                                    {processingId === permission.id && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Tolak Izin
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                        {permission.status === "rejected" &&
                          permission.rejectionReason && (
                            <span className="text-xs text-muted-foreground italic">
                              Alasan: {permission.rejectionReason}
                            </span>
                          )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
