"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Loader2, Download, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uploadDocument, getDemoDocument } from "./actions";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];

export function UploadPanel({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    // Browsers sometimes report an empty type (e.g. downloaded files on
    // Windows), so fall back to the extension. The server checks the real
    // file contents either way.
    const isAccepted = (f: File) =>
      ACCEPTED.includes(f.type) || (f.type === "" && /\.(pdf|jpe?g|png)$/i.test(f.name)) || (f.type === "" && !f.name.includes("."));
    const bad = list.filter((f) => !isAccepted(f));
    if (bad.length) toast.error("Only PDF, JPG, or PNG files can be added.");
    const good = list.filter(isAccepted);
    setSelected((prev) => {
      const next = [...prev, ...good];
      if (next.length > 5) toast.message("You can add up to 5 pages at a time.");
      return next.slice(0, 5);
    });
    // Reset so picking the same file again still fires onChange.
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function submit() {
    if (selected.length === 0) return;
    const fd = new FormData();
    for (const f of selected) fd.append("files", f);
    startTransition(async () => {
      try {
        const res = await uploadDocument(fd);
        if (!res.ok) {
          toast.error(res.error ?? "Upload failed.");
          return;
        }
        if (res.status === "failed") {
          toast.error("We couldn't read that document. Try a clearer photo, or enter results by hand.");
        } else {
          toast.success("Done reading. Check each item before it's used.");
        }
        setSelected([]);
        if (res.documentId) router.push(`/app/records/${res.documentId}`);
      } catch {
        toast.error("Upload failed. The file may be too large, or the connection dropped. Try again.");
      }
    });
  }

  function downloadSample() {
    startTransition(async () => {
      try {
        const res = await getDemoDocument();
        if (!res.ok || !res.base64) {
          toast.error(res.error ?? "Couldn't generate the sample.");
          return;
        }
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = res.fileName ?? "sample.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Sample downloaded. Upload it below to see the review step.");
      } catch {
        toast.error("Couldn't generate the sample.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 sm:pt-7">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Add a record</h2>
        <p className="mt-1 text-[1.05rem] text-tc-ink-2">
          Upload a visit summary or lab report, or take photos of your paperwork.
          We read it and show you everything to confirm before anything is used.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPick(e.dataTransfer.files);
          }}
          className={cn(
            "mt-5 rounded-2xl border-2 border-dashed p-6 transition-colors",
            dragging ? "border-tc-primary bg-tc-primary-soft" : "border-tc-border bg-tc-mist",
          )}
        >
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={() => cameraRef.current?.click()} disabled={pending}>
              <Camera aria-hidden /> Take photos
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
              <Upload aria-hidden /> Upload a file
            </Button>
            {demoMode ? (
              <Button type="button" variant="ghost" onClick={downloadSample} disabled={pending}>
                <Download aria-hidden /> Download a sample visit summary
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-[0.95rem] text-tc-muted">Or drag files here. PDF, JPG, or PNG, up to 5 pages.</p>
        </div>

        {/* Camera capture: on a phone this opens the rear camera directly. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => onPick(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => onPick(e.target.files)}
        />

        {selected.length > 0 ? (
          <div className="mt-5 rounded-2xl bg-tc-primary-soft p-5">
            <p className="text-[1.05rem] font-bold text-tc-primary-ink">
              {selected.length} page{selected.length > 1 ? "s" : ""} ready
            </p>
            <ul className="mt-2 space-y-1 text-[1rem] text-tc-ink">
              {selected.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                  <span className="truncate">{f.name || `Photo ${i + 1}`}</span>
                  <button
                    type="button"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary/30"
                    aria-label={`Remove ${f.name || `photo ${i + 1}`}`}
                    onClick={() => setSelected((s) => s.filter((_, j) => j !== i))}
                    disabled={pending}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {pending ? "Reading your document…" : "Process & review"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelected([])} disabled={pending}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
