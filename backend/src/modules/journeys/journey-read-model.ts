import type { JourneyStatus } from "../../domain/enums.js";

export function formatJourneyNextCheckpoint(input: {
  readonly status: JourneyStatus;
  readonly nextCheckpointAt: string | null;
  readonly formatScheduledCheckpoint: (value: string) => string;
}) {
  if (input.status === "completed") {
    return "Completed";
  }

  if (input.status === "paused") {
    return "Paused";
  }

  if (input.nextCheckpointAt) {
    return input.formatScheduledCheckpoint(input.nextCheckpointAt);
  }

  return "Not scheduled";
}
