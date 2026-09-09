import Image from "next/image";

type LogoProps = {
  /** icon = shield-sized mark for collapsed sidebar; full = wordmark lockup */
  variant?: "icon" | "full";
  className?: string;
};

export default function Logo({ variant = "icon", className = "" }: LogoProps) {
  if (variant === "full") {
    return (
      <Image
        src="/logo.png"
        width={180}
        height={40}
        className={`h-8 w-auto object-contain object-left ${className}`}
        alt="RCIC MASTER"
        priority
      />
    );
  }

  return (
    <Image
      src="/logo.png"
      width={40}
      height={40}
      className={`size-8 object-contain object-left ${className}`}
      alt="RCIC MASTER"
      priority
    />
  );
}
