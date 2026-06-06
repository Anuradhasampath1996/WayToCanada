"use client";
import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    window.location.replace("http://localhost:3002/login");
  }, []);
  return null;
}
