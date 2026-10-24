import { MapPin, Bus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { transitDirectionsUrl } from "@/lib/geo/directions";

export interface GettingThereProps {
  patientTown: string;
  travelRadiusMiles: number;
  facility: string;
  city: string | null;
  distanceMiles: number | null;
  visitCount: number | null;
  durationWeeks: number | null;
  remoteOption: boolean | null;
  compensationMentioned: boolean | null;
}

export function GettingThere(props: GettingThereProps) {
  const url = transitDirectionsUrl(props.patientTown, props.facility, props.city);
  const tooFar = props.distanceMiles != null && props.distanceMiles > props.travelRadiusMiles;

  return (
    <Card>
      <CardContent className="pt-6 sm:pt-7">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Getting there</h2>
        <p className="mt-3 flex items-start gap-2 text-[1.05rem] font-semibold text-tc-ink">
          <MapPin className="mt-1 size-5 shrink-0 text-tc-primary" aria-hidden />
          <span>
            {props.facility}{props.city ? `, ${props.city}` : ""}
            {props.distanceMiles != null ? ` · ${props.distanceMiles} mi from ${props.patientTown}` : ""}
          </span>
        </p>
        {tooFar ? (
          <p className="mt-3 rounded-2xl bg-tc-warning-soft px-5 py-3 text-[1rem] font-semibold text-tc-warning-ink">
            A bit farther than your {props.travelRadiusMiles}-mile limit.
          </p>
        ) : null}

        <div className="mt-3 space-y-1 text-[1rem] text-tc-ink-2">
          {props.visitCount != null || props.durationWeeks != null ? (
            <p>
              About {props.visitCount ?? "several"} visits
              {props.durationWeeks != null ? ` over ${props.durationWeeks} weeks` : ""}.
            </p>
          ) : null}
          {props.remoteOption ? <p>Some visits can be done from home.</p> : null}
          {props.compensationMentioned ? (
            <p>The study mentions payment or travel reimbursement. Ask the study team for details.</p>
          ) : null}
        </div>

        <Button asChild variant="outline" className="mt-4">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Bus aria-hidden /> Transit directions
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
