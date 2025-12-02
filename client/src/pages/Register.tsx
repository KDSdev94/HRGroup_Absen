import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  division: string;
  uid?: string;
  email?: string;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const DIVISIONS = [
    "Akuntansi & Keuangan",
    "Teknik",
    "HRD",
    "Legal",
    "Design Grafis",
    "Marketing & Sosmed",
    "Administrasi Pemberkasan",
    "Content Creative",
    "Marketing",
  ];

  const images = ["/onboard.avif", "/onboard1.avif", "/onboard2.avif"];
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // FETCH EMPLOYEE LIST
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "employees"));
      const employeesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];
      const unregisteredEmployees = employeesData.filter(
        (emp) => !emp.uid && !emp.email
      );
      setEmployees(unregisteredEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) => emp.division === selectedDivision
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId || !email || !password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Create User Profile
      await setDoc(doc(db, "users", user.uid), {
        email,
        role: "employee",
        employeeId: selectedEmployeeId,
        createdAt: new Date().toISOString(),
      });

      // 3. Update employee doc to include all necessary fields
      const employeeRef = doc(db, "employees", selectedEmployeeId);
      await updateDoc(employeeRef, {
        uid: user.uid,
        email,
        lastLogin: new Date().toISOString(),
        isActive: true,
      });

      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      setLocation("/login");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // REGISTER WITH GOOGLE
  const handleGoogleRegister = async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;

      // For Google registration, we might need to handle employee selection differently
      // For now, we'll prompt the user to select their employee profile
      toast({
        title: "Success",
        description:
          "Successfully authenticated with Google. Please complete your registration.",
      });

      // We could redirect to a profile completion page or handle differently
      // For now, keeping them on the register page to select employee
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Registration Failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* TOP LEFT HEADER IMAGE */}
      <div className="absolute top-3 left-3 z-50">
        <img
          src="/header.webp"
          alt="HRGroup Header"
          className="h-10 w-auto md:h-12 object-contain"
        />
      </div>

      {/* TOP RIGHT LOGIN BUTTON */}
      <div className="absolute top-4 right-4 z-50">
        <a
          href="/login"
          className="px-5 py-1.5 bg-black text-white rounded-full text-xs md:text-sm"
        >
          Daftar
        </a>
      </div>

      {/* LEFT SIDE SLIDER (MOBILE = ATAS) */}
      <div
        className="
      w-full 
      h-[220px] 
      sm:h-[280px] 
      md:h-[340px]
      lg:h-screen lg:w-[55%]
      relative overflow-hidden
    "
      >
        <img
          key={currentImage}
          src={images[currentImage]}
          className="w-full h-full object-cover transition-opacity duration-700"
        />

        <div className="absolute bottom-4 left-4 lg:bottom-12 lg:left-14 text-white">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
            HRGroup Management
          </h1>
          <p className="text-sm sm:text-base md:text-lg opacity-90">
            Portal Pendaftaran Peserta
          </p>
        </div>
      </div>

      {/* RIGHT SIDE FORM (MOBILE = BAWAH) */}
      <div
        className="
      w-full 
      lg:w-[45%] 
      h-auto 
      lg:h-screen 
      flex 
      items-center 
      justify-center 
      px-5 
      py-10
    "
      >
        <div className="w-full max-w-md">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0f1a44] dark:text-white mb-1">
            Buat Akun
          </h1>

          <p className="text-gray-500 dark:text-gray-300 mb-8 md:mb-10">
            Daftarkan akses peserta HRGroup Anda
          </p>

          <form onSubmit={handleRegister} className="space-y-6">
            {/* DIVISION */}
            <div className="space-y-2">
              <Label>Divisi</Label>
              <Select
                value={selectedDivision}
                onValueChange={(value) => {
                  setSelectedDivision(value);
                  setSelectedEmployeeId("");
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((div) => (
                    <SelectItem key={div} value={div}>
                      {div}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* NAME */}
            <div className="space-y-2">
              <Label>Nama</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={!selectedDivision}
              >
                <SelectTrigger className="h-12">
                  <SelectValue
                    placeholder={
                      selectedDivision
                        ? "Pilih nama"
                        : "Pilih divisi terlebih dahulu"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDivision && filteredEmployees.length === 0 && (
                <p className="text-xs text-amber-600">
                  Tidak ada peserta yang belum terdaftar di divisi ini.
                </p>
              )}
            </div>

            {/* EMAIL */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Masukkan email Anda"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>

            {/* PASSWORD */}
            <div className="space-y-2 relative">
              <Label>Kata Sandi</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* REGISTER BUTTON */}
            <Button
              disabled={isLoading || !selectedEmployeeId}
              type="submit"
              className="w-full h-12 text-md font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat…
                </>
              ) : (
                "Daftar"
              )}
            </Button>

            {/* GOOGLE REGISTER */}
            <div className="my-4 flex items-center justify-center text-gray-500 text-sm">
              <span className="px-4">Pendaftaran Instan</span>
            </div>

            <Button
              onClick={handleGoogleRegister}
              className="w-full h-12 bg-white border text-black hover:bg-gray-100"
            >
              <img src="/google.png" alt="g" className="h-5 mr-2" />
              Lanjutkan dengan Google
            </Button>

            <div className="mt-4 text-center text-sm">
              Sudah punya akun?{" "}
              <a href="/login" className="text-blue-600 hover:underline">
                Masuk
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
