/**
 * Stand-in for a screen that is not built yet. Deliberately unstyled.
 * Replace it with the approved screen; do not decorate it. See DESIGN.md.
 * Renders no landmark: the app shell (or the route) provides `<main>`.
 */
export function RoutePlaceholder({ title, question }: { title: string; question: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>{question}</p>
      <p>Not built yet. This route is a technical placeholder.</p>
    </div>
  );
}
