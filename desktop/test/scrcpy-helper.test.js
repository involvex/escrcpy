import { describe, expect, it } from 'vitest'
import {
  parseDisplayIds,
  parseScrcpyAppList,
  parseScrcpyCameras,
  parseScrcpyCodecList,
} from '../electron/middleware/scrcpy/helper.js'

describe('parseScrcpyAppList', () => {
  it('separates system and user apps on the last space', () => {
    const output = [
      ' * Settings com.android.settings',
      ' - Camera2 com.android.camera2',
      ' * Multi Word App Name com.example.multiword',
    ].join('\n')

    expect(parseScrcpyAppList(output)).toEqual([
      { name: 'Settings', packageName: 'com.android.settings', isSystemApp: true },
      { name: 'Camera2', packageName: 'com.android.camera2', isSystemApp: false },
      { name: 'Multi Word App Name', packageName: 'com.example.multiword', isSystemApp: true },
    ])
  })

  it('ignores lines without the app-list prefixes', () => {
    const output = 'INFO: listing apps...\n * Settings com.android.settings\n'
    expect(parseScrcpyAppList(output)).toHaveLength(1)
  })

  it('throws TypeError for non-string input', () => {
    expect(() => parseScrcpyAppList(null)).toThrowError(TypeError)
    expect(() => parseScrcpyAppList(42)).toThrowError(TypeError)
  })
})

describe('parseScrcpyCodecList', () => {
  it('groups video and audio codecs with their encoders', () => {
    const output = [
      'INFO: List of video encoders:',
      '  --video-codec=h264 --video-encoder=OMX.qcom.video.encoder.avc',
      '  --video-codec=h265 --video-encoder=OMX.qcom.video.encoder.hevc',
      'INFO: List of audio encoders:',
      '  --audio-codec=aac --audio-encoder=c2.android.aac.encoder',
    ].join('\n')

    expect(parseScrcpyCodecList(output)).toEqual({
      video: [
        { type: 'video', codec: 'h264', encoder: 'OMX.qcom.video.encoder.avc' },
        { type: 'video', codec: 'h265', encoder: 'OMX.qcom.video.encoder.hevc' },
      ],
      audio: [
        { type: 'audio', codec: 'aac', encoder: 'c2.android.aac.encoder' },
      ],
    })
  })

  it('never throws; reports an error entry when nothing matches', () => {
    const empty = parseScrcpyCodecList('no codecs here')
    expect(empty.video).toEqual([])
    expect(empty.audio).toEqual([])
    expect(empty.error).toBeTruthy()

    const broken = parseScrcpyCodecList(null)
    expect(broken.video).toEqual([])
    expect(broken.audio).toEqual([])
    expect(broken.error).toBeTruthy()
  })

  it('skips option lines lacking codec+encoder pairs', () => {
    const output = '--video-codec=h264\n--audio-codec=opus --audio-encoder=c2.android.opus.encoder'
    const result = parseScrcpyCodecList(output)
    expect(result.video).toEqual([])
    expect(result.audio).toHaveLength(1)
  })
})

describe('parseDisplayIds', () => {
  it('extracts unique sorted display ids', () => {
    const output = [
      'INFO: Available displays:',
      '  --display-id=0  (1080x2400)',
      '  --display-id=2  (800x600)',
      '  --display-id=0  (duplicate)',
    ].join('\n')

    expect(parseDisplayIds(output)).toEqual([0, 2])
  })

  it('returns an empty array for empty or non-string input', () => {
    expect(parseDisplayIds('')).toEqual([])
    expect(parseDisplayIds(undefined)).toEqual([])
    expect(parseDisplayIds(123)).toEqual([])
  })
})

describe('parseScrcpyCameras', () => {
  const output = [
    'INFO: List of cameras:',
    '  --camera-id=0 (back, 1920x1080, fps={30,60}, zoom-range=[1.0,4.0])',
    '  --camera-id=1 (front, 1280x720, fps={30})',
  ].join('\n')

  it('parses camera id, facing, size, fps, and optional zoom range', () => {
    expect(parseScrcpyCameras(output)).toEqual([
      {
        id: '0',
        facing: 'back',
        width: 1920,
        height: 1080,
        fps: [30, 60],
        zoomRange: [1.0, 4.0],
      },
      {
        id: '1',
        facing: 'front',
        width: 1280,
        height: 720,
        fps: [30],
      },
    ])
  })

  it('omits the zoomRange key when no range is advertised', () => {
    const front = parseScrcpyCameras(output).find(camera => camera.id === '1')
    expect('zoomRange' in front).toBe(false)
  })

  it('dedupes equivalent cameras keeping the widest zoom span', () => {
    const duplicated = [
      '  --camera-id=0 (back, 1920x1080, fps={30,60}, zoom-range=[1.0,2.0])',
      '  --camera-id=1 (back, 1920x1080, fps={30,60}, zoom-range=[1.0,4.0])',
      '  --camera-id=2 (front, 640x480, fps={15})',
    ].join('\n')

    const dedupeResult = parseScrcpyCameras(duplicated, { dedupe: true })
    expect(dedupeResult.map(camera => camera.id)).toEqual(['1', '2'])
  })

  it('handles CRLF line endings and skips non-matching lines', () => {
    const crlf = 'garbage\r\n  --camera-id=3 (back, 640x480, fps={30})\r\n'
    const parsed = parseScrcpyCameras(crlf)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('3')
  })
})
