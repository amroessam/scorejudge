import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[var(--background)] safe-pb">
      <div className="max-w-xs w-full space-y-12">
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
        </div>
      </div>
      
      <footer className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 text-sm text-[var(--muted-foreground)]">
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
