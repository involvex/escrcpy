# Implementation Plan - Copilot Enhancements & Bun Migration

This plan outlines the steps to migrate the package manager to Bun, disable the subscription feature, add new free model providers, and implement French language support for the Copilot agent.

## 1. Package Manager Migration (PNPM to Bun)

**Objective**: Switch the workspace package manager from PNPM to Bun.

**Files**:

- `pnpm-workspace.yaml` (Delete)
- `package.json` (Verify/Update)
- `desktop/package.json` (Update `packageManager` field)

**Steps**:

1.  Delete `pnpm-workspace.yaml` from the root.
2.  Update `desktop/package.json` to remove the `packageManager` field or set it to `bun`.
3.  Ensure `package.json` scripts are compatible with `bun run`.

## 2. Disable Subscription Feature

**Objective**: Remove the subscription requirement and UI elements for the Copilot feature.

**Files**:

- `desktop/pages/copilot/App.vue`
- `desktop/pages/copilot/components/config/index.vue`
- `desktop/pages/copilot/utils/PreflightChecker.js`
- `desktop/electron/modules/copilot/helpers/session.js`

**Steps**:

1.  **App.vue**: Remove any subscription check logic or UI prompts.
2.  **Config/index.vue**: Remove the subscription status display and "Subscribe" buttons/links.
3.  **PreflightChecker.js**: Remove the `checkSubscription` method and its invocation in `runAll`.
4.  **Session.js**: Remove the `API_NOT_PURCHASED` error handling logic in `_normalizeTaskError`.

## 3. Add Free Model Providers

**Objective**: Integrate new free model providers into the Copilot configuration.

**Files**:

- `desktop/pages/copilot/dicts/api.js`

**Steps**:

1.  Update `ApiModelEnum` to include:
    - **OpenCode** (`https://opencode.ai/zen/v1`)
    - **MiniMax** (`https://api.minimax.io/v1`)
    - **Kilo** (`https://api.kilo.ai/api/gateway`)
    - **FreeModelsRouter** (`https://api.freemodelsrouter.ai/v1`) - _Placeholder based on request_
    - **OpenRouter** (`https://openrouter.ai/api/v1`) - _As a reliable free model router_

## 4. French Language Support

**Objective**: Add French language support to the AutoGLM agent and Copilot UI.

**Files**:

- `packages/autoglm.js/src/constants/prompts_fr.ts` (Create)
- `packages/autoglm.js/src/context/config.ts`
- `packages/autoglm.js/src/context/types.ts`
- `desktop/pages/copilot/components/config/index.vue`
- `desktop/pages/copilot/App.vue`

**Steps**:

1.  **Prompts**: Create `prompts_fr.ts` containing the French system prompt (translated from `prompts_en.ts`).
2.  **Types**: Update `AgentConfigType` in `types.ts` to include `'fr'` in the `lang` union type.
3.  **Config**: Update `getSystemPrompt` in `config.ts` to return the French prompt when `lang` is `'fr'`.
4.  **UI**: Add a "Français" radio button in `desktop/pages/copilot/components/config/index.vue`.
5.  **Logic**: Update `desktop/pages/copilot/App.vue` to map French locale (e.g., `fr`, `fr-FR`) to the `'fr'` agent config.

## Verification

1.  **Build**: Verify the project builds with `bun run build`.
2.  **Copilot UI**: Check that the subscription UI is gone.
3.  **Providers**: Verify new providers appear in the configuration dropdown.
4.  **Language**: Select "Français" and verify the agent output (or at least the system prompt logic) supports it.
