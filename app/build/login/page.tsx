import { redirect } from "next/navigation";
import { currentBuildUser } from "@/lib/build-auth";
import BuildLoginForm from "@/components/BuildLoginForm";

export const metadata = { title: "Login · BuildKhata" };

export default async function BuildLoginPage() {
  const me = await currentBuildUser();
  if (me) redirect("/build");
  return (
    <main className="min-h-screen bg-amber-50/60 px-4 py-14">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl">📒</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-amber-900">BuildKhata</h1>
          <p className="mt-1 text-sm text-amber-900/60">Builder project expense book</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <BuildLoginForm />
        </div>
      </div>
    </main>
  );
}
