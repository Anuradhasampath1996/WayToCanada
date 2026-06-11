"use client";
import { useEffect } from "react";
import { CONSULTANT_LOGIN_URL } from "@/lib/auth-urls";

export default function RootPage() {
  useEffect(() => {
    window.location.replace(CONSULTANT_LOGIN_URL);
  }, []);
  return null;
}
