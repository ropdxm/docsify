import * as nodeAmplitude from "@amplitude/analytics-node";

nodeAmplitude.init(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY!, {
  serverZone: "EU", // EU data residency — matches the project region
  flushQueueSize: 10,
  flushIntervalMillis: 0, // flush immediately on each event in serverless context
});

export { nodeAmplitude as amplitude };
