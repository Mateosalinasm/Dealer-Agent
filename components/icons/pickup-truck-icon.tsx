// No open-source icon set ships a proper pickup-truck glyph distinct from a
// box/delivery truck (checked @tabler/icons-react, @phosphor-icons/react,
// iconoir-react, @icon-park/react, iconsax-react) — every "truck" icon in
// all five is a cargo van/box shape. Tabler's own Car and CarSuv (used
// alongside this one in inventory-grid.tsx) are what supply the sedan/SUV
// icons; this pickup is hand-drawn to match their exact outline style —
// same 24x24 viewBox, 2px round-cap/round-join stroke, same wheel geometry
// and front-left/rear-right orientation — so the three sit together as one
// consistent set rather than three different styles.
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
      <path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M5 17h-2v-5l2 -4v-2h6v3h6v2h2a2 2 0 0 1 2 2v4h-2m-4 0h-6" />
    </svg>
  );
}
