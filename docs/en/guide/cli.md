---
title: Headless CLI
---

# Headless CLI (`escrcpy`)

The `escrcpy` binary ships with the npm package (`bin.cli.js`) and works without opening the desktop app. Binaries resolve via `--adb` / `--scrcpy` flags, `ESCRCPY_ADB` / `ESCRCPY_SCRCPY` env vars, or `PATH`.

Run `escrcpy --help` for the full usage text (kept in sync with `bin/cli.js`).

## Commands

```bash
escrcpy devices [--json]
escrcpy mirror <serial> [scrcpy args...]
escrcpy record <serial> -o out.mp4 [scrcpy args...]
escrcpy shot <serial> [-o out.png]
escrcpy install <serial> <apk>
escrcpy shell <serial> [--] <cmd...>
escrcpy push <serial> <local> [remote]
escrcpy pull <serial> <remote> [local]
escrcpy connect <host[:port]>
escrcpy disconnect <host[:port]>
escrcpy battery <serial> [--json]
escrcpy logcat <serial> [--dump] [--clear] [-o out.txt]
```

## Global options

- `--adb <path>`, `--scrcpy <path>`
- `--timeout <ms>` — abort one-shot adb commands after the given milliseconds
- `--wait-for-device` — run `adb wait-for-device` before serial-scoped commands
- `--json` — structured output for `devices` and `battery`

## Examples

```bash
escrcpy devices --json
escrcpy shell emulator-5554 getprop ro.build.version.sdk
escrcpy record 192.168.1.10:5555 -o demo.mp4 --no-audio
escrcpy logcat 192.168.1.10:5555 --dump -o log.txt
```

## Notes

- Serials are validated with the same `assertSafeSerial` allowlist as the GUI.
- `record` reuses scrcpy `--record=`; parent directories are created automatically.
- `push` defaults to `/sdcard/Download/`; `pull` defaults to `./<basename>`.
