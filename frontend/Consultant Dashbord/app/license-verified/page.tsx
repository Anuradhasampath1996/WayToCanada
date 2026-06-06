"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LicenseVerifiedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-10 max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Licence Verified!</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your RCIC licence has been successfully verified. You can now log in
            to your consultant dashboard and access all features.
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() => {
            window.location.href = "http://localhost:3002/login";
          }}
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
}
