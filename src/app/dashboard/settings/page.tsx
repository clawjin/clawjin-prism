import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your workspace profile and billing plan.
        </p>
      </div>

      <div className="glass rounded-2xl p-5 sm:p-6">
        <SettingsForm
          user={{
            name: user.name,
            companyName: user.companyName,
            email: user.email,
            plan: user.plan,
          }}
        />
      </div>
    </div>
  );
}
