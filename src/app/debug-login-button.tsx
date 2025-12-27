"use client";

import { signIn } from "next-auth/react";

export default function DebugLoginButton() {
  const handleDebugLogin = async () => {
    await signIn("anonymous", { callbackUrl: "/dashboard" });
  };

  return (
    <button
      onClick={handleDebugLogin}
      className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-95 mt-4"
    >
      🐛 Debug Login (Anonymous)
    </button>
  );
}

