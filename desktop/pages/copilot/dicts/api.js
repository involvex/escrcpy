import { Enum } from 'enum-plus'

export const ApiModelEnum = Enum({
  BigModel: {
    value: 'https://open.bigmodel.cn/api/paas/v4',
    label: 'autoglm-phone',
  },
  ModelScope: {
    value: 'https://api-inference.modelscope.cn/v1',
    label: 'ZhipuAI/AutoGLM-Phone-9B',
  },
  Gitee: {
    value: 'https://api.moark.com/v1',
    label: 'AutoGLM-Phone-9B-Multilingual',
  },
  OpenCode: {
    value: 'https://opencode.ai/zen/v1',
    label: 'opencode/mimo-2.5-free',
  },
  MiniMax: {
    value: 'https://api.minimax.io/v1',
    label: 'minimax-m2.5',
  },
  Kilo: {
    value: 'https://api.kilo.ai/api/gateway',
    label: 'kilocode/kilo/auto',
  },
  FreeModelsRouter: {
    value: 'https://api.freemodelsrouter.ai/v1',
    label: 'free/auto',
  },
  OpenRouter: {
    value: 'https://openrouter.ai/api/v1',
    label: 'openrouter/free',
  },
  Custom: {
    value: '',
    label: '',
  },
})
