---
title: 无头命令行
---

# 无头命令行（`escrcpy`）

`escrcpy` 命令随 npm 包发布（`bin/cli.js`），无需打开桌面应用即可使用。二进制路径按 `--adb` / `--scrcpy` 参数、`ESCRCPY_ADB` / `ESCRCPY_SCRCPY` 环境变量或 `PATH` 解析。

完整用法以 `escrcpy --help` 为准（与 `bin/cli.js` 保持同步）。

## 命令

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

## 全局选项

- `--adb <path>`、`--scrcpy <path>`
- `--timeout <ms>` — 单次 adb 命令超时时间（毫秒）
- `--wait-for-device` — 先等待设备上线再执行
- `--json` — `devices` 与 `battery` 输出结构化 JSON

## 示例

```bash
escrcpy devices --json
escrcpy shell emulator-5554 getprop ro.build.version.sdk
escrcpy record 192.168.1.10:5555 -o demo.mp4 --no-audio
escrcpy logcat 192.168.1.10:5555 --dump -o log.txt
```

## 说明

- 设备序列号沿用与图形界面相同的 `assertSafeSerial` 白名单校验。
- `record` 复用 scrcpy `--record=`，会自动创建父目录。
- `push` 默认远端为 `/sdcard/Download/`；`pull` 默认本地为 `./<文件名>`。
