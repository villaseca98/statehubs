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
}

export interface Look {
  density: 'compact' | 'comfortable';
  radius: number;
  colors: LookColors;
}

export const LOOK: Look = {
  density: 'comfortable',
  radius: 14,
  colors: {
    bg: '#f5f4f0', surface: '#ffffff', border: '#e6e2d9', text: '#1c1a16', muted: '#6e695f',
    primary: '#e5304a', primaryText: '#ffffff', navBg: '#1c1a16', navText: '#bdb7ab', navActive: '#ffffff',
  },
};

// The same look at night: deep ink background (BRAND.ink), raised surfaces,
// soft borders and text that reads without glare. The red stays the red.
export const LOOK_DARK: LookColors = {
  bg: '#0b1020', surface: '#131a2e', border: '#252e48', text: '#e7e9f1', muted: '#98a1b9',
  primary: '#ef3d56', primaryText: '#ffffff', navBg: '#070a15', navText: '#a3abc2', navActive: '#ffffff',
};

// The brand colours of the logo («Capas de estado»): a red-to-pink gradient.
// `red` is the solid version used for buttons; `light` reads well on dark.
export const BRAND = { from: '#ff5a36', to: '#ff2d87', red: '#e5304a', light: '#ff7a8c', ink: '#0b1020' } as const;
