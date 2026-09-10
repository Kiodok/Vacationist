---
name: sentry-watchdog-termination-noise
description: Use before touching apps/mobile/src/utils/sentry.ts, the @sentry/react-native version, or any Sentry sampling/integration config — and whenever a Sentry "WatchdogTermination" / "Out of Memory" issue appears for Vacationist. Records why watchdog-termination tracking is deliberately OFF and how to actually diagnose a real OOM.
---

# Sentry WatchdogTermination tracking is deliberately OFF (v1.37.3)

`Sentry.init` in `apps/mobile/src/utils/sentry.ts` sets **`enableWatchdogTerminationTracking:
false`**. Do not re-enable it "to be safe" — that undoes a deliberate call.

## Why

`@sentry/react-native`'s watchdog / "Out of Memory" tracking is a **stackless
diagnosis-by-elimination heuristic**: on the next launch, if the SDK can't detect a normal exit,
a crash report, an OS upgrade, a reboot, a debugger, or a force-quit for the previous session, it
attributes the end to an OS watchdog kill. It **cannot name a cause** (no stack, no breadcrumbs
that point anywhere) and it **misfires** on force-quit-from-app-switcher and
first-launch-after-install / OTA.

`REACT-NATIVE-N` (2026-09-09): 1 event / 1 user, release 1.37.2, iPhone 16 Pro (8 GB RAM),
`in_foreground: true`, ~18 min after a fresh build finished — every fact fit a false positive, and
there was zero corroborating OOM signal (no low-end-device OOMs, no JS render/allocation crashes,
no prior events in 90 d). Resolved by turning the integration off + trimming genuine memory
pressure (see [[v1-37-3-batch]]), not by chasing a phantom.

## How to diagnose a *real* OOM if one is ever suspected

A genuine memory problem in an RN app shows up as **JS-side crashes first** — `RangeError`,
`out of memory`, renderer aborts, `Maximum call stack`, native `SIGABRT` with a JS stack — on
**lower-end / lower-RAM devices before high-end ones**, and it **recurs**. Look for that pattern
on the current release. If it's there:
- audit the query cache (`gcTime`), the persister serialize cost, `useTripOfflinePrefetch` fan-out,
  full-res images, base64 PDF/blob buffers — see the v1.37.3 audit in `implementation_guide.md`
  Phase 19.2 for the ranked suspect list;
- consider temporarily re-enabling watchdog tracking on a `preview` build only, with
  `enableStallTracking` + a small `tracesSampleRate`, to get frame/stall data.

Also OFF as of v1.37.3 (memory/CPU, not correctness): `profilesSampleRate` (→0),
`tracesSampleRate` (→0) + `enableAutoPerformanceTracing: false`, `replaysOnErrorSampleRate` (1→0.2).
Kept: session replay 0.1, view masking, `attachScreenshot`, `enableLogs`.

Related: [[v1-37-3-batch]], [[offline-session-durability]], [[keychain-accessibility]].
