// Solid side-profile silhouette matching the reference photo — taller,
// boxier cabin than the sedan icon, a flat roof, and a more upright rear
// hatch instead of a tapered trunk. Same orientation/viewBox as the other
// two category icons.
export function SuvIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size * 2} height={size} viewBox="0 0 48 24" fill="currentColor" className={className}>
      <path d="M44 19 L44 13 L40 10 L36 10 L33 6 L14 6 L10 10 L5 10 L4 14 L4 19 Z" />
      <circle cx="11" cy="19.5" r="3.6" />
      <circle cx="37" cy="19.5" r="3.6" />
    </svg>
  );
}
