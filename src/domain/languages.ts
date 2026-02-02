export type LanguageOption = {
  code: string;
  label: string;
  emoji: string;
};

export const EXTRA_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', emoji: '🇬🇧' },
  { code: 'es', label: 'Spanish', emoji: '🇪🇸' },
  { code: 'fr', label: 'French', emoji: '🇫🇷' },
  { code: 'de', label: 'German', emoji: '🇩🇪' },
  { code: 'it', label: 'Italian', emoji: '🇮🇹' },
  { code: 'pt', label: 'Portuguese', emoji: '🇵🇹' },
  { code: 'pl', label: 'Polish', emoji: '🇵🇱' },
  { code: 'uk', label: 'Ukrainian', emoji: '🇺🇦' },
  { code: 'ru', label: 'Russian', emoji: '🇷🇺' },
  { code: 'tr', label: 'Turkish', emoji: '🇹🇷' },
  { code: 'ja', label: 'Japanese', emoji: '🇯🇵' },
  { code: 'ko', label: 'Korean', emoji: '🇰🇷' },
  { code: 'zh', label: 'Chinese', emoji: '🇨🇳' },
  { code: 'ar', label: 'Arabic', emoji: '🇸🇦' },
];

export function getLanguageOption(code?: string | null): LanguageOption | null {
  if (!code) return null;
  return EXTRA_LANGUAGES.find((l) => l.code === code) ?? null;
}
