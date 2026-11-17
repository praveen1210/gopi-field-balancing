import { StyleSheet, useColorScheme } from 'react-native';

/**
 * App theme: semantic colour tokens for light and dark mode, plus spacing,
 * radius and type sizes. Screens never use raw hex colours; they read tokens
 * through {@link makeStyles} or {@link useAppTheme}, so dark mode follows the
 * phone setting everywhere.
 */

export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Subtle fills: chips, summary boxes, pressed rows. */
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryBorder: string;
  onPrimary: string;
  /** Amber highlight from the brand (reference numbers, badges). */
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  placeholder: string;
  overlay: string;
  tabBar: string;
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
}

/** GTG Vibral navy and amber, matching the website. */
export const BRAND_NAVY = '#0F1F33';
export const BRAND_GOLD = '#FFB020';

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#FBF8F1',
    surface: '#FFFFFF',
    surfaceAlt: '#F1EEE6',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    primary: BRAND_NAVY,
    primaryPressed: '#0A1626',
    primarySoft: '#E3E9F5',
    primaryBorder: '#C5D1E8',
    onPrimary: '#FFFFFF',
    accent: BRAND_GOLD,
    accentSoft: '#FBF1D9',
    onAccent: '#13213B',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    onDanger: '#FFFFFF',
    success: '#15803D',
    successSoft: '#DCFCE7',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    placeholder: '#94A3B8',
    overlay: 'rgba(15, 23, 42, 0.45)',
    tabBar: '#FFFFFF',
  },
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#0A1426',
    surface: '#131C2E',
    surfaceAlt: '#1A2540',
    border: '#24314B',
    borderStrong: '#34435F',
    text: '#E5EAF3',
    textSecondary: '#C7D0DF',
    textMuted: '#94A3B8',
    textSubtle: '#64748B',
    primary: '#8FB0EE',
    primaryPressed: '#B5CBF5',
    primarySoft: '#16264A',
    primaryBorder: '#2A3A5C',
    onPrimary: '#0A1426',
    accent: '#F2C14E',
    accentSoft: '#3A2F12',
    onAccent: '#13213B',
    danger: '#F87171',
    dangerSoft: '#3A1A1E',
    onDanger: '#0B1220',
    success: '#4ADE80',
    successSoft: '#123120',
    warning: '#FBBF24',
    warningSoft: '#3A2C0C',
    placeholder: '#64748B',
    overlay: 'rgba(0, 0, 0, 0.6)',
    tabBar: '#131C2E',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 } as const;

/** Current theme, following the phone's light/dark setting. */
export function useAppTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/**
 * `const useStyles = makeStyles((t) => ({ … }))`, then `const styles = useStyles()`
 * inside the component. One stylesheet is created per theme and cached.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useAppTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
