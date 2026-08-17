import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { AuroraBackground } from "@/components/effects";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <AuroraBackground />
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <Logo className="text-xl" />
        </div>

        <div className="gradient-border relative rounded-3xl">
          <div className="glass-strong relative rounded-3xl p-6 sm:p-8">
            <h1 className="text-xl font-semibold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Sign in to your Clawjin Prism workspace.
            </p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          New to Clawjin Prism?{" "}
          <Link
            href="/signup"
            className="font-medium text-white transition hover:text-white"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
