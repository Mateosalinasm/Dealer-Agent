// Solid side-profile silhouette (matching the reference photo the operator
// sent, not lucide's stroke style) — cab + windshield on the right (front),
// stepping down to a flat open bed on the left (rear). The step down is
// what reads as "pickup" rather than "box truck" even at tiny sizes.
export function PickupTruckIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size * 2} height={size} viewBox="0 0 48 24" fill="currentColor" className={className}>
      <path d="M44 19 L44 14 L39 14 L37 6 L33 6 L33 12 L10 12 L10 19 Z" />
      <circle cx="15" cy="19.5" r="3.4" />
      <circle cx="38" cy="19.5" r="3.4" />
    </svg>
  );
}
