import { redirect } from "next/navigation";
import { currentBuildUser } from "@/lib/build-auth";
import BuildApp from "@/components/BuildApp";

export const metadata = { title: "BuildKhata" };

export default async function BuildHomePage() {
  const me = await currentBuildUser();
  if (!me) redirect("/build/login");
  return <BuildApp meName={me.name} />;
}
