"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/subscribe");
  }, [router]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-zinc-500 sm:px-6">
      Redirecting to subscribe…
    </div>
  );
}
