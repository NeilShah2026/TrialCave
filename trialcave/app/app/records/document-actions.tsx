"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteDocument, getDocumentUrl } from "./actions";

/** View original + Delete for one document (B14.3 Records). */
export function DocumentActions({
  documentId,
  confirmedCount,
  hasFile,
  afterDelete,
}: {
  documentId: string;
  confirmedCount: number;
  hasFile: boolean;
  afterDelete?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function view() {
    // Open the tab during the click so popup blockers allow it, then point it
    // at the short-lived signed URL once the server returns it.
    const tab = window.open("", "_blank");
    if (tab) {
      tab.opener = null;
      tab.document.title = "Opening your document…";
    }
    startTransition(async () => {
      try {
        const res = await getDocumentUrl(documentId);
        if (!res.ok || !res.url) {
          tab?.close();
          toast.error(res.error ?? "Couldn't open the file.");
          return;
        }
        if (tab) tab.location.href = res.url;
        else window.location.assign(res.url);
      } catch {
        tab?.close();
        toast.error("Couldn't open the file. Try again.");
      }
    });
  }

  function remove(alsoFacts: boolean) {
    startTransition(async () => {
      const res = await deleteDocument(documentId, alsoFacts);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't delete.");
        return;
      }
      toast.success(alsoFacts && confirmedCount > 0 ? "Deleted the document and its items." : "Deleted the document.");
      setConfirming(false);
      if (afterDelete) router.push(afterDelete);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div role="alertdialog" aria-label="Delete this document?" className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-5 text-[1rem] text-tc-ink shadow-pop">
        <span className="w-full font-bold">Delete this document?</span>
        {confirmedCount > 0 ? (
          <>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(true)}>
              Delete + remove {confirmedCount} item{confirmedCount === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => remove(false)}>
              Delete file, keep items
            </Button>
          </>
        ) : (
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(true)}>
            Delete
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {hasFile ? (
        <Button size="sm" variant="outline" onClick={view} disabled={pending}>
          <ExternalLink aria-hidden /> View original
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className="text-tc-danger-ink hover:bg-tc-danger-soft" onClick={() => setConfirming(true)} disabled={pending}>
        <Trash2 aria-hidden /> Delete
      </Button>
    </div>
  );
}
