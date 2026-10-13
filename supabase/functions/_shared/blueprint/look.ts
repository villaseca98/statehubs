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
  // White surfaces, charcoal text and StateHubs red throughout the workspace.
  colors: {
    bg: '#f8f8fa', surface: '#ffffff', border: '#e8e8ed', text: '#19191d', muted: '#686872',
    primary: '#b41636', primaryText: '#ffffff', navBg: '#ffffff', navText: '#555560', navActive: '#b41636',
    soft: '#fceef1', accent: '#f3a5b6',
  },
};

// The same identity at night: charcoal surfaces, soft borders
// and text that reads without glare.
export const LOOK_DARK: LookColors = {
  bg: '#111114', surface: '#1b1b20', border: '#303038', text: '#f5f5f7', muted: '#a4a4ae',
  primary: '#c51d42', primaryText: '#ffffff', navBg: '#16161a', navText: '#c0c0c8', navActive: '#ffffff',
  soft: '#351b24', accent: '#f3a5b6',
};

// StateHubs corporate colours (legacy 'red' property kept for compatibility).
// `red` is the solid version used for buttons; `light` reads well on dark.
export const BRAND = { from: '#191919', to: '#b41636', red: '#b41636', light: '#f9e8ed', ink: '#141414' } as const;
