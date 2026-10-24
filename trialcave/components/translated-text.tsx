"use client";

import { useState } from "react";

/**
 * Shows translated content with a "Machine translation · Show original" toggle.
 * The English original is the official text (B12.2). When machine=false (English
 * or a failed/absent translation), it just renders the text.
 */
export function TranslatedText({
  original,
  translated,
  machine,
}: {
  original: string;
  translated: string;
  machine: boolean;
}) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (!machine) return <span>{original}</span>;

  return (
    <span>
      {showOriginal ? original : translated}
      <button
        type="button"
        onClick={() => setShowOriginal((v) => !v)}
        className="ml-2 text-xs text-primary hover:underline"
      >
        {showOriginal ? "Show translation" : "Machine translation · Show original"}
      </button>
    </span>
  );
}
