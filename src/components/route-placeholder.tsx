/**
 * Stand-in for a screen that has not been designed. Deliberately unstyled.
 * Replace it with the designed screen; do not decorate it. See DESIGN.md.
 */
export function RoutePlaceholder({ title, question }: { title: string; question: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{question}</p>
      <p>Not designed yet. This route is a technical placeholder.</p>
    </main>
  );
}
