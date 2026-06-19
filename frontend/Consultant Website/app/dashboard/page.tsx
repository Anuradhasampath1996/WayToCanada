"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, LogOut, Users, FileText, Clock, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserData {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  roles: string[];
}

export default function ConsultantDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wtc_token");
    const userData = localStorage.getItem("wtc_user");
    if (!stored || !userData) {
      router.replace("/login");
      return;
    }
    const parsed: UserData = JSON.parse(userData);
    if (!parsed.roles.includes("rcic")) {
      router.replace("/login");
      return;
    }
    setUser(parsed);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("wtc_token");
    localStorage.removeItem("wtc_user");
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top nav */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <Briefcase className="h-5 w-5" />
            <span>RCICMASTER</span>
            <Badge variant="outline" className="text-xs ml-1">Consultant</Badge>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium hidden sm:block">{user.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:block">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Welcome banner */}
        <div className="rounded-xl bg-primary text-primary-foreground px-8 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}! 🏛️</h1>
            <p className="text-primary-foreground/80 mt-1 text-sm">
              Manage your clients and immigration cases from your consultant dashboard.
            </p>
          </div>
          <Badge variant="secondary" className="text-primary font-semibold">RCIC Consultant</Badge>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Active Clients", value: "0", icon: Users, color: "text-blue-500" },
            { title: "Open Cases", value: "0", icon: FileText, color: "text-purple-500" },
            { title: "Pending Reviews", value: "0", icon: Clock, color: "text-yellow-500" },
            { title: "Avg. Rating", value: "—", icon: Star, color: "text-amber-500" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No clients yet. Complete your profile to get matched.</p>
                <Button size="sm" variant="outline">Complete Profile</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Full Name", value: user.name },
                { label: "Email", value: user.email },
                { label: "Role", value: "RCIC Consultant" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
