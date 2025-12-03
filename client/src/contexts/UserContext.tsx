import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  Auth,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
}

interface UserContextType {
  currentUser: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (code: string, newPassword: string) => Promise<void>;
  autoLogin: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user role from Firestore
  const getUserRole = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data().role;
      }
      return "employee"; // default role
    } catch (error) {
      console.error("Error getting user role:", error);
      return "employee"; // default role
    }
  };

  // Handle Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user: FirebaseUser | null) => {
        if (user) {
          const role = await getUserRole(user.uid);
          const userData: User = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role,
          };
          setCurrentUser(userData);
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle Google redirect result for mobile devices
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const { getRedirectResult } = await import("firebase/auth");
        console.log("🔐 Checking for redirect result from Google login...");
        console.log("📱 Current auth state:", auth.currentUser ? "Authenticated" : "Not authenticated");
        
        // Add timeout for getRedirectResult on slow mobile networks
        const redirectPromise = getRedirectResult(auth);
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => {
            console.log("⚠️ Redirect result check timeout - continuing without result");
            resolve(null);
          }, 10000) // 10 seconds timeout
        );
        
        const result = (await Promise.race([redirectPromise, timeoutPromise])) as any;

        if (result && result.user) {
          console.log("✅ Redirect result found for:", result.user.email);

          // Save email for "remember me" functionality
          if (result.user.email) {
            localStorage.setItem("rememberEmail", result.user.email);
          }

          const role = await getUserRole(result.user.uid);
          const userData: User = {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            role,
          };
          setCurrentUser(userData);
          console.log("✅ Redirect login complete with role:", role);
          
          // Dispatch custom event to notify Login page about successful redirect
          window.dispatchEvent(new Event("authRedirectComplete"));
        } else {
          console.log("ℹ️ No redirect result found (normal if not redirecting)");
        }
      } catch (error: any) {
        console.error("❌ Error handling redirect result:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // Only log error if it's not a known "safe" error
        if (error.code && error.code !== "auth/operation-not-supported-in-this-environment") {
          console.error("⚠️ Redirect handling failed - user may need to login again");
        }
      }
    };

    handleRedirectResult();
  }, []);

  // Login with email and password
  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = false
  ) => {
    try {
      console.log("🔐 Attempting login for:", email);

      // Add timeout protection for slow mobile networks (45s for mobile)
      const loginPromise = signInWithEmailAndPassword(auth, email, password);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error("Login timeout - please check your internet connection")
            ),
          45000 // Increased to 45 seconds for slow mobile networks
        )
      );

      const result = (await Promise.race([
        loginPromise,
        timeoutPromise,
      ])) as any;
      const user = result.user;

      console.log("✅ Login successful for:", user.email);

      // If rememberMe is checked, save the email to localStorage
      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      const role = await getUserRole(user.uid);
      const userData: User = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role,
      };
      setCurrentUser(userData);

      console.log("✅ User data set with role:", role);
    } catch (error: any) {
      console.error("❌ Login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      throw error;
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      console.log("🔐 Attempting Google login...");

      const provider = new GoogleAuthProvider();

      // Add custom parameters for better mobile support
      provider.setCustomParameters({
        prompt: "select_account",
      });

      // For mobile devices, use redirect instead of popup
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        console.log("📱 Mobile detected - using redirect flow");
        // Import signInWithRedirect for mobile
        const { signInWithRedirect } = await import("firebase/auth");

        // Start the redirect flow with timeout
        console.log("📱 Initiating Google Sign-In with redirect...");
        const redirectPromise = signInWithRedirect(auth, provider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Google redirect timeout - please try again")),
            45000 // 45 seconds for mobile
          )
        );
        
        await Promise.race([redirectPromise, timeoutPromise]);
        // This will redirect the page, so code below won't execute
        console.log("📱 Redirecting to Google...");
        return;
      } else {
        console.log("💻 Desktop detected - using popup flow");
        // Add timeout for popup
        const popupPromise = signInWithPopup(auth, provider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Google login timeout - please try again")),
            45000 // Increased to 45 seconds
          )
        );

        const result = (await Promise.race([
          popupPromise,
          timeoutPromise,
        ])) as any;

        const user = result.user;
        console.log("✅ Google login successful for:", user.email);

        // Save email for "remember me" functionality
        if (user.email) {
          localStorage.setItem("rememberEmail", user.email);
        }

        const role = await getUserRole(user.uid);
        const userData: User = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role,
        };
        setCurrentUser(userData);

        console.log("✅ Google user data set with role:", role);
      }
    } catch (error: any) {
      console.error("❌ Google login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);

      // Provide more helpful error messages
      if (error.code === "auth/popup-blocked") {
        throw new Error(
          "Popup diblokir oleh browser. Silakan izinkan popup atau coba lagi."
        );
      } else if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Login dibatalkan. Silakan coba lagi.");
      } else if (error.code === "auth/network-request-failed") {
        throw new Error("Koneksi internet bermasalah. Periksa jaringan Anda.");
      } else if (error.message && error.message.includes("timeout")) {
        throw new Error(
          "Login timeout. Periksa koneksi internet Anda dan coba lagi."
        );
      }

      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      localStorage.removeItem("rememberEmail");
    } catch (error) {
      throw error;
    }
  };

  // Password reset
  const forgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw error;
    }
  };

  // Confirm password reset
  const resetPassword = async (code: string, newPassword: string) => {
    try {
      await confirmPasswordReset(auth, code, newPassword);
    } catch (error) {
      throw error;
    }
  };

  // Auto-login a user if they have "remember me" enabled
  const autoLogin = async () => {
    const rememberedEmail = localStorage.getItem("rememberEmail");
    if (rememberedEmail && auth.currentUser) {
      // User is already logged in, just update state
      const role = await getUserRole(auth.currentUser.uid);
      const userData: User = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        role,
      };
      setCurrentUser(userData);
    } else if (rememberedEmail && !auth.currentUser) {
      // User is not logged in but has "remember me" set - this shouldn't happen with Firebase persistence
      // This might mean the session expired, so we don't auto-login
      console.log("Remembered email found but no active session");
    }
  };

  const value: UserContextType = {
    currentUser,
    loading,
    login,
    loginWithGoogle,
    logout,
    forgotPassword,
    resetPassword,
    autoLogin,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
