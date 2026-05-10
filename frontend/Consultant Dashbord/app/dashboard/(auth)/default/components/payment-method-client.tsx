"use client";

import dynamic from "next/dynamic";

// Loaded client-side only so browser-extension DOM injections (LastPass, etc.)
// don't trigger a hydration mismatch on the card that contains form inputs.
const PaymentMethodCard = dynamic(
  () => import("./payment-method").then((m) => ({ default: m.PaymentMethodCard })),
  { ssr: false }
);

export { PaymentMethodCard };
