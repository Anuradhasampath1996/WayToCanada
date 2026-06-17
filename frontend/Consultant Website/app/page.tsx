import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingAdvantages } from "@/components/landing/landing-advantages";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { LandingMobileApp } from "@/components/landing/landing-mobile-app";
import { LandingWhyJoin } from "@/components/landing/landing-why-join";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingCta } from "@/components/landing/landing-cta";

export default function ConsultantHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <LandingHero />
        <LandingPricing />
        <LandingStats />
        <LandingAdvantages />
        <FeatureShowcase />
        <LandingMobileApp />
        <LandingWhyJoin />
        <LandingSteps />
        <LandingCta />
      </main>

      <Footer />
    </div>
  );
}
