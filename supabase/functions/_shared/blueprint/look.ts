// The one StateHubs look. There used to be a catalogue of styles; now every
// app looks like this so the product has one clear identity and nobody has
// to choose. Components read it through CSS variables (see src theme.ts).

export interface LookColors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  navBg: string;
  navText: string;
  navActive: string;
  soft: string;    // tinted background for chips, active rows and progress tracks
  accent: string;  // the second colour of charts (soft rose)
}

export interface Look {
  density: 'compact' | 'comfortable';
  radius: number;
  colors: LookColors;
}

export const LOOK: Look = {
  density: 'comfortable',
  radius: 18,
  // Ivory surfaces, deep ink text and forest green throughout the workspace.
  colors: {
    bg: '#f6f3ea', surface: '#fffdf7', border: '#e4dfcf', text: '#17241d', muted: '#5c695f',
    primary: '#1f5c43', primaryText: '#fffdf7', navBg: '#fbf8ef', navText: '#4d5a52', navActive: '#1f5c43',
    soft: '#e5eee6', accent: '#c8a96a',
  },
};

// The same identity at night: deep green-charcoal surfaces, soft borders
// and text that reads without glare.
export const LOOK_DARK: LookColors = {
  bg: '#0f1512', surface: '#17201b', border: '#2b372f', text: '#eef3ee', muted: '#a3b0a7',
  primary: '#7cc49c', primaryText: '#0d1a14', navBg: '#121a16', navText: '#c2cdc5', navActive: '#ffffff',
  soft: '#1f3329', accent: '#c8a96a',
};

// StateHubs corporate colours (legacy 'red' property kept for compatibility).
// `red` is the solid version used for buttons; `light` reads well on dark.
export const BRAND = { from: '#191919', to: '#b41636', red: '#b41636', light: '#f9e8ed', ink: '#141414' } as const;
