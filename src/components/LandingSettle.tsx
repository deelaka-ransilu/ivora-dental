import type { CSSProperties } from "react";
import { Settle } from "@lucasmarkes/hairline/react";

const plate = {
  "--hairline-plate": "var(--tint-sky)",
} as CSSProperties;

export default function LandingSettle() {
  return (
    <div style={plate}>
      <p className="mb-3 text-sm text-muted">
        Three branches, one schedule. No double-booking.
      </p>
      <Settle
        play
        label="Tiles sliding into one connected schedule"
        className="w-full"
      />
    </div>
  );
}
