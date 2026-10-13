import { Settle } from "@lucasmarkes/hairline/react";

export default function LandingSettle() {
  return (
    <div className="mt-10 w-80 max-w-full">
      <p className="mb-3 text-sm opacity-80">
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
