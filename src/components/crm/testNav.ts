import { fireEvent, screen, within } from '@testing-library/react';

// Test helpers for the hub navigation: sections live in tabs inside hubs.

const hubButtons = () => within(screen.getAllByRole('navigation', { name: 'Hubs' })[0]).getAllByRole('button');
const sectionNav = () => screen.queryAllByRole('navigation', { name: 'Sections' })[0];

// Goes to a section by its name, through whichever hub holds it.
export function openSection(name: RegExp | string) {
  for (const hub of hubButtons()) {
    fireEvent.click(hub);
    const nav = sectionNav();
    const tab = nav && within(nav).queryByRole('button', { name });
    if (tab) { fireEvent.click(tab); return; }
    if (screen.queryByRole('heading', { level: 1, name })) return;
  }
  throw new Error(`No encuentro la sección ${String(name)}`);
}

// Visits every section of every hub.
export function visitAllSections() {
  for (const hub of hubButtons()) {
    fireEvent.click(hub);
    const nav = sectionNav();
    if (nav) for (const tab of within(nav).getAllByRole('button')) fireEvent.click(tab);
  }
}
