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
  accent: string;  // the second colour of charts (a soft lime)
}

export interface Look {
  density: 'compact' | 'comfortable';
  radius: number;
  colors: LookColors;
}

export const LOOK: Look = {
  density: 'comfortable',
  radius: 18,
  // Forest green on warm cream: the look of a real-estate brand, not of a tool.
  colors: {
    bg: '#f3f1eb', surface: '#ffffff', border: '#e7e3d9', text: '#15231b', muted: '#6b746d',
    primary: '#1f5c45', primaryText: '#ffffff', navBg: '#ffffff', navText: '#4b554e', navActive: '#1f5c45',
    soft: '#e8f1ec', accent: '#e4ec7c',
  },
};

// The same look at night: deep green-black, raised surfaces, soft borders
// and text that reads without glare.
export const LOOK_DARK: LookColors = {
  bg: '#0c1410', surface: '#141f19', border: '#243229', text: '#e9eee9', muted: '#9ca89f',
  primary: '#3f9e78', primaryText: '#ffffff', navBg: '#101a14', navText: '#b3beb6', navActive: '#ffffff',
  soft: '#1b2c23', accent: '#d5df63',
};

// StateHubs evergreen brand colours (legacy 'red' property kept for compatibility).
// `red` is the solid version used for buttons; `light` reads well on dark.
export const BRAND = { from: '#1e3a2b', to: '#3f8060', red: '#1f5c45', light: '#a8d6b2', ink: '#17231b' } as const;
