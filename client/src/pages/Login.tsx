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
        description: "Please enter your email address.",
      });
      return;
    }

    console.log("Attempting to send reset email to:", resetEmail);
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      console.log("Reset email sent successfully");
      toast({
        title: "Check your email",
        description:
          "If an account exists, a password reset link has been sent. Check your spam folder too.",
        duration: 5000,
      });
      setShowForgotDialog(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      let errorMessage = "Failed to send reset email.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
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

      toast({ title: "Success", description: "Welcome back!" });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid email or password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast({ title: "Success", description: "Logged in with Google!" });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Login Failed",
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
          Login
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
            Empowering Human Resources
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
          <h1 className="text-2xl md:text-3xl font-bold text-[#0f1a44] mb-1">
            Welcome Back!
          </h1>
          <p className="text-gray-500 mb-8 md:mb-10">
            Sign in to your HRGroup account
          </p>

          {/* FORM */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* EMAIL */}
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>

            {/* PASSWORD */}
            <div className="space-y-2 relative">
              <Label>Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
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
                <span className="text-sm text-gray-600">Remember Me</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotDialog(true)}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Forgot Password?
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          {/* INSTANT LOGIN */}
          <div className="my-4 flex items-center justify-center text-gray-500 text-sm">
            <span className="px-4">Instant Login</span>
          </div>

          <Button
            onClick={handleGoogle}
            className="w-full h-12 bg-white border text-black hover:bg-gray-100"
          >
            <img src="/google.png" alt="g" className="h-5 mr-2" />
            Continue with Google
          </Button>

          <div className="mt-6 text-center text-sm">
            Don't have an account?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Register
            </a>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD DIALOG */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your
              password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="Enter your email"
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
                Cancel
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
