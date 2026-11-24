/** Hand-drawn SVG item icons — no emoji, so they render identically everywhere. */
const ICONS: Record<string, React.ReactNode> = {
  sunleaf: (
    <>
      <path d="M12 21v-7" stroke="#7aa15a" strokeWidth="1.8" />
      <path d="M12 14c-4.6 0-6.4-2.6-6.4-6.4C9.8 7.6 12 9.6 12 14z" fill="#e8c25f" stroke="#b89637" strokeWidth="1.1" />
      <path d="M12 14c4.6 0 6.4-2.6 6.4-6.4C14.2 7.6 12 9.6 12 14z" fill="#f2d47a" stroke="#b89637" strokeWidth="1.1" />
      <circle cx="12" cy="5.6" r="1.5" fill="#fff0b8" />
    </>
  ),
  embercap: (
    <>
      <path d="M10.6 13.4h2.8v6.2a1.4 1.4 0 0 1-2.8 0z" fill="#efe6d2" stroke="#c6b89c" strokeWidth="1.1" />
      <path d="M5.2 13.2c0-3.6 3-6.4 6.8-6.4s6.8 2.8 6.8 6.4z" fill="#e07a45" stroke="#b3542a" strokeWidth="1.2" />
      <circle cx="9.4" cy="10.6" r="1" fill="#ffd9a8" />
      <circle cx="14.4" cy="11.4" r="0.8" fill="#ffd9a8" />
      <circle cx="12" cy="9" r="0.7" fill="#ffd9a8" />
    </>
  ),
  riverstone: (
    <>
      <path d="M12 4.4 18 9l-1.6 8.2-8.8.6L5.4 10z" fill="#7fc3d6" stroke="#4d8fa8" strokeWidth="1.2" />
      <path d="M12 4.4 14.6 12l-4.2 5.6-3-7.6z" fill="#a9e0ea" opacity="0.75" />
    </>
  ),
  waystone_shard: (
    <>
      <path d="M12 2.8 17.4 10l-3 10.4-5-3.2L8 11z" fill="#6fa8c8" stroke="#39627d" strokeWidth="1.2" />
      <path d="M12 6.5v8.6M10 10.4h4" stroke="#cdf2ff" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  trail_ration: (
    <>
      <path d="M4.6 13.4c0-3.4 3.3-6 7.4-6s7.4 2.6 7.4 6-3.3 5.4-7.4 5.4-7.4-2-7.4-5.4z" fill="#d9a76a" stroke="#a97b42" strokeWidth="1.2" />
      <path d="M7.6 12.2c1.4 1.2 3 1.6 4.4 1.6s3-.4 4.4-1.6" stroke="#f3d2a0" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 9.6c.8.6 1.9.9 3 .9s2.2-.3 3-.9" stroke="#b98a52" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  fishermans_lure: (
    <>
      <path d="M12 4v9.6a3.4 3.4 0 1 1-3.4 3.4" fill="none" stroke="#c9d4dd" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 4c2.4 0 3.6 1.6 3.6 3.2 0 2-1.8 3-3.6 3s-3.6-1-3.6-3" fill="#e0684f" stroke="#a8442f" strokeWidth="1.1" />
      <circle cx="12" cy="13.8" r="1.5" fill="#f3d27a" stroke="#b8962f" strokeWidth="1" />
    </>
  ),
  horizon_compass: (
    <>
      <circle cx="12" cy="12" r="8.2" fill="#1d2c3d" stroke="#c9a25f" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#7f9bb5" strokeWidth="0.8" />
      <path d="m14.8 9.2-2 5.6-5.6 2 2-5.6z" fill="#e8c07a" stroke="#a88444" strokeWidth="0.9" />
      <circle cx="12" cy="12" r="0.9" fill="#fff4dc" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9z" fill="#bff0ff" stroke="#7fc9e0" strokeWidth="1.1" />
      <circle cx="18.5" cy="5.5" r="1" fill="#dff6ff" />
      <circle cx="5.6" cy="17.4" r="0.85" fill="#dff6ff" />
    </>
  ),
  speed: (
    <>
      <path d="M4 12h9.5" stroke="#ffd479" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 7.6 18 12l-7 4.4z" fill="#ffc85e" stroke="#c99a34" strokeWidth="1" />
      <path d="M3 8.6h4.4M3 15.4h4.4" stroke="#ffe6ae" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  mist: (
    <>
      <path d="M5 10.4c0-2.6 2.3-4.6 5.2-4.6 2.6 0 4.2 1.4 4.6 3 1.9.3 3.2 1.6 3.2 3.2 0 1.9-1.6 3.2-3.6 3.2" fill="#e3d2ff" stroke="#b39ddb" strokeWidth="1.1" />
      <path d="M4 13.4h7.4M6 16h6.4" stroke="#c9b6e8" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
};

export function ItemIcon({ id, size = 24 }: { id: string; size?: number }) {
  const content = ICONS[id];
  if (!content) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {content}
    </svg>
  );
}
