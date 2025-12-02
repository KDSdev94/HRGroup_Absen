import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // SLIDER GAMBAR - Using hero images from public folder
  const images = ["/onboard.avif", "/onboard1.avif", "/onboard2.avif"];
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Harap masukkan alamat email Anda.",
      });
      return;
    }

    console.log("Attempting to send reset email to:", resetEmail);
    setIsResetting(true);
    try {
      // Configure action code settings to redirect back to login page
      const actionCodeSettings = {
        url: window.location.origin + "/login", // Redirect to login page after reset
        handleCodeInApp: false, // Handle in email link, not in app
      };

      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
      console.log("Reset email sent successfully");
      toast({
        title: "Cek email Anda",
        description:
          "Jika akun ada, link reset password telah dikirim. Cek juga folder spam Anda.",
        duration: 5000,
      });
      setResetEmail("");
      // Keep dialog open so user stays on login page
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      let errorMessage = "Gagal mengirim email reset.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "Tidak ada akun ditemukan dengan alamat email ini.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Format alamat email tidak valid.";
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsResetting(false);
    }
  };

  // LOGIN EMAIL + PASSWORD
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      if (remember) localStorage.setItem("remember", email);
      else localStorage.removeItem("remember");

      toast({ title: "Berhasil", description: "Selamat datang kembali!" });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Gagal",
        description: error.message || "Email atau password salah.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast({
        title: "Berhasil",
        description: "Masuk dengan Google berhasil!",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Google Gagal",
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
          className="h-10 md:h-12 w-auto object-contain"
        />
      </div>

      {/* TOP RIGHT REGISTER BUTTON */}
      <div className="absolute top-4 right-4 z-50">
        <a
          href="/register"
          className="px-5 py-1.5 bg-black text-white rounded-full text-xs md:text-sm"
        >
          Masuk
        </a>
      </div>

      {/* LEFT SIDE SLIDER — MOBILE = ATAS */}
      <div
        className="
        w-full 
        h-[220px] sm:h-[280px] md:h-[340px]
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
            Memberdayakan Sumber Daya Manusia
          </p>
        </div>
      </div>

      {/* RIGHT SIDE FORM — MOBILE = BAWAH */}
      <div
        className="
        w-full 
        lg:w-[45%] 
        h-auto 
        lg:h-screen 
        flex items-center justify-center 
        px-5 
        py-10
      "
      >
        <div className="w-full max-w-md">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0f1a44] dark:text-white mb-1">
            Selamat Datang Kembali!
          </h1>
          <p className="text-gray-500 dark:text-gray-300 mb-8 md:mb-10">
            Masuk ke akun HRGroup Anda
          </p>

          {/* FORM */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* EMAIL */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Masukkan email"
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

              {/* SHOW / HIDE PASSWORD */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* REMEMBER ME & FORGOT PASSWORD */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Ingat Saya</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotDialog(true)}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            {/* LOGIN BUTTON */}
            <Button
              disabled={isLoading}
              type="submit"
              className="w-full h-12 text-md font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Masuk…
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          {/* INSTANT LOGIN */}
          <div className="my-4 flex items-center justify-center text-gray-500 text-sm">
            <span className="px-4">Login Instan</span>
          </div>

          <Button
            onClick={handleGoogle}
            className="w-full h-12 bg-white border text-black hover:bg-gray-100"
          >
            <img src="/google.png" alt="g" className="h-5 mr-2" />
            Lanjutkan dengan Google
          </Button>

          <div className="mt-6 text-center text-sm">
            Belum punya akun?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Daftar
            </a>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD DIALOG */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Kata Sandi</DialogTitle>
            <DialogDescription>
              Masukkan alamat email Anda dan kami akan mengirimkan link untuk
              reset kata sandi Anda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Alamat Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="Masukkan email Anda"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotDialog(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Mengirim...
                  </>
                ) : (
                  "Kirim Link Reset"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
