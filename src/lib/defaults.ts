import type { AnnotationStyle, ExportSettings, StyleTemplate } from '../types';

export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: '"Segoe UI", Arial, sans-serif', label: 'Segoe UI (standard)' },
  { value: 'Bahnschrift, "Arial Narrow", Arial, sans-serif', label: 'Bahnschrift (industriel)' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Consolas, "Courier New", monospace', label: 'Consolas (technique)' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana (très lisible)' },
];

/** Modèle 1 — framed title-block ("cartouche") added below the photo. */
export const PANEL_STYLE: AnnotationStyle = {
  layout: 'panel',
  position: 'bottom',
  mode: 'extend',
  fontFamily: FONT_OPTIONS[0].value,
  fontScale: 1,
  cornerWidth: 0.5,
  bgColor: '#0f1626',
  bgOpacity: 0.85,
  textColor: '#ffffff',
  labelColor: '#f28c28',
  accentColor: '#f28c28',
  showAccentBar: true,
  showSeparators: true,
  showSite: true,
  showObservations: true,
  showDate: true,
  uppercaseValues: false,
  textOutline: true,
  shadowStrength: 0.8,
  logoDataUrl: '',
  logoPosition: 'bottom-left',
  logoSize: 0.1,
};

/** Default: white text written on the photo, centred at the bottom (site report style). */
export const DEFAULT_STYLE: AnnotationStyle = {
  ...PANEL_STYLE,
  layout: 'text',
  position: 'bottom',
  mode: 'overlay',
  fontFamily: FONT_OPTIONS[2].value,
  labelColor: '#ffffff',
  showDate: false,
  showSite: false,
};

export const BUILTIN_TEMPLATES: StyleTemplate[] = [
  { id: 'builtin-navy', name: 'Modèle 1 — Cartouche', builtin: true, style: PANEL_STYLE },
  { id: 'builtin-site', name: 'Modèle 2 — Texte sur photo (recommandé)', builtin: true, style: DEFAULT_STYLE },
  {
    id: 'builtin-hivis',
    name: 'Haute visibilité',
    builtin: true,
    style: {
      ...PANEL_STYLE,
      fontFamily: FONT_OPTIONS[1].value,
      bgColor: '#111111',
      textColor: '#ffffff',
      labelColor: '#ffd400',
      accentColor: '#ffd400',
      uppercaseValues: true,
      fontScale: 1.1,
    },
  },
  {
    id: 'builtin-blue',
    name: 'Bleu ingénierie',
    builtin: true,
    style: {
      ...PANEL_STYLE,
      bgColor: '#0b1e33',
      labelColor: '#4aa3ff',
      accentColor: '#4aa3ff',
    },
  },
  {
    id: 'builtin-light',
    name: 'Cartouche clair',
    builtin: true,
    style: {
      ...PANEL_STYLE,
      bgColor: '#ffffff',
      bgOpacity: 0.92,
      textColor: '#111827',
      labelColor: '#1f3a68',
      accentColor: '#f28c28',
    },
  },
  {
    id: 'builtin-corner',
    name: 'Encart coin (superposé)',
    builtin: true,
    style: {
      ...PANEL_STYLE,
      position: 'bottom-right',
      mode: 'overlay',
      bgOpacity: 0.78,
      cornerWidth: 0.46,
      fontScale: 0.9,
    },
  },
];

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'jpeg',
  quality: 0.92,
  maxSize: 0,
  naming: 'index-repere',
};

export const DEFAULT_TASKS: string[] = [
  'Travaux de débitage.',
  'Travaux de préparation des chanfreins.',
  "Travaux d'assemblage.",
  'Travaux de soudage.',
  'Travaux de meulage.',
  'Travaux de contrôle dimensionnel.',
  'Travaux de contrôle END.',
  'Travaux de montage.',
  'Travaux de peinture.',
  'Travaux de manutention.',
  'Travaux de nettoyage.',
];

export const MAX_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Résolution originale' },
  { value: 3840, label: '3840 px (4K)' },
  { value: 2560, label: '2560 px' },
  { value: 1920, label: '1920 px (rapport)' },
  { value: 1280, label: '1280 px (e-mail)' },
];
