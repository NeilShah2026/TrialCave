"use client";

import { useState } from "react";
import { MousePointerClick } from "lucide-react";

const ITEMS = [
  { id: "name", label: "First name", on: true },
  { id: "phone", label: "Phone number", on: true },
  { id: "age", label: "Age", on: true },
  { id: "a1c", label: "Diagnosis and latest A1C", on: false },
  { id: "meds", label: "Current medications", on: false },
];

/** Try-it invitation: the share button counts what you've checked. Nothing is sent. */
export function InviteDemo() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.id, i.on])),
  );
  const [result, setResult] = useState("");
  const count = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <p className="try">
        <MousePointerClick className="i" aria-hidden /> Try it. This is only an example.
      </p>
      <div className="invite">
        <p className="invite-from">Invitation from Commonwealth Research Clinic</p>
        <h3>A diabetes study 6 miles from you would like to talk.</h3>
        <fieldset>
          <legend>Choose what they can see</legend>
          {ITEMS.map((i) => (
            <label key={i.id} className="check">
              <input
                type="checkbox"
                checked={checked[i.id]}
                onChange={(e) => {
                  setChecked((c) => ({ ...c, [i.id]: e.target.checked }));
                  setResult("");
                }}
              />
              {i.label}
            </label>
          ))}
        </fieldset>
        <div className="invite-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={count === 0}
            onClick={() => setResult(`Done. The clinic sees only the ${count} ${count === 1 ? "item" : "items"} you chose.`)}
          >
            Share {count} {count === 1 ? "item" : "items"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setResult("No problem. The clinic never learns who you are.")}>
            Not now
          </button>
        </div>
        <p className="invite-result" role="status">
          {result}
        </p>
      </div>
    </div>
  );
}
