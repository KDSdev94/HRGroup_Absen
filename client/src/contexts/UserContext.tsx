import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  Auth
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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
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
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        const role = await getUserRole(user.uid);
        const userData: User = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role
        };
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login with email and password
  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
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
        role
      };
      setCurrentUser(userData);
    } catch (error) {
      throw error;
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
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
        role
      };
      setCurrentUser(userData);
    } catch (error) {
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
        role
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
    autoLogin
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}