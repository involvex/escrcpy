export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ModelResponse {
  thinking: string
  action: string
  rawContent: string
  usage?: TokenUsage
}
