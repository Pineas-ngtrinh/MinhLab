export function returnToHomeTop(event: { preventDefault(): void }) {
  if (window.location.pathname !== '/' || window.location.search || window.location.hash) return;
  event.preventDefault();
  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });
}
