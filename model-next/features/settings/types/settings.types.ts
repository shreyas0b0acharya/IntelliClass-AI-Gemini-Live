export interface ModelPreferences {
  defaultGender: "male" | "female";
  defaultMaleModelName: string;
  defaultFemaleModelName: string;
  defaultMaleVoice: string;
  defaultFemaleVoice: string;
  speechSpeed: number;
  speechPitch: number;
  modelQuality: "high" | "medium" | "low";
}
