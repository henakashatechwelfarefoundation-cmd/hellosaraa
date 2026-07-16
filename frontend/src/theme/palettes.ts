/**
 * Color palettes for the 3 supported themes: Dark, AMOLED, Light.
 * The brand accents (deep purple + electric cyan) stay constant across themes.
 */

export type ThemeName = 'dark' | 'amoled' | 'light';

export interface Palette {
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  onSurface: string;
  onSurfaceSecondary: string;
  onSurfaceTertiary: string;
  brand: string;
  brandSecondary: string;
  brandTertiary: string;
  onBrand: string;
  border: string;
  borderStrong: string;
  divider: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  // glass helpers
  glassTint: string; // translucent overlay to sit under blur
  glassBorder: string;
  // gradients (as tuple)
  auroraTop: string;
  auroraBottom: string;
}

const brand = '#7C3AED';
const brandSecondary = '#06B6D4';
const brandTertiary = '#4C1D95';

export const DARK: Palette = {
  surface: '#09090B',
  surfaceSecondary: '#18181B',
  surfaceTertiary: '#27272A',
  onSurface: '#FAFAFA',
  onSurfaceSecondary: '#A1A1AA',
  onSurfaceTertiary: '#71717A',
  brand,
  brandSecondary,
  brandTertiary,
  onBrand: '#FFFFFF',
  border: '#27272A',
  borderStrong: '#3F3F46',
  divider: '#27272A',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  glassTint: 'rgba(24,24,27,0.55)',
  glassBorder: 'rgba(255,255,255,0.08)',
  auroraTop: '#1E1B4B',
  auroraBottom: '#020617',
};

export const AMOLED: Palette = {
  ...DARK,
  surface: '#000000',
  surfaceSecondary: '#09090B',
  surfaceTertiary: '#18181B',
  border: '#18181B',
  borderStrong: '#27272A',
  divider: '#18181B',
  glassTint: 'rgba(9,9,11,0.7)',
  glassBorder: 'rgba(255,255,255,0.06)',
  auroraTop: '#0A0A0F',
  auroraBottom: '#000000',
};

export const LIGHT: Palette = {
  surface: '#FAFAFA',
  surfaceSecondary: '#FFFFFF',
  surfaceTertiary: '#F4F4F5',
  onSurface: '#09090B',
  onSurfaceSecondary: '#52525B',
  onSurfaceTertiary: '#71717A',
  brand,
  brandSecondary,
  brandTertiary: '#A78BFA',
  onBrand: '#FFFFFF',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',
  divider: '#E4E4E7',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  glassTint: 'rgba(255,255,255,0.65)',
  glassBorder: 'rgba(0,0,0,0.06)',
  auroraTop: '#EDE9FE',
  auroraBottom: '#F5F3FF',
};

export const PALETTES: Record<ThemeName, Palette> = {
  dark: DARK,
  amoled: AMOLED,
  light: LIGHT,
};
