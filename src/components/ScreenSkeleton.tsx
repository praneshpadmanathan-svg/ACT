export function ScreenSkeleton() {
  return (
    <div
      className="screen-skeleton"
      role="status"
      aria-label="Loading your next screen"
      aria-busy="true"
    >
      <span className="sr-only">Loading your next screen</span>
      <div className="skeleton-line skeleton-short" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line" />
      <div className="skeleton-cards">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
