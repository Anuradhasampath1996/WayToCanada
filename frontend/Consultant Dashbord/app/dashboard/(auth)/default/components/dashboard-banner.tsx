"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "Welcome to WayToCanada",
    subtitle: "Your all-in-one platform for Canadian immigration consulting",
    gradient: "from-blue-700 via-blue-600 to-cyan-500",
    image: "/banners/banner1.jpg", // drop images in /public/banners/ if desired
  },
  {
    title: "Stay Up-to-Date with IRCC",
    subtitle: "Latest immigration news, policy updates, and announcements — refreshed daily",
    gradient: "from-indigo-700 via-purple-600 to-pink-500",
    image: "/banners/banner2.jpg",
  },
  {
    title: "Manage Your Clients with Ease",
    subtitle: "Track applications, deadlines, and communications from one dashboard",
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    image: "/banners/banner3.jpg",
  },
  {
    title: "Grow Your Practice",
    subtitle: "Access AI-powered tools to streamline your immigration consulting workflow",
    gradient: "from-orange-500 via-red-500 to-pink-600",
    image: "/banners/banner4.jpg",
  },
];

const AUTO_INTERVAL_MS = 5000;

export function DashboardBanner() {
  const [current, setCurrent] = useState(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(
      () => setCurrent((c) => (c + 1) % SLIDES.length),
      AUTO_INTERVAL_MS
    );
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    startTimer();
    return stopTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(idx: number) {
    setCurrent(idx);
    startTimer(); // reset timer on manual nav
  }

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length);
  const next = () => goTo((current + 1) % SLIDES.length);

  const slide = SLIDES[current];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg select-none" style={{ height: 200 }}>
      {/* Gradient background (always visible) */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r transition-all duration-700",
          slide.gradient
        )}
      />

      {/* Background image (optional — shows if file exists) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      {/* Canada flag watermark */}
      <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-10 text-white text-[7rem] leading-none select-none">
        🍁
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-center px-8 gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
          WayToCanada — Consultant Portal
        </span>
        <h2 className="text-2xl font-extrabold text-white leading-tight max-w-lg">
          {slide.title}
        </h2>
        <p className="text-sm text-white/80 max-w-md leading-relaxed">
          {slide.subtitle}
        </p>
      </div>

      {/* Prev / Next buttons */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === current ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
            )}
          />
        ))}
      </div>
    </div>
  );
}
