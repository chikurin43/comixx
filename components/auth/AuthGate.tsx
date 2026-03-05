"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <main><section className="panel"><p>Loading session...</p></section></main>;
  }

  if (status === "unauthenticated") {
    return <main><section className="panel"><p>ログインページへ移動します...</p></section></main>;
  }

  return <>{children}</>;
}
