export type PanelPosition = 'bottom' | 'top' | 'bottom-left' | 'bottom-right';
/** extend = the panel is added outside the photo (canvas grows, nothing hidden). overlay = drawn on top of the photo. */
export type PanelMode = 'extend' | 'overlay';

/** text = white lines written directly on the photo (site style). panel = framed title block. */
export type AnnotationLayout = 'text' | 'panel';
export type LogoPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface AnnotationStyle {
  layout: AnnotationLayout;
  position: PanelPosition;
  mode: PanelMode;
  fontFamily: string;
  /** Text size multiplier (1 = default). */
  fontScale: number;
  /** Width of the corner panel as a fraction of image width (corner positions only). */
  cornerWidth: number;
  bgColor: string;
  /** 0..1, used for overlay panels. Extended bands are always opaque. */
  bgOpacity: number;
  textColor: string;
  labelColor: string;
  accentColor: string;
  showAccentBar: boolean;
  showSeparators: boolean;
  showSite: boolean;
  showObservations: boolean;
  showDate: boolean;
  uppercaseValues: boolean;
  /** Text layout: thin dark outline around letters. */
  textOutline: boolean;
  /** Text layout: drop shadow strength 0..1. */
  shadowStrength: number;
  /** Optional company logo (PNG data URL, '' = none). */
  logoDataUrl: string;
  logoPosition: LogoPosition;
  /** Logo size as a fraction of the photo's short side. */
  logoSize: number;
}

export interface PhotoData {
  id: string;
  name: string;
  width: number;
  height: number;
  repere: string;
  task: string;
  observations: string;
  /** Per-photo overrides. Empty string = inherit from project. */
  projectOverride: string;
  designationOverride: string;
  dateOverride: string;
  siteOverride: string;
}

export interface PhotoItem extends PhotoData {
  thumbUrl: string;
}

export type ExportFormat = 'jpeg' | 'png';
export type NamingPattern = 'index-repere' | 'index-repere-task' | 'original';

export interface ExportSettings {
  format: ExportFormat;
  /** 0.5..1 (JPEG only) */
  quality: number;
  /** Max long side in px. 0 = original resolution. */
  maxSize: number;
  naming: NamingPattern;
}

export interface ProjectRecord {
  id: string;
  /** User profile that owns the project (missing = created before profiles existed). */
  ownerId?: string;
  name: string;
  /** Equipment designation, e.g. "SUMP TANK" (filled from the dropdown). */
  designation: string;
  /** ISO yyyy-mm-dd */
  date: string;
  site: string;
  createdAt: number;
  updatedAt: number;
  style: AnnotationStyle;
  exportSettings: ExportSettings;
  photos: PhotoData[];
}

export interface StyleTemplate {
  id: string;
  name: string;
  style: AnnotationStyle;
  builtin?: boolean;
}

export interface AnnotationFields {
  project: string;
  designation: string;
  repere: string;
  task: string;
  date: string;
  site: string;
  observations: string;
}
