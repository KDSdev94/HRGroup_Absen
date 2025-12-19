import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useLocation } from "wouter";

const formSchema = z.object({
  date: z.date({
    required_error: "Tanggal izin harus diisi.",
  }),
  type: z.enum(["sakit", "izin", "lainnya"], {
    required_error: "Pilih jenis izin.",
  }),
  description: z.string().min(5, {
    message: "Keterangan harus minimal 5 karakter.",
  }),
});

export default function PermissionRequest() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!auth.currentUser) return;

      try {
        // Try to get employeeId similar to DashboardEmployee logic
        let empId = null;
        let name = auth.currentUser.displayName || "User";

        // 1. Check users collection
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          empId = userData.employeeId;
          if (userData.name) name = userData.name;
        }

        // 2. Check employees collection by UID
        if (!empId) {
          const empDoc = await getDoc(
            doc(db, "employees", auth.currentUser.uid)
          );
          if (empDoc.exists()) {
            empId = empDoc.id;
            const empData = empDoc.data();
            if (empData.name) name = empData.name;
          }
        }

        // 3. Check employees collection by uid field
        if (!empId) {
          const q = query(
            collection(db, "employees"),
            where("uid", "==", auth.currentUser.uid)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            empId = snapshot.docs[0].id;
            const empData = snapshot.docs[0].data();
            if (empData.name) name = empData.name;
          }
        }

        // Fallback
        if (!empId) empId = auth.currentUser.uid;

        setEmployeeId(empId);
        setEmployeeName(name);
      } catch (error) {
        console.error("Error fetching employee info:", error);
      }
    };

    fetchEmployeeData();
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth.currentUser || !employeeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Anda harus login untuk mengajukan izin.",
      });
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "permissions"), {
        employeeId: employeeId,
        uid: auth.currentUser.uid,
        name: employeeName,
        date: format(values.date, "yyyy-MM-dd"),
        type: values.type,
        description: values.description,
        status: "pending", // pending, approved, rejected
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Berhasil",
        description: "Pengajuan izin berhasil dikirim.",
      });

      // Reset form or redirect
      form.reset();
      setLocation("/");
    } catch (error) {
      console.error("Error submitting permission:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Terjadi kesalahan saat mengirim pengajuan.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Form Pengajuan Izin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tanggal Izin</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: id })
                            ) : (
                              <span>Pilih tanggal</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Izin</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis izin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sakit">Sakit</SelectItem>
                        <SelectItem value="izin">
                          Izin (Acara Keluarga/Lainnya)
                        </SelectItem>
                        <SelectItem value="lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Jelaskan alasan izin anda..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/")}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Kirim Pengajuan
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
