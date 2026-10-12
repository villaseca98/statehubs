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
    bg: '#f4f7f1', surface: '#ffffff', border: '#e0e8de', text: '#1c2d23', muted: '#6b7b70',
    primary: '#557b5d', primaryText: '#ffffff', navBg: '#173b2b', navText: '#c9d8cc', navActive: '#ffffff',
  },
};
