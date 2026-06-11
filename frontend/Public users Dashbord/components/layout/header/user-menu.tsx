"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Bell, CreditCard, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PUBLIC_LOGIN_URL } from "@/lib/auth-urls";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

type WtcUser = {
  name?: string;
  email?: string;
  avatar?: string | null;
};

export default function UserMenu() {
  const [user, setUser] = useState<WtcUser>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wtc_user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  async function handleLogout() {
    const token = localStorage.getItem("wtc_token");
    if (token) {
      try {
        await fetch(`${API}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
      } catch {}
    }
    // Clear localStorage
    localStorage.removeItem("wtc_token");
    localStorage.removeItem("wtc_user");
    // Clear the auth cookie
    document.cookie = "wtc_token=; path=/; max-age=0; SameSite=Lax";
    window.location.replace(PUBLIC_LOGIN_URL);
  }

  const displayName = user.name || "User";
  const displayEmail = user.email || "";
  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer">
          {user.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
          <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60" align="end">
        <DropdownMenuLabel className="p-0">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar>
              {user.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="text-muted-foreground truncate text-xs">{displayEmail}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
