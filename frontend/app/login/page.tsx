"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthModal } from "@/lib/auth-modal";

export default function LoginPage() {
  const router = useRouter();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    openLogin();
    router.replace("/");
  }, [openLogin, router]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-zinc-500 sm:px-6">
      Opening login…
    </div>
  );
}
