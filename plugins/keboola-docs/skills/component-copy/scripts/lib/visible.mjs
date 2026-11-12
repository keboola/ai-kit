// The public-component selector, shared by fetch-inventory.mjs and
// component-facts.mjs so the fleet list and a single-component run agree.
//
// It is a proxy read off the public Storage index: a component a normal user
// can pick in the UI. The Developer Portal's own "published" switch is the
// authoritative source and is not in that index, so a doubtful component is
// checked against the portal's public app listing before any PR.
export const isVisible = (c) =>
  !c.expiredOn &&
  !(c.flags || []).includes('excludeFromNewList') &&
  !(c.flags || []).includes('deprecated');
