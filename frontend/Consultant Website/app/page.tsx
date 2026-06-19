import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingServices } from "@/components/landing/landing-services";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { LandingMobileApp } from "@/components/landing/landing-mobile-app";
import { LandingSecurity } from "@/components/landing/landing-security";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingCta } from "@/components/landing/landing-cta";

export default function ConsultantHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingServices />
        <FeatureShowcase />
        <LandingMobileApp />
        <LandingSecurity />
        <LandingTestimonials />
        <LandingPricing />
        <LandingCta />
      </main>

      <Footer />
    </div>
  );
}
