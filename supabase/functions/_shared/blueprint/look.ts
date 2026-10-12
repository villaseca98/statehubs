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

// The brand colours of the logo («Capas de estado»): a red-to-pink gradient.
// `red` is the solid version used for buttons; `light` reads well on dark.
export const BRAND = { from: '#ff5a36', to: '#ff2d87', red: '#e5304a', light: '#ff7a8c', ink: '#0b1020' } as const;
