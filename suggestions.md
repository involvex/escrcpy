# Feature Suggestions Report

Analysis of the Escrcpy monorepo (Electron GUI for scrcpy) as of v2.11.1.
Scope reviewed: `desktop/electron` (main process modules, services, middleware), `desktop/src` (renderer views/stores/hooks/models), `desktop/pages/*` (multi-window entries: control, copilot, explorer, logcat, terminal, apps), `packages/*`, docs, and CI.

Each suggestion lists the current state with concrete file references, a proposed improvement, and impact/effort/confidence ratings.

---

## Summary Table

| ID       | Priority | Category        | Suggestion                                                                                                      | Impact     | Effort     | Confidence |
| -------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ---------- |
| FEAT-001 | High     | Feature Gap     | Implement the `automation` schedule type handler (data model exists, executor missing) _(implemented)_          | High       | Medium     | 95%        |
| FEAT-002 | High     | Security        | Harden shell-argument construction in scrcpy/adb middleware against quoting injection _(implemented)_           | High       | Low        | 90%        |
| FEAT-003 | High     | UX              | OCR language selection + additional tessdata models                                                             | Medium     | Low–Medium | 95%        |
| FEAT-004 | High     | UX              | Native notification center for long-running tasks                                                               | Medium     | Low        | 90%        |
| FEAT-005 | High     | Feature Gap     | Preference profile export / import / backup _(hardened: validation + safe apply added to existing import)_      | High       | Medium     | 95%        |
| FEAT-006 | High     | DevEx           | CI workflow for lint + typecheck + unit tests on PRs _(implemented)_                                            | Medium     | Low        | 95%        |
| FEAT-007 | High     | Feature         | Device group control (synchronized input across multiple devices)                                               | High       | High       | 85%        |
| FEAT-008 | Medium | Feature | Battery & device telemetry monitor with alerts and history *(implemented: polling store, alerts, sparkline; Dexie history deferred)* | Medium | Medium | 90% |
| FEAT-009 | Medium   | Feature         | Recording post-processing: GIF export, trim, frame extraction                                                   | Medium     | Medium     | 90%        |
| FEAT-010 | Medium   | Maintainability | Unit tests for pure parsers (scrcpy/adb output parsing) _(implemented)_                                         | Medium     | Low        | 95%        |
| FEAT-011 | Medium   | Feature         | Logcat enhancements: export, saved filter presets, crash-log bundle sharing                                     | Medium     | Low–Medium | 90%        |
| FEAT-012 | Medium | Feature | Copilot persistent task history + token/cost tracking *(implemented: Dexie task records, history dialog, rerun; token tracking deferred)* | Medium | Medium | 85% |
| FEAT-013 | Medium   | Feature         | Wireless device auto-reconnect manager at startup _(hardened: failure tracking added to existing auto-connect)_ | Medium     | Low–Medium | 90%        |
| FEAT-014 | Medium   | Feature         | Tray device submenu (per-device connect / mirror / disconnect)                                                  | Medium     | Low        | 95%        |
| FEAT-015 | Medium   | Feature         | Keyboard mapping editor (PC keys → device touches/keyevents)                                                    | High       | High       | 80%        |
| FEAT-016 | Medium | Feature | Real CLI beyond `escrcpy` dev launcher (headless mirror/record/screenshot) *(implemented: devices/mirror/shot/install)* | Medium | Medium | 85% |
| FEAT-017 | Low      | Performance     | Cache serial/screen-size enrichment in `getDeviceList` polling                                                  | Low–Medium | Low        | 85%        |
| FEAT-018 | Low      | Feature         | Gamepad support toggle in preferences                                                                           | Low        | Medium     | 80%        |
| FEAT-019 | Low      | Hygiene         | Remove or wire up unused dependencies (`ga-gtag`)                                                               | Low        | Low        | 85%        |
| FEAT-020 | Low      | i18n/A11y       | Additional locales, RTL audit for Arabic, accessibility pass                                                    | Low        | Medium     | 80%        |

---

## High Priority Suggestions

### FEAT-001 — Implement the `automation` schedule type handler _(implemented)_

> **Status:** Shipped. Pure executor in `desktop/src/utils/automation/index.js` (tap/swipe/text/key/wait/command steps → adb shell, 22 unit tests), schedule listener at `desktop/src/views/device/components/batch-actions/automation/index.vue`, and a step editor in `schedule-dialog`. The legacy `scriptId` contract was replaced by inline `automationConfig.steps`; the orphaned `automation.*` i18n vocabulary was reused.

- **Category:** Feature gap (partially built feature)
- **Files:**
  - `desktop/src/store/schedule/index.js` (lines ~125–140): `buildSchedule()` already serializes `automationConfig` into `payload.automationConfig` when `scheduleType === 'automation'`.
  - `desktop/src/components/schedule-dialog/index.vue` (lines ~314, ~405): the dialog already collects automation config for this type.
  - Handlers that _do_ exist: only `screenshot`, `mirror`, `copilot`, `install` are registered via `scheduleStore.on(...)` in `desktop/src/views/device/components/batch-actions/*/index.vue`.
- **Current state:** A user can create an "automation" scheduled task; it is persisted to Dexie and even recovered on startup by `recoverSchedules()`, but no listener is ever registered for `'automation'`, so `dispatchSchedule()` returns `false` and the task silently never runs. Recovered automation schedules will loop as recoverable forever.
- **Suggested improvement:** Either (a) register an `automation` handler that replays a recorded macro (see below), or (b) hide the automation option in `schedule-dialog` until an executor exists. Recommended path: add a lightweight macro recorder that captures adb input events (`input tap/swipe/text/keyevent`) into `automationConfig.steps[]`, then execute steps sequentially via existing `deviceShell`. This also fulfills the documented milestone "Support script automation through visual orchestration tools" (`docs/en/guide/milestones.md`).
- **Impact:** High — turns dead UI/data into a flagship feature. **Effort:** Medium. **Confidence:** 95%.

### FEAT-002 — Harden shell-argument construction in scrcpy/adb middleware

- **Category:** Security
- **Files:**
  - `desktop/electron/middleware/scrcpy/index.js`: `createMirrorProcess()` builds `` `--serial="${serial}" --window-title="${title}" ${args}` `` and passes it to `sheller(..., { shell: true })`.
  - `desktop/src/hooks/useMirrorAction/index.js` (line 40) → `deviceStore.getLabel()` (`desktop/src/store/device/index.js`, line 36): the window title embeds `data.remark || data.name`, which is user-editable free text.
  - `desktop/electron/middleware/adb/index.js`: `pair(host, port, code)` interpolates the QR pairing code straight into a shell command; `connect/disconnect` interpolate host strings.
- **Current state:** Any double quote or shell metacharacter inside a device remark, serial, or pairing code breaks out of the quoted argument (e.g., remark `x" & calc & "` on Windows spawns arbitrary commands). Note the codebase already does this correctly elsewhere — see `assertSafePackageName()` / `isSafeShellArgument()` in `desktop/electron/middleware/adb/index.js`.
- **Suggested improvement:** Reuse/extract the existing `isSafeShellArgument()` validator into a shared util (`$electron/helpers/shell`) and apply it to `serial`, `title`, `savePath`, `host`, `port`, `code`; reject or sanitize at the store boundary (`setRemark`). Prefer passing argv arrays instead of `shell: true` where `sheller` supports it.
- **Impact:** High (local command injection). **Effort:** Low. **Confidence:** 90%.

### FEAT-003 — OCR language selection + more tessdata models

- **Category:** UX
- **Files:** `desktop/electron/modules/ocr/service.js` (line 26 hardcodes `createWorker('eng', 1, ...)`); tessdata bundled under `desktop/electron/resources/extra/common/tesseract`; caller hook at `desktop/src/hooks/useOcrAction/index.js`.
- **Current state:** OCR always recognizes English regardless of app locale (app ships zh-CN, zh-TW, ja-JP, ru-RU, ar). Chinese/Japanese users get garbage results for CJK screens.
- **Suggested improvement:**
  1. Accept a `lang` parameter in the `ocr:recognize` IPC payload and recreate/reuse per-language workers (cache in a Map, terminate on quit like today).
  2. Add a small language picker to the OCR action UI defaulting to the current i18n locale.
  3. Ship additional `tessdata_fast` LSTM models (chi_sim, jpn, rus, ara are each only a few MB) alongside `eng`.
- **Impact:** Medium–High for non-English users. **Effort:** Low–Medium. **Confidence:** 95%.

### FEAT-004 — Native notification center for task completion

- **Category:** UX polish
- **Files:** Only one `new Notification` usage exists (`desktop/src/utils/modal/index.js`). Long-running flows end silently: recording finish (`scrcpy.record` resolves in `desktop/electron/middleware/scrcpy/index.js`), batch screenshot completion (`batch-actions/screenshot`), file push/pull progress (`useUploader`/`useDownloader` hooks), schedule runs (`store/schedule`), copilot batch tasks (`electron/modules/copilot/helpers/service.js`).
- **Suggested improvement:** Emit a `task-finished` event over IPC from main-process completions and show OS notifications (Electron `Notification` with click-to-reveal for saved files). Add a preference switch `common.taskNotifications` in `desktop/src/models/preference/common/index.js` so users can opt out. Especially valuable when the main window is minimized to tray (`common.minimizeToTray`).
- **Impact:** Medium. **Effort:** Low. **Confidence:** 90%.

### FEAT-005 — Preference profile export / import / backup _(hardened)_

> **Status:** Basic export/import already existed (`views/preference/index.vue` copying the raw store file via dialog IPC) — the original analysis missed it because the handlers are named generically. What was genuinely missing and is now shipped: import validation. `desktop/src/utils/preference-transfer/index.js` parses/validates payloads (raw store dumps or wrapped envelopes, known top-level keys only, plain-object values) with 13 unit tests; a new `import-preference` IPC handler in `services/handles` applies validated data through `store.setAll()` instead of blindly overwriting the live config file on disk; the preference/device/theme stores all refresh after import.

- **Files:** `docs/en/guide/milestones.md` lists "Export and import preferences ?" — grep shows no export/import implementation anywhere in renderer or main. All config lives in electron-store via `desktop/electron/helpers/store/index.js`, plus Dexie data (`desktop/src/database/`).
- **Current state:** Users migrating machines or managing many per-device configs (`scrcpy.<serial>` scopes in `desktop/src/store/preference/helpers/index.js`) must hand-edit JSON store files.
- **Suggested improvement:** Add "Export config" / "Import config" buttons to `views/preference/index.vue`:
  - Export selected top-level keys (`common`, `copilot`, `scrcpy` global + per-device scopes) to a versioned JSON file (`schemaVersion`, redact `copilot.apiKey` by default).
  - Import with merge strategy choice (replace/merge) reusing `mergeConfig()` from `store/preference/helpers/index.js`.
  - Optional: scheduled automatic backups of the electron-store file.
- **Impact:** High for power/multi-device users. **Effort:** Medium. **Confidence:** 95%.

### FEAT-006 — CI workflow for lint, typecheck, and unit tests _(implemented)_

> **Status:** Shipped as `.github/workflows/ci.yml` (bun 1.3.14 → `bun install` → scoped `eslint desktop` → `bun run test`). Repo-wide lint remains red due to a pre-existing prettier-vs-eslint conflict on manifest indentation (prettier `useTabs: true` vs jsonc space rules) affecting ~2900 errors in docs/manifests/packages configs — gating is therefore scoped to the desktop app tree, which lints clean.

- **Suggested improvement:** Add `.github/workflows/ci.yml` running on push/PR: `bun install`, `bun run lint`, and `bun run test` (workspace Vitest task; desktop parser/safety suites already exist under `desktop/test/`). Later: gate releases on CI success.
- **Impact:** Medium (regression protection). **Effort:** Low. **Confidence:** 95%.

### FEAT-007 — Device group control (synchronized multi-device input)

- **Category:** Feature (documented milestone "Device group control feature")
- **Files:** Foundation exists: batch actions framework in `desktop/src/views/device/components/batch-actions/`, wireless grouping UI in `device/components/wireless-group/`, remark-based groups, and `concurrencyLimit` setting already used via `p-limit` in `desktop/electron/middleware/adb/index.js`.
- **Current state:** Batch actions cover mirror/screenshot/install/push/copilot, but there is no way to broadcast _input_ (taps, swipes, text, keyevents) to several mirrored devices simultaneously — a common need for app testing/farming scenarios.
- **Suggested improvement:** Create a "Group Control" window entry that opens N low-cost mirrors (`--no-audio --max-size=...`) in a grid, designates one as the leader, and forwards its control events to follower devices via `adb shell input` or scrcpy control sockets. Reuse `p-limit` concurrency and the existing shortcut system (`services/shortcuts/index.js`) for leader keyevent forwarding.
- **Impact:** High — differentiator feature. **Effort:** High. **Confidence:** 85%.

---

## Medium Priority Suggestions

### FEAT-008 — Battery & device telemetry monitor

- **Category:** Feature
- **Files:** `adb.battery()` exists (`desktop/electron/middleware/adb/index.js`, line ~357, parses `dumpsys battery` via `helpers/battery/index.js`) but is only invoked once-on-demand in `desktop/src/views/device/components/device-popover/index.vue` (line 123).
- **Suggested improvement:** Poll battery for connected devices at a configurable interval (respecting `concurrencyLimit`), expose a dashboard widget (level, temperature, charging state), optional desktop alert when level < X% or temperature > Y°C while mirroring, and persist history samples to Dexie for a trend chart. Useful guardrail for long unattended sessions driven by schedules/copilot.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 90%.

### FEAT-009 — Recording post-processing toolkit

- **Category:** Feature
- **Files:** `scrcpy.record()` writes raw files (`desktop/electron/middleware/scrcpy/index.js` lines 71–76); `sharp` is already a dependency (root `package.json`, pinned in overrides).
- **Suggested improvement:** After a recording finishes, offer: MP4→GIF conversion (sharp can extract frames; combine with an encoder or ship `gifski`-style pipeline), trim start/end, extract frames as PNG screenshots, and compress for sharing. Entry point: a post-record dialog in `more-dropdown/components/record/index.vue` flow plus a "Recordings" history view backed by the chosen save path (`common.savePath`).
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 90%.

### FEAT-010 — Unit tests for output parsers

- **Category:** Maintainability (enables FEAT-006)
- **Files:** Pure, easily-testable functions:
  - `desktop/electron/middleware/scrcpy/helper.js` — `parseScrcpyAppList`, `parseScrcpyCodecList`, `parseDisplayIds`, `parseScrcpyCameras`
  - `desktop/electron/middleware/adb/helpers/battery/index.js` — `parseBatteryDump`
  - `desktop/electron/middleware/adb/helpers/packages/index.js` — `parsePackageList`, `parseDumpsysPackages`, `parseLsOutput`
  - `desktop/electron/modules/schedule/service.js` — `convertScheduleToCronExpression` (note: interval 'day' yields `0 0 */N * *` and 'millisecond' collapses to every second — worth locking behavior with tests)
- **Suggested improvement:** Add vitest to the desktop workspace (mirroring `packages/autoglm.js/vitest.config.ts`) and cover parsers with real captured outputs (including malformed input). These parsers break silently whenever scrcpy/adb changes output formats — tests make upgrades safe.
- **Impact:** Medium. **Effort:** Low. **Confidence:** 95%.

### FEAT-011 — Logcat enhancements

- **Category:** Feature
- **Files:** Logcat stream plumbing exists (`openLogcat/closeLogcat` in `desktop/electron/middleware/adb/index.js`), UI in `desktop/pages/logcat/` (filter-bar, log-table, crash-banner).
- **Suggested improvement:**
  1. Export filtered logs to file (txt/csv) and share crash bundles (crash banner already detects crashes).
  2. Saved filter presets persisted in electron-store.
  3. Pause/resume streaming and jump-to-pid/tag quick filters.
  4. Optional ring-buffer size limit to bound memory during long sessions.
- **Impact:** Medium (debugging is a core power-user flow). **Effort:** Low–Medium. **Confidence:** 90%.

### FEAT-012 — Copilot persistent history + usage tracking

- **Category:** Feature
- **Files:** Sessions are in-memory only (`sessionManager` in `desktop/electron/modules/copilot/helpers/session.js`; destroyed wholesale on any copilot config change in `helpers/service.js`). Dexie is already available and used by schedules.
- **Suggested improvement:** Persist finished task transcripts (prompt, steps, screenshots metadata, outcome, duration) to Dexie; add a history tab in `desktop/pages/copilot/` with re-run ("repeat last task on device X") and search. Optionally track token usage per provider from the openai client responses for cost visibility across the multi-provider setup in `pages/copilot/dicts/api.js`.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 85%.

### FEAT-013 — Wireless auto-reconnect manager _(hardened)_

> **Status:** Startup auto-connect already existed (`wireless-group/index.vue` retrying every Wi-Fi history address when `autoConnect` is enabled) — the original analysis missed it. Shipped hardening: `desktop/src/utils/device/wireless-reconnect/index.js` adds an address filter (only real `host:port` ids, not USB serials or mDNS names) and a persisted failure counter (`wireless.reconnectFailures` in electron-store) so dead addresses stop being retried after 3 consecutive failures; manual connect success or removing the entry clears the counter. 16 unit tests.

- **Suggested improvement:** On app launch (and optionally on a timer), attempt `connect()` for history wireless devices whose last known address matches `<ip>:5555`-style patterns, marking stale entries after N failures. Surface reconnect status inline in the device list. Reduces manual re-pairing friction after reboots/network switches.
- **Impact:** Medium. **Effort:** Low–Medium. **Confidence:** 90%.

### FEAT-014 — Tray device submenu

- **Category:** Feature
- **Files:** `desktop/electron/services/tray/index.js` currently has static items (Open / Quick Mirror last device / Quick Terminal / Settings / Restart). Device enumeration available via `adb.getDeviceList()`.
- **Suggested improvement:** Build a dynamic submenu listing connected devices with actions: Mirror, Screenshot, Terminal, Disconnect (wireless). Rebuild menu on device tracker events (`adb.watch()` already streams add/remove). Complements the existing global hotkey (`common.globalHotkey`) for tray-centric workflows.
- **Impact:** Medium. **Effort:** Low. **Confidence:** 95%.

### FEAT-015 — Keyboard mapping editor

- **Category:** Feature (documented milestone "Keyboard mapping feature")
- **Files:** No mapping implementation exists. Relevant primitives: `sendKeyevent()` in `desktop/electron/services/shortcuts/index.js`, mirror shortcuts model in `models/preference/common/index.js` (`mirrorShortcuts`), and scrcpy AOA/OTG modes.
- **Suggested improvement:** Per-device keymap profiles: capture PC keys, bind them to device actions (`input keyevent`, `input tap x y`, `input swipe`), edit visually over a screenshot overlay of the device screen, and activate while a mirror window is focused (globalShortcut scoped to window focus). Store profiles in electron-store under `keymap.<serial>` consistent with per-device scope conventions.
- **Impact:** High for gaming/testing niches. **Effort:** High. **Confidence:** 80%.

### FEAT-016 — Real CLI (headless operations) *(implemented)*

> **Status:** Shipped. `bin/cli.js` now dispatches subcommands (`devices [--json]`, `mirror <serial> [args…]`, `shot <serial> [-o]`, `install <serial> <apk>`) while keeping the legacy dev launcher as the default. Pure parsing/building lives in `desktop/src/utils/cli/index.js` (18 tests) and serials are validated with the FEAT-002 `assertSafeSerial` helper. Binaries resolve via `--adb`/`--scrcpy` flags or `ESCRCPY_ADB`/`ESCRCPY_SCRCPY` env, else PATH — no Electron imports required. Live-verified against a connected device; surfaced a real adb quirk (mdns tls entries use space separators, parser handles both). Known wart: prettier's tab formatting fights eslint on this file, same as root manifests.
- **Suggested improvement:** Extract thin wrappers around `$electron/middleware/scrcpy` and `middleware/adb` (they depend only on Node + adbkit, not Electron APIs except store/config paths — inject defaults) and expose subcommands: `escrcpy mirror --serial X [--record out.mp4]`, `escrcpy shot --serial X -o out.png`, `escrcpy devices`, `escrcpy install apk...`. Enables scripting/CI usage without the GUI and satisfies headless automation requests.
- **Impact:** Medium. **Effort:** Medium. **Confidence:** 85%.

---

## Low Priority Suggestions

### FEAT-017 — Cache device enrichment during polling

- **Files:** `getDeviceList()` in `desktop/electron/middleware/adb/index.js` runs `getSerialNo` + `getScreenSize` (`getprop`/`wm size` shell roundtrips) for every device on every refresh.
- **Improvement:** Cache serial/screen-size per device id with TTL or invalidate only on `watch()` change events; skip enrichment for devices whose cached values exist. Lowers USB chatter and speeds up device list refresh with many devices attached.
- **Impact:** Low–Medium. **Effort:** Low. **Confidence:** 85%.

### FEAT-018 — Gamepad support toggle

- **Files:** Docs already document scrcpy gamepad options (`docs/en/reference/scrcpy/gamepad.md`), but `desktop/src/models/preference/input/index.js` exposes no gamepad fields.
- **Improvement:** Add `--gamepad=aoa/--gamepad=uinput` toggles to the input preference group following the existing field-model pattern (label/field/type/i18n keys + `pnpm lang-sync`).
- **Impact:** Low. **Effort:** Medium (mostly i18n + testing). **Confidence:** 80%.

### FEAT-019 — Remove or wire up unused dependencies

- **Files:** `ga-gtag` is declared in `desktop/package.json` but no `gtag` reference exists in `desktop/src` or `desktop/pages` (grep verified). Similar candidates worth auditing: `simple-git`, `d3-random`, `swapy`, `acorn-loose` (verify actual import sites before removal).
- **Improvement:** Either implement an analytics module with an explicit opt-in/out preference (privacy-friendly) or drop the dependency. Shrinks installer and review surface.
- **Impact:** Low. **Effort:** Low. **Confidence:** 85%.

### FEAT-020 — Locale expansion + RTL/accessibility audit

- **Files:** Locales in `desktop/electron/resources/extra/common/locales/*.json` (zh-CN primary; en-US, zh-TW, ja-JP, ru-RU, ar). Language options defined in `desktop/src/models/preference/common/index.js`.
- **Improvement:** Add ko/de/es/pt-BR locales via `pnpm lang-sync`; audit Arabic RTL rendering (Element Plus direction + UnoCSS logical properties); keyboard-navigability pass on dropdown-heavy views (device list, more-dropdown) and focus trapping in dialogs.
- **Impact:** Low (broadens reach). **Effort:** Medium. **Confidence:** 80%.

---

## Notes & Non-Suggestions

- The single code TODO (`desktop/pages/terminal/hooks/useTerminal/index.js:174` — delay ensuring terminal readiness) should be replaced with a deterministic readiness signal rather than a longer sleep; fold into terminal work rather than treating as a standalone feature.
- `Plans/copilot-enhancements.md` items (provider list expansion, French agent prompts) appear partially landed in `desktop/pages/copilot/dicts/api.js`; verify remaining steps before reopening that plan instead of duplicating it here.
- ~~AGENTS.md references `packages/wscrcpy/`, but no such directory exists in the workspace~~ **Resolved:** AGENTS.md was stale (wscrcpy only exists in upstream CHANGELOG history); its references were removed and the file corrected to match reality (Bun workspace, `bun run test`).

## Analysis Limitations

- Runtime behavior was assessed statically; no devices were connected, so flows involving real hardware (wireless discovery, camera mirroring, OTG) were evaluated by code reading only.
- Windows-only verification environment; macOS/Linux-specific branches (dock handling, v4l2) were not exercised.
