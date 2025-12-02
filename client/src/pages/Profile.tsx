import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";

export default function Profile() {
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    employeeId: "",
    division: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Wait for auth state to be ready
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserProfile();
      } else {
        setLoading(false);
        toast({
          title: "Error",
          description: "Please log in to view your profile",
          variant: "destructive",
        });
        setLocation("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Try to get user profile from users collection
      let profileData = null;
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          profileData = userDoc.data();
        }
      } catch (error) {
        console.log(
          "No profile in users collection, checking employees...",
          error
        );
      }

      // If no profile in users, try employees collection using UID as doc ID
      if (!profileData) {
        try {
          const empDoc = await getDoc(doc(db, "employees", currentUser.uid));
          if (empDoc.exists()) {
            profileData = {
              ...empDoc.data(),
              employeeId: empDoc.id,
            };
          }
        } catch (error) {
          console.log(
            "No profile in employees collection with UID as doc ID",
            error
          );
        }
      }

      // If still no profile, try to find employee with matching UID field
      if (!profileData) {
        try {
          const empQuery = query(
            collection(db, "employees"),
            where("uid", "==", currentUser.uid)
          );
          const empSnapshot = await getDocs(empQuery);
          if (!empSnapshot.empty) {
            const empDoc = empSnapshot.docs[0];
            profileData = {
              ...empDoc.data(),
              employeeId: empDoc.id,
            };
          }
        } catch (error) {
          console.log(
            "No profile in employees collection with matching UID field",
            error
          );
        }
      }

      if (profileData) {
        setUserProfile({
          name: profileData.name || currentUser.displayName || "",
          email: profileData.email || currentUser.email || "",
          employeeId: profileData.employeeId || "",
          division: profileData.division || "",
          phone: profileData.phone || "",
          address: profileData.address || "",
        });
      } else {
        // If no profile exists, create a basic one from auth data
        setUserProfile({
          name: currentUser.displayName || "",
          email: currentUser.email || "",
          employeeId: "",
          division: "",
          phone: "",
          address: "",
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Update user profile in both users and employees collections
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(
        userRef,
        {
          name: userProfile.name,
          email: userProfile.email,
          employeeId: userProfile.employeeId,
          division: userProfile.division,
          phone: userProfile.phone,
          address: userProfile.address,
          uid: currentUser.uid, // Store UID for consistency
        },
        { merge: true }
      );

      // If the user exists in employees collection, update there too
      const empRef = doc(db, "employees", currentUser.uid);
      const empDoc = await getDoc(empRef);
      if (empDoc.exists()) {
        await updateDoc(empRef, {
          name: userProfile.name,
          email: userProfile.email,
          division: userProfile.division,
          phone: userProfile.phone,
          address: userProfile.address,
        });
      }

      setEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLocation("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          User Profile
        </h1>
        <p className="text-gray-500 mt-2">
          Manage your personal information and account settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={userProfile.name}
                onChange={(e) =>
                  setUserProfile({ ...userProfile, name: e.target.value })
                }
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userProfile.email}
                onChange={(e) =>
                  setUserProfile({ ...userProfile, email: e.target.value })
                }
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={userProfile.employeeId}
                onChange={(e) =>
                  setUserProfile({ ...userProfile, employeeId: e.target.value })
                }
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division">Division</Label>
              <Input
                id="division"
                value={userProfile.division}
                onChange={(e) =>
                  setUserProfile({ ...userProfile, division: e.target.value })
                }
                disabled={!editing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={userProfile.phone}
              onChange={(e) =>
                setUserProfile({ ...userProfile, phone: e.target.value })
              }
              disabled={!editing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={userProfile.address}
              onChange={(e) =>
                setUserProfile({ ...userProfile, address: e.target.value })
              }
              disabled={!editing}
            />
          </div>

          <div className="flex gap-2 pt-4">
            {editing ? (
              <>
                <Button onClick={handleSave}>Save Changes</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    fetchUserProfile();
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit Profile</Button>
            )}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="ml-auto"
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-gray-500">
                Change your password securely via email
              </p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  if (!userProfile.email) {
                    toast({
                      title: "Error",
                      description: "No email address found for this user",
                      variant: "destructive",
                    });
                    return;
                  }
                  await sendPasswordResetEmail(auth, userProfile.email);
                  toast({
                    title: "Email Sent",
                    description: `Password reset link sent to ${userProfile.email}`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
