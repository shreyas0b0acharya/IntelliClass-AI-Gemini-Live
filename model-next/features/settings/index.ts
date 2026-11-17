// features/settings/index.ts

// Components
export { AccountProfileSettings } from "./components/AccountProfileSettings";
export { DeleteAccountDialog } from "./components/DeleteAccountDialog";
export { GenderSelector } from "./components/GenderSelector";
export { ModelNameInput } from "./components/ModelNameInput";
export { VoiceSpeedControls } from "./components/VoiceSpeedControls";

// Services & Constants
export {
  useModelPreferences,
  getModelPreferences,
  saveModelPreferences,
  syncPreferencesFromSupabase,
  DEFAULT_MODEL_PREFERENCES,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
  VOICE_OPTIONS,
} from "./services/settings";

// Types
export type { ModelPreferences } from "./types/settings.types";
