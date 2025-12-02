import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FirebaseErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [detailedError, setDetailedError] = useState("");

  useEffect(() => {
    // Check if Firebase is initialized
    const checkFirebase = async () => {
      try {
        const { auth, db } = await import("@/lib/firebase");
        
        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!auth || !db) {
          setHasError(true);
          setErrorMessage(
            "Firebase services are not initialized. Check console (F12) for details."
          );
          setDetailedError(
            "Auth: " + (auth ? "✅" : "❌") + "\nFirestore: " + (db ? "✅" : "❌")
          );
        }
      } catch (error: any) {
        setHasError(true);
        setErrorMessage(error.message || "Failed to initialize Firebase");
        setDetailedError(JSON.stringify(error, null, 2));
      }
    };

    checkFirebase();
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Firebase Configuration Error
          </h1>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            {errorMessage}
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
              Quick Fix:
            </h2>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>
                1. Open <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">.env.local</code>
              </li>
              <li>
                2. Verify all Firebase credentials are present and correct
              </li>
              <li>3. Check Firebase Console for API key restrictions</li>
              <li>4. Remove domain restrictions from API key</li>
              <li>5. Restart your development server</li>
              <li>6. Clear browser cache (Ctrl+Shift+Delete)</li>
            </ol>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showDetails ? "Hide" : "Show"} Technical Details
            </button>
            
            {showDetails && (
              <div className="mt-3 bg-gray-900 dark:bg-gray-950 rounded p-3 text-xs text-gray-100 font-mono overflow-auto max-h-48">
                <pre>{detailedError}</pre>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => window.location.reload()}
              className="w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                console.clear();
                window.location.reload();
              }}
              className="w-full"
            >
              Clear Cache & Retry
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            Open browser console (F12) → Console tab for detailed error messages
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
