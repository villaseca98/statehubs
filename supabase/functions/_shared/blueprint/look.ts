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
    primary: '#0f9fae', primaryText: '#ffffff', navBg: '#1c1a16', navText: '#bdb7ab', navActive: '#ffffff',
  },
};
