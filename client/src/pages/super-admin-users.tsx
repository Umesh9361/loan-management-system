import React from "react";
import { useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";

export function SuperAdminUsers() {
  const [location] = useLocation();
  const { safeNavigate } = useSafeNavigation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 font-noto mb-4">
            यूजर व्यवस्थापन
          </h1>
          <p className="text-gray-600 mb-8">
            सर्व टेनंट्स च्या यूजर्सचे व्यवस्थापन
          </p>
          <button 
            onClick={() => safeNavigate('/super-admin/password-requests')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg"
          >
            पासवर्ड रीसेट व्यवस्थापन
          </button>
        </div>
      </div>
    </div>
  );
}