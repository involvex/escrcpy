export interface AgentConfigType {
	maxSteps: number
	lang: 'cn' | 'en'
	deviceId?: string
	systemPrompt?: string
	/**
	 * Custom app name to package name mapping.
	 * These will override the built-in APP_PACKAGES.
	 * @example { '自定义应用': 'com.example.app' }
	 */
	customApps?: Record<string, string>
	// ModelConfigType
	baseUrl: string
	apiKey: string
	model: string
	maxTokens: number
	temperature: number
	topP: number
	frequencyPenalty: number
	screenshotQuality?: number
	/**
	 * Whether the model supports vision/image input.
	 * If false, screenshots will not be sent to the model.
	 * @default true
	 */
	vision?: boolean
}

export interface EventData {
	message: any
	time: string
}
