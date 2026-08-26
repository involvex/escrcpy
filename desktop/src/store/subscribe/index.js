import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Inert placeholder for the removed subscribe feature.
 * Keeps any legacy reference safe instead of throwing ReferenceError.
 */
export const useSubscribeStore = defineStore('app-subscribe', () => {
  const accessToken = ref('')

  async function init() {}

  return {
    accessToken,
    init,
  }
})
