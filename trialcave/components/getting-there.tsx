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
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Getting there</h2>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          {props.facility}{props.city ? `, ${props.city}` : ""}
          {props.distanceMiles != null ? ` · ${props.distanceMiles} mi from ${props.patientTown}` : ""}
        </p>
        {tooFar ? (
          <p className="mt-1 text-sm text-tc-warning">A bit farther than your {props.travelRadiusMiles}-mile limit.</p>
        ) : null}

        {props.visitCount != null || props.durationWeeks != null ? (
          <p className="mt-2 text-sm text-muted-foreground">
            About {props.visitCount ?? "several"} visits
            {props.durationWeeks != null ? ` over ${props.durationWeeks} weeks` : ""}.
          </p>
        ) : null}
        {props.remoteOption ? <p className="text-sm text-muted-foreground">Some visits can be done from home.</p> : null}
        {props.compensationMentioned ? (
          <p className="text-sm text-muted-foreground">The study mentions payment or travel reimbursement. Ask the study team for details.</p>
        ) : null}

        <Button asChild variant="outline" size="sm" className="mt-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            <Bus className="size-4" aria-hidden /> Transit directions
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
