/**
 * Client-side PostHog bootstrap. Loaded automatically by Next.js 15.3+ at
 * the start of every page in the browser — runs once per tab.
 *
 * Cross-subdomain identity: the cookie is scoped to `.andriybabiy.com`, so a
 * `distinct_id` minted on `studyie.andriybabiy.com` is reused on
 * `maths-test.andriybabiy.com`, `portfolio.andriybabiy.com`, etc.
 *
 * `api_host` points at `/ingest` so requests look first-party (avoids the
 * `*.posthog.com` block in default ad-blocker lists). The actual proxy is
 * configured in `next.config.mjs` rewrites().
 */
import posthog from 'posthog-js';

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && typeof window !== 'undefined') {
  posthog.init(key, {
    api_host: '/ingest',
    ui_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
    defaults: '2025-05-24',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_exceptions: true,
    cross_subdomain_cookie: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    autocapture: {
      dom_event_allowlist: ['click', 'submit', 'change'],
    },
  });
}

export {};
