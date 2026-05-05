"use client";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Page() {
  useEffect(() => {
    window.location.replace("http://localhost:3001/login");
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}

