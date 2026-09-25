// lucide-react's Truck icon reads as a box/delivery truck (a cargo box
// behind the cab) — wrong silhouette for a pickup. Hand-drawn instead,
// same stroke-based style as the lucide icons it sits next to (currentColor,
// 2px stroke, round joins). The step down from the cab roof to a lower,
// flat open bed is the one visual cue that reads as "pickup" rather than
// "box truck" or "hatchback" even at 14-16px, so the whole shape is built
// around making that step unambiguous.
export function PickupTruckIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 18V13H7L9 8H13V12H20V18" />
      <path d="M2 18H3.5" />
      <path d="M7.5 18H15" />
      <path d="M19 18H20.5" />
      <circle cx="5.5" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
