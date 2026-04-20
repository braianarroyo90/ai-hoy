"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export default function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (posthog.__loaded) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:          "https://us.i.posthog.com",
      ui_host:           "https://us.posthog.com",
      capture_pageview:  true,
      capture_pageleave: true,
      autocapture:       true,
      persistence:       "localStorage",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
