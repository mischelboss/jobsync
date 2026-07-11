import { AiProvider } from "./ai.model";

export interface AiSettings {
  provider: AiProvider;
  model: string | undefined;
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
}

export interface ResearchSettings {
  /** Class-3 interview-process research (scrapes anecdotal review sites).
   *  Off by default: legally grey and unreliable, opt-in per the issue. */
  enableProcessResearch: boolean;
}

export interface UserSettingsData {
  ai: AiSettings;
  display: DisplaySettings;
  research: ResearchSettings;
}

export interface UserSettings {
  userId: string;
  settings: UserSettingsData;
}

export const defaultUserSettings: UserSettingsData = {
  ai: {
    provider: AiProvider.OLLAMA,
    model: undefined,
  },
  display: {
    theme: "system",
  },
  research: {
    enableProcessResearch: false,
  },
};
