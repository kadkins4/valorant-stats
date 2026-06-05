// Glyphs for the VIEW mode switch. Dots = a scatter of frags (neutral, inherits
// the button colour); Flame = the Heatmap glyph (glows accent when active).

export const DotsGlyph = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ display: "block", flexShrink: 0 }}
  >
    <circle cx="6" cy="7" r="2" />
    <circle cx="16" cy="9" r="2" />
    <circle cx="10" cy="16" r="2" />
    <circle cx="18" cy="17" r="2" />
  </svg>
);

export const FlameGlyph = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);
