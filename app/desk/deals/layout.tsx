// Declares the @modal parallel slot so intercepted routes (New deal,
// deal detail) can render as an overlay on top of the board instead of
// navigating away from it. The board itself (children) never unmounts
// while the modal is open.
export default function DealsLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
