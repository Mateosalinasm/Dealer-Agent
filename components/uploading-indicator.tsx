import { Upload } from "lucide-react";

// Shared "this is actively uploading and being AI-analyzed" button label —
// the arrow bounces via the upload-arrow-bounce keyframes in
// app/globals.css. Pair with adding
// "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]" to the
// button's own className while pending, so the whole pill pulses too.
export function UploadingLabel({ label = "Uploading & analyzing…" }: { label?: string }) {
  return (
    <>
      <Upload size={13} className="flex-none [animation:upload-arrow-bounce_0.9s_ease-in-out_infinite]" />
      {label}
    </>
  );
}
