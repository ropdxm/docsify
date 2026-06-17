"use client";

import * as amplitude from "@amplitude/unified";

amplitude.initAll(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY!, {
  analytics: {
    remoteConfig: { fetchRemoteConfig: true }, // remote SDK config from Amplitude
    autocapture: {
      attribution: true,           // UTM / referrer attribution events
      pageViews: true,             // SPA route changes + initial load
      sessions: true,              // Session start / end events
      formInteractions: true,      // Form starts + submits
      fileDownloads: true,         // Downloads of common file types
      elementInteractions: true,   // Click + change on instrumented els
      frustrationInteractions: true, // Rage clicks, dead clicks
      pageUrlEnrichment: true,     // Adds path / search to event props
      networkTracking: true,       // XHR + fetch request events
      webVitals: true,             // CWV (LCP, INP, CLS) on page hide
    },
  },
  sessionReplay: { sampleRate: 1 }, // Record user sessions; comment out to disable
  engagement: {},                   // In-product Guides & Surveys; comment out to disable
});
