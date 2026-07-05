import {ADBAutoInstaller} from './installer'
import {exec} from 'tinyexec'

/**
 * Get ADB command prefix with optional device specifier.
 */
export async function getAdbPrefix(deviceId?: string) {
	const autoInstaller = new ADBAutoInstaller()
	const adb = autoInstaller.adb

	return deviceId ? [adb, '-s', deviceId] : [adb]
}

export async function runAdbCommand(
	deviceId: string | undefined,
	args: string[],
	timeout?: number,
) {
	const prefix = await getAdbPrefix(deviceId)
	if (timeout) {
		return await exec(prefix[0], [...prefix.slice(1), ...args], {timeout})
	} else {
		return await exec(prefix[0], [...prefix.slice(1), ...args])
	}
}
