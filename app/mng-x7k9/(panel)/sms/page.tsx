import { Suspense } from "react";
import { cookies } from "next/headers";
import ClearDataButton from "@/components/ClearDataButton";
import Link from "next/link";
import SmsFilters from "@/components/SmsFilters";
import SmsList from "@/components/SmsList";
import { SetupNotice } from "@/components/ui";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  DbNotReady,
  distinctNumbers,
  guestInfo,
  hotelTagsFromUsers,
  listSms,
  parseFilters,
} from "@/lib/sms";

export const dynamic = "force-dynamic";
export const metadata = { title: "SMS Notifications · Checkin Admin" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SmsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  const forcedTag = session?.tag ?? null; // hotel login -> locked to its own tag
  const isHotel = !!forcedTag;

  const filters = parseFilters(sp);
  if (forcedTag) filters.tag = forcedTag; // hotel user can never see other hotels' SMS

  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]]
    )
  );
  qs.delete("page");
  if (forcedTag) qs.set("tag", forcedTag); // keep the lock on export / load-more requests

  let data;
  try {
    data = await listSms(filters);
  } catch (err) {
    if (err instanceof DbNotReady) {
      return (
        <div className="sms-page">
          <h1>SMS Notifications</h1>
          <SetupNotice reason={err.reason} />
        </div>
      );
    }
    throw err;
  }

  let numbers: Awaited<ReturnType<typeof distinctNumbers>> = [];
  let hotels: string[] = [];
  try {
    // The number list covers every guest of every hotel, so a hotel login never gets it.
    if (!isHotel) {
      numbers = await distinctNumbers();
      hotels = await hotelTagsFromUsers();
    }
  } catch {
    numbers = [];
  }

  const { rows, pages, stats } = data;
  const activeStatus = filters.status ?? "";
  // Counters double as status filters: same filters, status swapped.
  const statusHref = (status?: string) => {
    const next = new URLSearchParams(qs.toString());
    if (status && status !== activeStatus) next.set("status", status);
    else next.delete("status");
    return `/mng-x7k9/sms${next.toString() ? `?${next}` : ""}`;
  };
  let guests: Awaited<ReturnType<typeof guestInfo>> = {};
  try {
    guests = await guestInfo(rows.map((r) => r.recipient));
  } catch {
    guests = {};
  }
  const listRows = rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    guest_name: r.guest_name,
    message: r.message,
    status: r.status,
    provider: r.provider,
    error: r.error,
    source_ip: r.source_ip,
    created_at: new Date(r.created_at).toISOString(),
    sent_at: r.sent_at ? new Date(r.sent_at).toISOString() : null,
  }));
  const listGuests = Object.fromEntries(
    Object.entries(guests).map(([m, g]) => [m, { ...g, joined: new Date(g.joined).toISOString() }])
  );

  return (
    <div className="sms-page">
      <h1>SMS Notifications</h1>
      <div className="sub">
        {isHotel
          ? `Aapke hotel ke SMS (${forcedTag}).`
          : "Messages and alerts received on the registered numbers."}
      </div>

      <Suspense fallback={null}>
        <SmsFilters numbers={numbers} hotels={hotels} canDelete={!isHotel} showNumbers={!isHotel} />
      </Suspense>

      <div className="total">
        <Link href={statusHref()} className={`stat${activeStatus ? "" : " active"}`} title="Show all messages">
          Total SMS - {stats.total.toLocaleString("en-IN")}
        </Link>
        <Link
          href={statusHref("delivered")}
          className={`stat${activeStatus === "delivered" ? " active" : ""}`}
          title="Delivery report received from the SMS gateway. Click to filter."
        >
          Delivered {stats.delivered}
        </Link>
        <Link
          href={statusHref("pending")}
          className={`stat${activeStatus === "pending" ? " active" : ""}`}
          title="Sent to the gateway, no delivery report received yet. Click to filter."
        >
          Pending {stats.pending}
        </Link>
        <Link
          href={statusHref("failed")}
          className={`stat${activeStatus === "failed" ? " active" : ""}`}
          title="Gateway reported a failure. Click to filter."
        >
          Failed {stats.failed}
        </Link>
        <a href={`/api/sms/export?${qs.toString()}`} className="btn btn-ghost" style={{ marginLeft: "auto" }}>
          ⤓ Export CSV
        </a>
      </div>

      <SmsList
        key={qs.toString()}
        initialRows={listRows}
        initialGuests={listGuests}
        initialPages={pages}
        query={qs.toString()}
        isHotel={isHotel}
      />

      {!isHotel && (
        <div style={{ marginTop: 18 }}>
          <ClearDataButton total={stats.total} />
        </div>
      )}
    </div>
  );
}
