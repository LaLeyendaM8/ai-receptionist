// frontend/app/signup/page.tsx
// => Server-Komponente, kein "use client" hier!

import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";
export const revalidate = 0; // EXPLIZIT: kein Caching, keine SSG-Probleme

export default function SignupPage() {
  return <SignupForm />;
}
