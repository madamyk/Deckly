export type DecklyScheme = 'light' | 'dark';

export type DecklyTheme = {
  scheme: DecklyScheme;
  colors: {
    bg: string;
    bgGradientTop: string;
    bgGradientBottom: string;
    surface: string;
    surface2: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    primary2: string;
    danger: string;
    warning: string;
    success: string;
    shadow: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

export function getTheme(scheme: DecklyScheme): DecklyTheme {
  if (scheme === 'dark') {
    return {
      scheme,
      colors: {
        bg: '#0B0E14',
        bgGradientTop: '#0B0E14',
        bgGradientBottom: '#0F1A2B',
        surface: '#101725',
        surface2: '#151F31',
        border: 'rgba(255,255,255,0.08)',
        text: '#EEF2FF',
        textMuted: 'rgba(238,242,255,0.72)',
        primary: '#7C5CFF',
        primary2: '#4FD1C5',
        danger: '#FF5C7A',
        warning: '#FFB020',
        success: '#34D399',
        shadow: 'rgba(0,0,0,0.5)',
      },
      radius: { sm: 10, md: 14, lg: 18, xl: 26 },
      spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
    };
  }

  return {
    scheme,
    colors: {
      bg: '#F7F7FF',
      bgGradientTop: '#F7F7FF',
      bgGradientBottom: '#EAF2FF',
      surface: '#FFFFFF',
      surface2: '#F2F4FF',
      border: 'rgba(0,0,0,0.08)',
      text: '#111827',
      textMuted: 'rgba(17,24,39,0.65)',
      primary: '#4F46E5',
      primary2: '#0EA5E9',
      danger: '#E11D48',
      warning: '#D97706',
      success: '#059669',
      shadow: 'rgba(17,24,39,0.16)',
    },
    radius: { sm: 10, md: 14, lg: 18, xl: 26 },
    spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  };
}

