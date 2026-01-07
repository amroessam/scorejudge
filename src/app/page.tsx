import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DEBUG_MODE } from "@/lib/config";
import DebugLoginButton from "./debug-login-button";
import { GlobalLeaderboard } from "@/components/home/GlobalLeaderboard";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-6 bg-[var(--background)] safe-pb">
      {/* Hero Section */}
      <div className="max-w-xs w-full space-y-12 text-center pt-12">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
          ScoreJudge
        </h1>

        <div className="flex flex-col gap-4">
          <Link
            href="/api/auth/signin"
            className="w-full bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 py-4 rounded-full font-bold text-lg shadow-lg transition-transform active:scale-95"
          >
            Start Game
          </Link>

          <Link
            href="/api/auth/signin"
            className="w-full text-[var(--muted-foreground)] hover:text-white py-2 font-medium transition-colors"
          >
            Join Existing Game
          </Link>

          {DEBUG_MODE && <DebugLoginButton />}
        </div>
      </div>

      {/* Global Leaderboard */}
      <div className="w-full max-w-md mt-12">
        <GlobalLeaderboard />
      </div>

      <footer className="mt-auto pb-6 flex justify-center gap-4 text-sm text-[var(--muted-foreground)]">
        <Link
          href="/privacy"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Privacy Policy
        </Link>
        <span>•</span>
        <Link
          href="/terms"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
