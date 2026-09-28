"use client";

export default function ArchiveError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="empty-state" role="alert">
        <h1>Our Places couldn’t be loaded</h1>
        <p>Please try again in a moment. Your saved experiences have not been changed.</p>
        <button type="button" className="button button--primary" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
