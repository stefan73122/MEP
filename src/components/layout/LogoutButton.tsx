"use client";

import { useTransition } from "react";
import { logoutAction } from "@/actions/auth.actions";

export function LogoutButton() {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciarTransicion(() => logoutAction())}
      disabled={enviando}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
    >
      Salir
    </button>
  );
}
