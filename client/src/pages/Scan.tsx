import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function Scan() {
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize scanner only if we are in scanning mode and haven't initialized yet
    if (isScanning && !scannerRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          "reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      }, 100);

      return () => clearTimeout(timer);
    }

    // Cleanup function
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
    if (processing) return;

    // Stop scanning temporarily
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
    setProcessing(true);

    try {
      const data = JSON.parse(decodedText);
      if (!data.id || !data.name) throw new Error("Invalid QR Code");

      // Get Location
      const location = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser"));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        }
      );

      const { latitude, longitude } = location.coords;

      setScanResult(data);

      // Log attendance to Firebase with Location
      await addDoc(collection(db, "attendance"), {
        employeeId: data.id,
        employeeName: data.name,
        division: data.division,
        timestamp: serverTimestamp(),
        date: new Date().toISOString().split("T")[0],
        type: "check-in",
        location: {
          latitude,
          longitude,
        },
      });

      toast({
        title: "Attendance Recorded",
        description: `Welcome, ${data.name}! Location recorded.`,
      });
    } catch (error: any) {
      console.error("Scan error", error);
      let errorMessage = "Could not recognize employee QR code.";

      if (error.code === 1) {
        // PERMISSION_DENIED
        errorMessage =
          "Location permission denied. Please enable location services.";
      } else if (error.message === "Invalid QR Code") {
        errorMessage = "Invalid QR Code format.";
      }

      setScanResult({ error: errorMessage });
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: errorMessage,
      });
    } finally {
      setProcessing(false);
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Scan Attendance
        </h1>
        <p className="text-gray-500 mt-2">
          Place the QR code within the frame to check in/out.
        </p>
      </div>

      <Card className="overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl">
        <CardContent className="p-0">
          {isScanning ? (
            <div className="bg-black relative min-h-[400px] flex flex-col items-center justify-center text-white">
              <div id="reader" className="w-full"></div>
              <p className="text-sm text-gray-400 absolute bottom-4">
                Ensure good lighting for best results
              </p>
            </div>
          ) : (
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-gray-50/50">
              {processing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium text-gray-600">
                    Processing attendance...
                  </p>
                </div>
              ) : scanResult?.error ? (
                <>
                  <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                    <AlertTriangle className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Scan Failed
                    </h2>
                    <p className="text-gray-500 mt-1">{scanResult.error}</p>
                  </div>
                  <Button onClick={resetScan} size="lg" className="mt-4">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Check In Successful!
                    </h2>
                    <p className="text-gray-500 mt-1">
                      Recorded at {new Date().toLocaleTimeString()}
                    </p>
                  </div>

                  <Card className="w-full max-w-xs border-dashed bg-white">
                    <CardContent className="p-4 text-left space-y-2">
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Name
                        </span>
                        <p className="font-medium">{scanResult?.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Division
                        </span>
                        <p className="text-sm">{scanResult?.division}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">
                          Employee ID
                        </span>
                        <p className="font-mono text-xs text-gray-600">
                          {scanResult?.id}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button onClick={resetScan} size="lg" className="mt-4">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Scan Next
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
