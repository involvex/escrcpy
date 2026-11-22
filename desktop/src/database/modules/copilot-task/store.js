/**
 * Copilot task store - persisted batch task records.
 *
 * @module storage/modules/copilot-task
 */

import { BaseStore } from '$/database/core/BaseStore.js'
import { FieldTypes } from '$/database/utils/validation.js'

export const CopilotTaskStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
}

const copilotTaskSchema = {
  id: {
    type: FieldTypes.STRING,
    required: true,
  },
  prompt: {
    type: FieldTypes.STRING,
    required: true,
  },
  deviceIds: {
    type: FieldTypes.ARRAY,
  },
  total: {
    type: FieldTypes.NUMBER,
  },
  succeeded: {
    type: FieldTypes.NUMBER,
  },
  failed: {
    type: FieldTypes.NUMBER,
  },
  status: {
    type: FieldTypes.STRING,
    required: true,
    enum: Object.values(CopilotTaskStatus),
  },
  error: {
    type: FieldTypes.STRING,
  },
  createdAt: {
    type: FieldTypes.NUMBER,
    required: true,
  },
  finishedAt: {
    type: FieldTypes.NUMBER,
  },
  durationMs: {
    type: FieldTypes.NUMBER,
  },
  promptTokens: {
    type: FieldTypes.NUMBER,
  },
  completionTokens: {
    type: FieldTypes.NUMBER,
  },
  totalTokens: {
    type: FieldTypes.NUMBER,
  },
}

class CopilotTaskStore extends BaseStore {
  constructor() {
    super({
      tableName: 'copilotTasks',
      schema: copilotTaskSchema,
      primaryKey: 'id',
      requiredFields: ['id', 'prompt', 'status', 'createdAt'],
    })
  }

  async createTask(data) {
    return this.add({
      deviceIds: [],
      total: 0,
      succeeded: 0,
      failed: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      ...data,
      status: data.status || CopilotTaskStatus.RUNNING,
      createdAt: data.createdAt || Date.now(),
    })
  }

  async finishTask(id, patch = {}) {
    const result = await this.getById(id)
    const existing = result?.data || {}
    const finishedAt = patch.finishedAt || Date.now()
    const durationMs = Math.max(0, finishedAt - (existing.createdAt || finishedAt))

    return this.update(id, {
      status: patch.status,
      succeeded: patch.succeeded ?? existing.succeeded ?? 0,
      failed: patch.failed ?? existing.failed ?? 0,
      ...(patch.total !== undefined ? { total: patch.total } : {}),
      promptTokens: patch.promptTokens ?? existing.promptTokens ?? 0,
      completionTokens: patch.completionTokens ?? existing.completionTokens ?? 0,
      totalTokens: patch.totalTokens ?? existing.totalTokens ?? 0,
      error: patch.error || '',
      finishedAt,
      durationMs,
    })
  }
}

export const copilotTaskStore = new CopilotTaskStore()
