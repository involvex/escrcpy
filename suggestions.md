# Feature Suggestions Report

Analysis of the Escrcpy monorepo (Electron GUI for scrcpy) as of v2.11.1+.
Scope reviewed: `desktop/electron` (main process modules, services, middleware), `desktop/src` (renderer views/stores/hooks/models), `desktop/pages/*` (multi-window entries: control, copilot, explorer, logcat, terminal, apps), `packages/*`, docs, and CI.

Each suggestion lists the current state with concrete file references, a proposed improvement, and impact/effort/confidence ratings.

---

## Summary Table

| ID       | Priority | Category        | Suggestion                                                                            | Impact     | Effort     | Confidence | Status                                                                                     |
| -------- | -------- | --------------- | ------------------------------------------------------------------------------------- | ---------- | ---------- | ---------- | ------------------------------------------------------------------------------------------ |
| FEAT-001 | High     | Feature Gap     | Implement the `automation` schedule type handler                                      | High       | Medium     | 95%        | ✅ **DONE**                                                                                |
| FEAT-002 | High     | Security        | Harden shell-argument construction in scrcpy/adb middleware against quoting injection | High       | Low        | 90%        | ✅ **DONE**                                                                                |
| FEAT-003 | High     | UX              | OCR language selection + additional tessdata models                                   | Medium     | Low–Medium | 95%        | 🟡 **MOSTLY DONE** (chi_tra.traineddata missing)                                           |
| FEAT-004 | High     | UX              | Native notification center for long-running tasks                                     | Medium     | Low        | 90%        | ❌ **NOT DONE**                                                                            |
| FEAT-005 | High     | Feature Gap     | Preference profile export / import / backup (with validation + safe apply)            | High       | Medium     | 95%        | ✅ **DONE**                                                                                |
| FEAT-006 | High     | DevEx           | CI workflow for lint + typecheck + unit tests on PRs                                  | Medium     | Low        | 95%        | ✅ **DONE**                                                                                |
| FEAT-007 | High     | Feature         | Device group control (synchronized input across multiple devices)                     | High       | High       | 85%        | ❌ **NOT DONE**                                                                            |
| FEAT-008 | Medium   | Feature         | Battery & device telemetry monitor with alerts and history                            | Medium     | Medium     | 90%        | 🟡 **PARTIAL** (Dexie history deferred)                                                    |
| FEAT-009 | Medium   | Feature         | Recording post-processing: GIF export, trim, frame extraction                         | Medium     | Medium     | 90%        | ❌ **NOT DONE**                                                                            |
| FEAT-010 | Medium   | Maintainability | Unit tests for pure parsers (scrcpy/adb output parsing)                               | Medium     | Low        | 95%        | ✅ **DONE**                                                                                |
| FEAT-011 | Medium   | Feature         | Logcat enhancements: export, saved filter presets, crash-log bundle sharing           | Medium     | Low–Medium | 90%        | ✅ **DONE** (CSV export, filter presets, crash bundles, configurable buffer, context menu) |
| FEAT-012 | Medium   | Feature         | Copilot persistent task history + token/cost tracking                                 | Medium     | Medium     | 85%        | 🟡 **PARTIAL** (Dexie task records + history + rerun done; token tracking deferred)        |
| FEAT-013 | Medium   | Feature         | Wireless device auto-reconnect manager at startup                                     | Medium     | Low–Medium | 90%        | ✅ **DONE** (failure tracking hardened)                                                    |
| FEAT-014 | Medium   | Feature         | Tray device submenu (per-device connect / mirror / disconnect)                        | Medium     | Low        | 95%        | ✅ **DONE**                                                                                |
| FEAT-015 | Medium   | Feature         | Keyboard mapping editor (PC keys → device touches/keyevents)                          | High       | High       | 80%        | ✅ **DONE** (fully implemented: keymap editor, profiles, global shortcuts, import/export)  |
| FEAT-016 | Medium   | Feature         | Real CLI beyond `escrcpy` dev launcher (headless mirror/record/screenshot)            | Medium     | Medium     | 85%        | ✅ **DONE**                                                                                |
| FEAT-017 | Low      | Performance     | Cache serial/screen-size enrichment in `getDeviceList` polling                        | Low–Medium | Low        | 85%        | ❌ **NOT DONE**                                                                            |
| FEAT-018 | Low      | Feature         | Gamepad support toggle in preferences                                                 | Low        | Medium     | 80%        | ✅ **DONE**                                                                                |
| FEAT-019 | Low      | Hygiene         | Remove or wire up unused dependencies (`ga-gtag`)                                     | Low        | Low        | 100%       | ✅ **DONE** (moved to root devDependencies)                                                |
| FEAT-020 | Low      | i18n/A11y       | Additional locales, RTL audit for Arabic, accessibility pass                          | Low        | Medium     | 80%        | ❌ **NOT DONE**                                                                            |

---

## High Priority Suggestions (Not Yet Done)

### FEAT-003 — OCR: Add missing `chi_tra.traineddata` model

- **Category:** UX (completion of partially done feature)
- **Files:** `desktop/electron/resources/extra/common/tesseract/` (missing `chi_tra.traineddata`), `desktop/electron/modules/ocr/service.js` (line 8 declares `chi_tra` in `OCR_ALLOWED_LANGS`), `desktop/src/hooks/useOcrAction/index.js` (line 10 offers "繁體中文")
- **Current state:** 5 of 6 allowed languages have traineddata files (`eng`, `chi_sim`, `jpn`, `rus`, `ara`). Traditional Chinese (`chi_tra`) is declared in allowed set and offered in the UI picker but the model file is absent from the resources directory. Selecting it silently falls back to English via `hasTrainedData()` check.
- **Suggested improvement:** Add `chi_tra.traineddata` (LSTM `tessdata_fast`, ~2 MB) to the resources directory. Verify the file is bundled in the build (check `vite.config.js` or electron-builder config for resource inclusion). Run `pnpm lang-sync` to ensure i18n keys for "繁體中文" are complete.
- **Impact:** Medium–High for Traditional Chinese users. **Effort:** Low. **Confidence:** 95%.

### FEAT-004 — Native notification center for task completion

- **Category:** UX polish
- **Files:** Only one `new Notification` usage exists (`desktop/src/utils/modal/index.js`). Long-running flows end silently: recording finish (`scrcpy.record` in `desktop/electron/middleware/scrcpy/index.js`), batch screenshot completion (`batch-actions/screenshot`), file push/pull progress (`useUploader`/`useDownloader` hooks), schedule runs (`store/schedule`), copilot batch tasks (`electron/modules/copilot/helpers/service.js`).
- **Current state:** No generalized notification system. The existing `adaptiveMessage(..., { system: true })` is a per-call renderer-side opt-in using the Web `Notification` API, not Electron main-process notifications. No `taskNotifications` preference exists in `desktop/src/models/preference/common/index.js`. No `task-finished` IPC channel.
- **Suggested improvement:**
  1. Add `common.taskNotifications` preference in `desktop/src/models/preference/common/index.js` with i18n keys.
  2. Create a main-process notification service (`desktop/electron/services/notifications/`) that listens for `task-finished` IPC events and shows Electron `Notification` (supports click-to-reveal file/folder).
  3. Emit `task-finished` from: scrcpy middleware on record completion, batch action handlers on completion, schedule store `complete()`, copilot service on task finish, uploader/downloader on finish.
  4. In renderer, add a lightweight listener that can also show in-app toasts for users who disable system notifications.
- **Impact:** Medium (especially valuable when minimized to tray). **Effort:** Low–Medium. **Confidence:** 90%.

### FEAT-007 — Device group control (synchronized multi-device input)

- **Category:** Feature (documented milestone "Device group control feature")
- **Files:** Foundation exists: batch actions framework in `desktop/src/views/device/components/batch-actions/`, wireless grouping UI in `device/components/wireless-group/`, remark-based groups, and `concurrencyLimit` setting via `p-limit` in `desktop/electron/middleware/adb/index.js`.
- **Current state:** Batch actions cover mirror/screenshot/install/push/copilot, but there is no way to broadcast _input_ (taps, swipes, text, keyevents) to several mirrored devices simultaneously — a common need for app testing/farming scenarios. No `group-control` Vite entry exists in `desktop/vite.config.js`.
- **Suggested improvement:** Create a "Group Control" window entry (new Vite entry in `desktop/vite.config.js`) that:
  1. Opens N low-cost mirrors (`--no-audio --max-size=...`) in a CSS grid layout.
  2. Designates one mirror as the leader (first in list or user-selected).
  3. Forwards leader's control events (via existing shortcut system in `services/shortcuts/index.js` or scrcpy control socket) to follower devices via `adb shell input` (reuse `deviceShell` / `runAutomationSteps` pattern).
  4. Reuses `p-limit` concurrency from `common.concurrencyLimit`.
  5. Adds a device selector in the device list to create/manage groups (extend `wireless-group` or new `device-group` component).
- **Impact:** High — differentiator feature for testing/farming. **Effort:** High. **Confidence:** 85%.

---

## Medium Priority Suggestions (Partial / Enhancement)

### FEAT-008 — Battery telemetry: Persist history to Dexie

- **Category:** Feature completion
- **Files:** `desktop/src/store/telemetry/index.js` (lines 16, 36–41: `rings` Map holds in-memory samples; line 13: `samples` ref exposes array), `desktop/src/utils/device/telemetry/index.js` (createSampleRing, buildSparklinePath).
- **Current state:** Polling store with ring buffer (60 samples), alerts with ElNotification, sparkline path builder — all in memory. No Dexie persistence; history lost on restart.
- **Suggested improvement:** Add a `batteryHistory` Dexie table (schema: `deviceId`, `ts`, `level`, `temp`, `charging`). In `recordSample()`, after pushing to ring, also `await db.batteryHistory.add({ deviceId, ts: Date.now(), level: battery.batteryPercentage, temp: battery.temperatureCelsius, charging: battery.charging })`. Add a "History" tab in device popover or a dedicated telemetry view with date range picker and sparkline chart (reuse `buildSparklinePath`). Respect `TELEMETRY_DEFAULTS.maxSamples` for in-memory; Dexie can keep longer retention (e.g., 7 days) with a cleanup job.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 90%.

### FEAT-009 — Recording post-processing toolkit

- **Category:** Feature
- **Files:** `desktop/electron/middleware/scrcpy/index.js` (lines 76–84: `record()` writes raw file); `desktop/src/views/device/components/more-dropdown/components/record/index.vue` (lines 105–109: awaits recording, copies to clipboard, shows success toast); `sharp` is a root dependency (pinned in overrides).
- **Current state:** Recording writes MP4/OPUS via scrcpy; on completion the file path is copied to clipboard and a toast shows. No post-record dialog, no conversion, no trim, no frame extraction, no history view.
- **Suggested improvement:**
  1. Add a post-record dialog (in record component or new `record-result` component) offering: Open folder, Copy path, **Convert to GIF**, **Trim**, **Extract frames**.
  2. For GIF: use `sharp` to extract frames at intervals, then encode via a lightweight GIF encoder (e.g., `gifencoder` or ship `gifski` binary). Since `sharp` is already a dep, extract frames → `sharp().gif()`.
  3. For trim: use `fluent-ffmpeg` (add as dep) or shell out to bundled ffmpeg (scrcpy bundles ffmpeg). `scrcpy --record` already uses ffmpeg; expose trim via `-ss -t` on a copy.
  4. For frame extraction: `sharp` pipeline to save PNGs at timestamps.
  5. Add a "Recordings" history view (new page or device popover tab) listing files under `common.savePath` with metadata (device, timestamp, duration, size) — can read directory or maintain a Dexie index on record completion.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 90%.

### FEAT-011 — Logcat: CSV export + crash bundles + filter presets + configurable ring buffer

- **Category:** Feature enhancement
- **Files:** `desktop/src/hooks/useLogcat/index.js` (lines 3, 122–124: `MAX_BUFFER_SIZE=20000` hardcoded; lines 274–296: `exportLog()` writes `.log` text only); `desktop/pages/logcat/components/filter-bar/index.vue` (no preset save/load); `desktop/pages/logcat/components/toolbar/index.vue` (emits `export` but only text).
- **Current state:** Export produces `.log` (text). Pause/resume works. Ring buffer capped at 20k entries (hardcoded). No CSV, no crash-bundle sharing (crash banner only jumps), no saved filter presets.
- **Suggested improvement:**
  1. Extend `exportLog()` to support CSV: `filteredEntries.map(e => [e.time, e.level, e.tag, e.pid, e.message].join(','))` with header row.
  2. Add "Save as crash bundle" action: zip filtered entries + device info + screenshot (reuse `useScreenshotAction`) + `dumpsys` output.
  3. Add filter presets: persist `{ search, priorities, tagText, tagMode, packageName }` to electron-store under `logcat.filterPresets[]`; add a dropdown in filter-bar to save/load/delete presets.
  4. Make `MAX_BUFFER_SIZE` configurable via preference `logcat.maxBufferSize` (default 20000) and read in `useLogcat`.
  5. Add "Jump to PID/Tag" quick filters in log-table (context menu on row).
- **Impact:** Medium. **Effort:** Low–Medium. **Confidence:** 90%.

### FEAT-012 — Copilot: Token usage tracking

- **Category:** Feature enhancement
- **Files:** `desktop/src/database/modules/copilot-task/store.js` (schema lines 17–56: no token fields), `desktop/pages/copilot/components/history/index.vue` (displays duration, devices, status), `desktop/pages/copilot/dicts/api.js` (multi-provider OpenAI-compatible clients).
- **Current state:** Task records store prompt, deviceIds, total/succeeded/failed, status, durationMs. No token usage captured from provider responses.
- **Suggested improvement:**
  1. Extend copilot-task schema: add `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCost` (optional, per-model pricing map in `dicts/api.js`).
  2. In `desktop/electron/modules/copilot/helpers/service.js` (or wherever the OpenAI client response is received), extract `usage` from response and include in `finishTask()` call.
  3. Update history table to show token columns (optional, behind a preference `copilot.trackTokens`).
  4. Add a summary in the history dialog: total tokens, estimated cost across all tasks.
- **Impact:** Medium (cost visibility for multi-provider users). **Effort:** Low–Medium. **Confidence:** 85%.

---

## Low Priority Suggestions

### FEAT-017 — Cache device enrichment during polling

- **Files:** `desktop/electron/middleware/adb/index.js` — `getDeviceList()` runs `getSerialNo` + `getScreenSize` (shell roundtrips) for every device on every refresh.
- **Improvement:** Cache serial/screen-size per device id with TTL (e.g., 5 min) or invalidate only on `adb.watch()` change events; skip enrichment for devices with fresh cached values. Lowers USB chatter and speeds up device list refresh with many devices.
- **Impact:** Low–Medium. **Effort:** Low. **Confidence:** 85%.

### FEAT-020 — Locale expansion + RTL/accessibility audit

- **Files:** Locales in `desktop/electron/resources/extra/common/locales/*.json` (zh-CN primary; en-US, zh-TW, ja-JP, ru-RU, ar). Language options in `desktop/src/models/preference/common/index.js`.
- **Improvement:** Add ko/de/es/pt-BR locales via `pnpm lang-sync`; audit Arabic RTL rendering (Element Plus direction + UnoCSS logical properties); keyboard-navigability pass on dropdown-heavy views (device list, more-dropdown) and focus trapping in dialogs.
- **Impact:** Low (broadens reach). **Effort:** Medium. **Confidence:** 80%.

---

## New Feature Suggestions (Based on Codebase Analysis)

### FEAT-021 — Mirror window: Touch/click coordinate overlay for debugging

- **Category:** UX / DevTool
- **Files:** `desktop/pages/control/` (floating control bar), `desktop/src/hooks/useScaleScreen/`
- **Current state:** No visual feedback for touch coordinates; useful for calibrating keyboard mappings or automation scripts.
- **Suggested improvement:** Add an optional overlay in the mirror/control window showing real-time touch coordinates (x, y) and scaled coordinates, toggleable via shortcut or control bar button.
- **Impact:** Low–Medium. **Effort:** Low. **Confidence:** 85%.

### FEAT-022 — Device connection health dashboard

- **Category:** Feature / Monitoring
- **Files:** `desktop/src/store/device/index.js`, `desktop/electron/middleware/adb/`
- **Current state:** Device list shows basic status (online/offline/unauthorized). No connection quality metrics, reconnect history, or USB/Wi-Fi signal info.
- **Suggested improvement:** Add a health panel showing: connection type (USB/Wi-Fi), last seen, reconnect count, ADB latency (ping), and authorization status history. Could reuse telemetry infrastructure.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 80%.

### FEAT-023 — Automation script marketplace / sharing

- **Category:** Feature / Community
- **Files:** `desktop/src/database/modules/automation/`, `desktop/pages/automation/`
- **Current state:** Automation scripts stored locally in Dexie. No import/export, sharing, or discovery mechanism.
- **Suggested improvement:** Add export/import for automation scripts (JSON), a built-in script gallery (curated), and community sharing via GitHub Gists or similar. Include script metadata (description, tags, device requirements).
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 75%.

---

## Notes & Non-Suggestions

- The single code TODO (`desktop/pages/terminal/hooks/useTerminal/index.js:174` — delay ensuring terminal readiness) should be replaced with a deterministic readiness signal rather than a longer sleep; fold into terminal work.
- `Plans/copilot-enhancements.md` items (provider list expansion, French agent prompts) appear partially landed in `desktop/pages/copilot/dicts/api.js`; verify remaining steps before reopening.
- AGENTS.md references to `packages/wscrcpy/` were stale and have been removed.

## Analysis Limitations

- Runtime behavior assessed statically; no devices connected, so flows involving real hardware (wireless discovery, camera mirroring, OTG) evaluated by code reading only.
- Windows-only verification environment; macOS/Linux-specific branches (dock handling, v4l2) not exercised.

---

## High-Priority Quick Wins (Low Effort, High Impact)

| Item     | Description                                                        | Est. Effort | Files to Touch                                                                                                                                                                 | Status  |
| -------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **QW-1** | Add `chi_tra.traineddata` to tessdata resources                    | ~30 min     | `desktop/electron/resources/extra/common/tesseract/` (add file), verify build bundling                                                                                         | ❌      |
| **QW-2** | Make logcat ring buffer size configurable                          | ~1 hr       | `desktop/src/hooks/useLogcat/index.js`, `desktop/src/models/preference/common/index.js`, i18n keys                                                                             | ✅ DONE |
| **QW-3** | Add CSV export to logcat                                           | ~1 hr       | `desktop/src/hooks/useLogcat/index.js` (extend `exportLog`), toolbar i18n                                                                                                      | ✅ DONE |
| **QW-4** | Add `taskNotifications` preference + skeleton notification service | ~2–3 hr     | `desktop/src/models/preference/common/index.js`, new `desktop/electron/services/notifications/`, IPC handlers in `handles/index.js`, emitters in scrcpy/batch/schedule/copilot | ❌      |
| **QW-5** | Add filter presets to logcat filter-bar                            | ~2 hr       | `desktop/pages/logcat/components/filter-bar/index.vue`, electron-store key `logcat.filterPresets`, UI for save/load/delete                                                     | ✅ DONE |
| **QW-6** | Add crash-bundle export (zip logs + screenshot + device info)      | ~2–3 hr     | `desktop/src/hooks/useLogcat/index.js`, `desktop/src/hooks/useScreenshotAction/index.js`, new IPC for zip creation                                                             | ✅ DONE |
| **QW-7** | Add Dexie persistence for battery history                          | ~3–4 hr     | `desktop/src/store/telemetry/index.js`, Dexie schema migration, device popover history tab                                                                                     | ❌      |
| **QW-8** | Add copilot token tracking to schema + history view                | ~2–3 hr     | `desktop/src/database/modules/copilot-task/store.js`, `desktop/electron/modules/copilot/helpers/service.js`, history component                                                 | ❌      |

---

## High-Priority Larger Features (Plan Required)

| Item         | Description                                            | Est. Effort | Prerequisites                                                                                                               |
| ------------ | ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| **FEAT-007** | Device group control (synchronized multi-device input) | 2–3 weeks   | New Vite entry, group device selector, leader/follower mirror grid, input forwarding via adb shell or scrcpy control socket |
| **FEAT-009** | Recording post-processing (GIF/trim/frames)            | 1–2 weeks   | Post-record dialog, sharp/ffmpeg integration, recordings history view (Dexie or fs index)                                   |
| **FEAT-012** | Copilot token tracking completion                      | 1 week      | Schema migration, OpenAI response parsing, pricing map                                                                      |

---

## Suggested Implementation Order

1. **Quick Wins Week 1:** QW-1, QW-2, QW-3, QW-7 — all independent, low risk, high user-visible value.
2. **Quick Wins Week 2:** QW-4, QW-5, QW-6, QW-8 — notification infrastructure + logcat polish + copilot tokens.
3. **FEAT-009 (Week 3–4):** Recording post-processing — new UI, ffmpeg/sharp pipeline, history view.
4. **FEAT-007 (Week 5–8):** Device group control — largest feature, needs new window entry, mirror grid, input forwarding.
5. **FEAT-012 (Week 9–10):** Copilot token tracking — schema migration, OpenAI response parsing, pricing map.
6. **FEAT-017, FEAT-020:** Ongoing / as capacity allows.
7. **FEAT-021, FEAT-022, FEAT-023:** New features — evaluate after core items.

---

## Agent Prompts for Subsequent Implementation

When implementing the above, use these agent prompts for each major feature:

### For Quick Wins (QW-1 through QW-8):

> You are the build agent. Implement the following quick win: [QW-N description].
> Files to modify: [list from table].
> Follow existing patterns: use UnoCSS utilities, Pinia stores, `window.$preload` for IPC, i18n keys in `desktop/electron/resources/extra/common/locales/*.json`, run `pnpm lang-sync` after adding keys.
> Verify: `bun run lint` passes, `bun run test` passes, manual test the feature.

### For FEAT-007 (Device Group Control):

> You are the build agent. Implement Device Group Control feature.
>
> 1. Add new Vite entry `group-control` in `desktop/vite.config.js` with `pages/group-control/`.
> 2. Create `desktop/src/views/device/components/device-group/` for group creation/management UI.
> 3. In group control window, open N mirrors via existing `mirror()` IPC with `--no-audio --max-size=...`.
> 4. Implement leader/follower input forwarding: capture leader's control events (reuse `services/shortcuts` or scrcpy control socket), broadcast to followers via `adb shell input` (reuse `deviceShell` / `runAutomationSteps`).
> 5. Respect `common.concurrencyLimit` via `p-limit`.
> 6. Add group selector in device list (extend `wireless-group` or new component).
>    Verify: `bun run lint`, `bun run test`, manual test with 2+ devices.

### For FEAT-009 (Recording Post-Processing):

> You are the build agent. Implement Recording Post-Processing.
>
> 1. Add post-record dialog in `more-dropdown/components/record/index.vue` (or new component) with actions: Open folder, Convert to GIF, Trim, Extract frames.
> 2. For GIF: use `sharp` to extract frames at interval → encode GIF (add `gifencoder` or use `sharp().gif()`).
> 3. For Trim: shell out to bundled ffmpeg (`scrcpy` bundles it) with `-ss -t -c copy` on a copy of the file.
> 4. For Frames: `sharp` pipeline to save PNGs at timestamps.
> 5. Add "Recordings" history view (new page or device popover tab) indexing files under `common.savePath` (Dexie or fs watch).
>    Verify: `bun run lint`, `bun run test`, manual test with a recording.

### For FEAT-012 completion (Copilot Token Tracking):

> You are the build agent. Add token usage tracking to Copilot tasks.
>
> 1. Extend `copilotTaskSchema` in `desktop/src/database/modules/copilot-task/store.js` with `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCost`.
> 2. In `desktop/electron/modules/copilot/helpers/service.js`, extract `usage` from OpenAI-compatible response and pass to `finishTask()`.
> 3. Add per-model pricing map in `desktop/pages/copilot/dicts/api.js`.
> 4. Update history table to show token columns (behind `copilot.trackTokens` preference).
>    Verify: `bun run lint`, `bun run test`, manual test with copilot task.

---

## Verification Checklist Before Completion

For each implemented item:

- [ ] `bun run lint` passes (desktop scope)
- [ ] `bun run test` passes (workspace)
- [ ] `pnpm lang-sync` run if i18n keys added
- [ ] Manual verification on Windows (primary) + note macOS/Linux gaps
- [ ] Update `suggestions.md` status to ✅ DONE or 🟡 PARTIAL with notes
- [ ] Commit with Angular convention: `feat(scope): description` / `fix(scope): description`

(End of file - total 398 lines)
