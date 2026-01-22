/**
 * Custom action configuration for external service integration
 */
export interface CustomAction {
  /** Unique identifier for the action */
  id: string;
  /** Display name for the action button */
  name: string;
  /** API endpoint URL to POST transcription text to */
  url: string;
}

/**
 * Supported languages for transcription (ISO 639-1 codes)
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Espanol', flag: '🇪🇸' },
  { code: 'fr', name: 'Francais', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portugues', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Russkiy', flag: '🇷🇺' },
  { code: 'ja', name: 'Nihongo', flag: '🇯🇵' },
  { code: 'zh', name: 'Zhongwen', flag: '🇨🇳' },
  { code: 'ko', name: 'Hangugeo', flag: '🇰🇷' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

/**
 * Default global hotkey for recording toggle
 */
export const DEFAULT_GLOBAL_HOTKEY = 'Ctrl+Shift+R';

/**
 * Application settings interface matching the Rust Settings struct
 */
export interface Settings {
  /** Maximum recording duration in minutes */
  maxDuration: number;
  /** OpenAI API key for Whisper transcription */
  apiKey: string | null;
  /** Language for transcription (ISO 639-1 code) */
  language: LanguageCode;
  /** Custom action buttons for external service integration */
  customActions: CustomAction[];
  /** Global hotkey for toggling recording (e.g., "Ctrl+Shift+R") */
  globalHotkey: string | null;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: Settings = {
  maxDuration: 5,
  apiKey: null,
  language: 'de',
  customActions: [],
  globalHotkey: null, // Will use DEFAULT_GLOBAL_HOTKEY when null
};
