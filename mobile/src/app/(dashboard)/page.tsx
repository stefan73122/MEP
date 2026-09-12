"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InicioDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ventas/nueva");
  }, [router]);

  return null;
}
