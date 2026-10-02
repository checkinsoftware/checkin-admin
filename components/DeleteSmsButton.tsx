"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteSmsButton({ id, onDeleted }: { id: string; onDeleted?: (id: string) => void }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/sms/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (onDeleted) onDeleted(id);
      else router.refresh();
    } else setBusy(false);
    setAsking(false);
  }

  if (asking) {
    return (
      <span className="sms-confirm">
        <button className="btn-del" onClick={remove} disabled={busy}>
          {busy ? "…" : "Sure?"}
        </button>
        <button className="btn-ghost-sm" onClick={() => setAsking(false)}>
          No
        </button>
      </span>
    );
  }

  return (
    <button className="btn-del" onClick={() => setAsking(true)}>
      Delete SMS
    </button>
  );
}
