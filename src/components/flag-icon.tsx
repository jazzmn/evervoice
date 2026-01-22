'use client';

/**
 * Map language codes to country codes for flags
 * Some languages map to multiple countries, we pick the most common one
 */
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  de: 'de', // Germany
  en: 'gb', // United Kingdom
  es: 'es', // Spain
  fr: 'fr', // France
  it: 'it', // Italy
  pt: 'pt', // Portugal
  nl: 'nl', // Netherlands
  pl: 'pl', // Poland
  ru: 'ru', // Russia
  ja: 'jp', // Japan
  zh: 'cn', // China
  ko: 'kr', // South Korea
};

interface FlagIconProps {
  languageCode: string;
  className?: string;
}

/**
 * Displays a country flag based on language code
 * Uses flagcdn.com for flag images
 */
export function FlagIcon({ languageCode, className = '' }: FlagIconProps) {
  const countryCode = LANGUAGE_TO_COUNTRY[languageCode] || languageCode;
  const flagUrl = `https://flagcdn.com/w40/${countryCode}.png`;

  return (
    <img
      src={flagUrl}
      alt={`${countryCode.toUpperCase()} flag`}
      className={`inline-block h-4 w-6 object-cover rounded-sm ${className}`}
      loading="lazy"
    />
  );
}
