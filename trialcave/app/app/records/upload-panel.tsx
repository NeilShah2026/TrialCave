"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { uploadDocument, getDemoDocument } from "./actions";

export function UploadPanel({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function onPick(files: FileList | null) {
    if (!files) return;
    setSelected((prev) => [...prev, ...Array.from(files)].slice(0, 5));
  }

  function submit() {
    if (selected.length === 0) return;
    const fd = new FormData();
    for (const f of selected) fd.append("files", f);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (!res.ok) {
        toast.error(res.error ?? "Upload failed.");
        return;
      }
      if (res.status === "failed") {
        toast.error("We couldn't read that document. Try a clearer photo, or enter results by hand.");
      }
      setSelected([]);
      if (res.documentId) router.push(`/app/records/${res.documentId}`);
    });
  }

  function downloadSample() {
    startTransition(async () => {
      const res = await getDemoDocument();
      if (!res.ok || !res.base64) {
        toast.error(res.error ?? "Couldn't generate sample.");
        return;
      }
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${res.base64}`;
      link.download = res.fileName ?? "sample.pdf";
      link.click();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Add a record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a visit summary or lab report, or take photos of your paperwork.
          We read it and show you everything to confirm before anything is used.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" /> Take photos
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Upload a file
          </Button>
          {demoMode ? (
            <Button type="button" variant="ghost" onClick={downloadSample} disabled={pending}>
              Download a sample visit summary
            </Button>
          ) : null}
        </div>

        {/* Camera capture: on a phone this opens the rear camera directly. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />

        {selected.length > 0 ? (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium">
              {selected.length} page{selected.length > 1 ? "s" : ""} ready
            </p>
            <ul className="mt-1 text-xs text-muted-foreground">
              {selected.map((f, i) => (
                <li key={i}>{f.name || `photo ${i + 1}`}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending ? "Reading your document…" : "Process & review"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])} disabled={pending}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
