/**
 * Inline SVG icons. Emoji and exotic Unicode glyphs render as tofu boxes on
 * some Android/iOS builds, so all interactive controls use these instead.
 */
type IconName =
  | 'journal'
  | 'satchel'
  | 'pause'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'heart'
  | 'bolt'
  | 'close'
  | 'play'
  | 'compass'
  | 'map'
  | 'settings'
  | 'save';

const PATHS: Record<IconName, React.ReactNode> = {
  journal: (
    <>
      <path d="M6 3.5h9a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2z" />
      <path d="M6 16.5A2 2 0 0 1 8 18h9" />
      <path d="M9.5 7.5h5M9.5 10.5h5" />
    </>
  ),
  satchel: (
    <>
      <path d="M4.5 8.5h15v10.5h-15z" />
      <path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7" />
      <path d="M4.5 12.5h15" />
    </>
  ),
  pause: (
    <>
      <rect x="7" y="5.5" width="3.6" height="13" rx="1.2" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" />
    </>
  ),
  jump: (
    <>
      <path d="M12 19V6" />
      <path d="M7 10.5 12 5.5l5 5" />
    </>
  ),
  sprint: (
    <>
      <path d="M5 8h9l-3.5-3.5" />
      <path d="M5 16h9l-3.5 3.5" />
      <path d="M15.5 12H20" />
    </>
  ),
  interact: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V7.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M15 12V9.5a1.5 1.5 0 0 1 3 0V15a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 6 15v-3.2a1.5 1.5 0 0 1 3 0V12" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20z" />,
  bolt: <path d="m13 3-6 10h4l-1 8 7-11h-4z" />,
  close: (
    <>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </>
  ),
  play: <path d="M8 5.5 18 12 8 18.5z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m14.5 9.5-2 5-5 2 2-5z" />
    </>
  ),
  map: (
    <>
      <path d="M4.5 6.5 9 4.5l6 2 4.5-2v13L15 19.5l-6-2-4.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 12H7M17 12h2.2M6.9 6.9l1.6 1.6M15.5 15.5l1.6 1.6M17.1 6.9l-1.6 1.6M8.5 15.5l-1.6 1.6" />
    </>
  ),
  save: (
    <>
      <path d="M5.5 5.5h10l3 3v10h-13z" />
      <path d="M8.5 5.5v4h6v-4" />
      <path d="M8.5 13.5h7v5h-7z" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
