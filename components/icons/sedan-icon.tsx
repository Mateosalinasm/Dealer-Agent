// Solid side-profile silhouette matching the reference photo — low, long
// body with a sloped hood/nose at the front (right) and a shorter, tapered
// trunk at the rear (left). Same orientation and viewBox as the other two
// category icons so the three sit at consistent size next to each other.
export function SedanIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size * 2} height={size} viewBox="0 0 48 24" fill="currentColor" className={className}>
      <path d="M44 19 L44 15 L40 12 L34 12 L30 7 L18 7 L12 12 L7 12 L4 17 L4 19 Z" />
      <circle cx="11" cy="19.5" r="3.4" />
      <circle cx="37" cy="19.5" r="3.4" />
    </svg>
  );
}
