import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  division: string;
  uid?: string;
  email?: string;
}

export default function Register() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
      // Filter out already registered employees (those with uid or email)
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
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Create User Profile with Role
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        role: "employee",
        employeeId: selectedEmployeeId, // Link to employee document ID
        createdAt: new Date().toISOString(),
      });

      // 3. Update Employee document with uid and email
      const employeeRef = doc(db, "employees", selectedEmployeeId);
      await updateDoc(employeeRef, {
        uid: user.uid,
        email: email,
      });

      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      setLocation("/");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Failed to create account.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src="/logo.png" alt="HRGroup Logo" className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            HRGroup Magang
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Employee Registration
          </p>
        </div>

        <Card className="border-gray-200 dark:border-gray-800 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>
              Link your profile and set up your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  value={selectedDivision}
                  onValueChange={(value) => {
                    setSelectedDivision(value);
                    setSelectedEmployeeId(""); // Reset selected employee when division changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your division" />
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

              <div className="space-y-2">
                <Label>Name</Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  disabled={!selectedDivision}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedDivision
                          ? "Select your name"
                          : "Select division first"
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
                    No unregistered employees found in this division.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Input Your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white dark:bg-gray-950"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  placeholder="Input Your Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white dark:bg-gray-950"
                />
              </div>
              <Button
                type="submit"
                className="w-full font-medium"
                disabled={isLoading || !selectedEmployeeId}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Register"
                )}
              </Button>
              <div className="text-center text-sm">
                <span className="text-gray-500">Already have an account? </span>
                <a
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
