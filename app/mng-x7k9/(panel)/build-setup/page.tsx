import BuildSetupButton from "@/components/BuildSetupButton";

export const metadata = { title: "BuildKhata setup" };

export default function BuildSetupPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-800">BuildKhata — one-time setup</h1>
      <p className="mt-1 text-sm text-slate-500">
        Builder project expense app. Yahan ek baar password set karein — tables aur 5 users ban jayenge.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BuildSetupButton />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Aage kya karna hai</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Upar password type karke <strong>“Create tables + 5 users”</strong> dabaayein.</li>
          <li>
            Phone/laptop par app kholein: <br />
            <a href="/build/login" className="font-medium text-amber-700 underline">
              checkin.co.in/build/login
            </a>
          </li>
          <li>
            Login karein — username <strong>rahul</strong> (ya suresh / amit / priya / vikas) + wahi password.
          </li>
          <li>Phone par “Add to Home Screen” se app icon bana lein.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-400">
          Password badalna ho to yahi dobara set karke button dabayein — sabhi 5 ka password update ho jayega.
        </p>
      </div>
    </div>
  );
}
