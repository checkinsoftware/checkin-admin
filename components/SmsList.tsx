"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeleteSmsButton from "@/components/DeleteSmsButton";
import { formatIST, formatISTLong } from "@/lib/time";

export type SmsRowDTO = {
  id: string;
  recipient: string;
  guest_name: string | null;
  message: string;
  status: string;
  provider: string | null;
  error: string | null;
  source_ip: string | null;
  created_at: string;
  sent_at: string | null;
};

export type GuestDTO = { joined: string; devices: number; installed: boolean };

type Props = {
  initialRows: SmsRowDTO[];
  initialGuests: Record<string, GuestDTO>;
  initialPages: number;
  /** Filter query string without `page`, so each load-more keeps the same filters. */
  query: string;
  isHotel: boolean;
};

/** The hotel's receipts say "Entry Receipt" / "Exit Receipt" — surface that as a pill. */
function kindOf(message: string): "entry" | "exit" | null {
  const text = message.toLowerCase();
  if (text.includes("entry receipt")) return "entry";
  if (text.includes("exit receipt")) return "exit";
  return null;
}

function Pills({ row }: { row: SmsRowDTO }) {
  const kind = kindOf(row.message);
  return (
    <>
      {kind && <span className={`pill pill-${kind}`}>{kind.toUpperCase()}</span>}
      <span className={`pill pill-${row.status}`}>{row.status.toUpperCase()}</span>
    </>
  );
}

function Mobile({ row, guest }: { row: SmsRowDTO; guest: GuestDTO | undefined }) {
  return (
    <>
      <div>
        {guest?.installed && <img src="/icon-192.png" alt="" className="gicon" title="Installed app" />}
        {row.recipient}
      </div>
      {row.guest_name && <div className="dim">{row.guest_name}</div>}
      {guest ? (
        <>
          <div className="gmeta">
            {guest.installed && <span className="gpill on">APP</span>}
            <span
              className={`gpill ${guest.devices > 0 ? "on" : "off"}`}
              title={guest.devices > 0 ? `${guest.devices} device(s) will get push notifications` : "No device has notifications turned on"}
            >
              PUSH {guest.devices > 0 ? "ON" : "OFF"}
            </span>
          </div>
          <div className="gjoined">Joined {formatISTLong(guest.joined)}</div>
        </>
      ) : (
        <div className="gjoined">Not logged in yet</div>
      )}
    </>
  );
}

export default function SmsList({ initialRows, initialGuests, initialPages, query, isHotel }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [guests, setGuests] = useState(initialGuests);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(initialPages);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const hasMore = page < pages;

  const loadMore = useCallback(async () => {
    if (busy.current || page >= pages) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const sep = query ? "&" : "";
      const res = await fetch(`/api/admin/sms/list?${query}${sep}page=${page + 1}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        rows: SmsRowDTO[];
        guests: Record<string, GuestDTO>;
        pages: number;
      };
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...data.rows.filter((r) => !seen.has(r.id))];
      });
      setGuests((prev) => ({ ...prev, ...data.guests }));
      setPages(data.pages);
      setPage((p) => p + 1);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [page, pages, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || failed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "500px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, failed, loadMore]);

  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const footer = (
    <div ref={sentinel} className="listend">
      {failed ? (
        <button className="btn btn-ghost" onClick={loadMore}>
          Couldn&apos;t load more. Tap to retry
        </button>
      ) : loading ? (
        "Loading more…"
      ) : hasMore ? (
        "Scroll for more"
      ) : rows.length > 0 ? (
        `End of list · ${rows.length.toLocaleString("en-IN")} shown`
      ) : null}
    </div>
  );

  return (
    <>
      {/* desktop table */}
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th style={{ width: 55 }}>S.No.</th>
              <th style={{ width: 190 }}>Mobile No</th>
              <th>SMS Text</th>
              <th style={{ width: 150 }}>Source IP</th>
              <th style={{ width: 150 }}>Created (IST)</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="dim" style={{ padding: "34px 10px", textAlign: "center" }}>
                  No messages found. Try clearing the filters.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td className="mono">{i + 1}</td>
                <td className="mono">
                  <Mobile row={row} guest={guests[row.recipient]} />
                </td>
                <td className="sms-text">
                  <Pills row={row} />
                  {row.message}
                  {row.error && <div style={{ color: "#c0392b", fontSize: 12 }}>⚠ {row.error}</div>}
                </td>
                <td className="dim mono">{row.source_ip || "—"}</td>
                <td className="dim mono">{formatIST(row.sent_at ?? row.created_at)}</td>
                <td>{isHotel ? <span className="dim">—</span> : <DeleteSmsButton id={row.id} onDeleted={remove} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="cards">
        {rows.length === 0 && (
          <div className="mcard dim" style={{ textAlign: "center" }}>
            No messages found.
          </div>
        )}
        {rows.map((row, i) => (
          <div className="mcard" key={row.id}>
            <div className="top">
              <span className="num">#{i + 1}</span>
              <Pills row={row} />
            </div>
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <Mobile row={row} guest={guests[row.recipient]} />
            </div>
            <div className="txt">{row.message}</div>
            {row.error && <div style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>⚠ {row.error}</div>}
            <div className="meta">
              <span>{row.source_ip || row.provider || ""}</span>
              <span>{formatIST(row.sent_at ?? row.created_at)} IST</span>
            </div>
            {!isHotel && (
              <div style={{ marginTop: 10 }}>
                <DeleteSmsButton id={row.id} onDeleted={remove} />
              </div>
            )}
          </div>
        ))}
      </div>

      {footer}
    </>
  );
}
