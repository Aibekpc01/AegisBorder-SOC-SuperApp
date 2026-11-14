import { useEffect, useRef } from "react";

/** Reveal once, then release observation. Content stays visible without JS motion. */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    const items = root.querySelectorAll('.landing-section-heading, .capability-card, .preview-console, .catalog-grid article, .fr-reveal');
    const reset = () => items.forEach((item) => item.classList.remove('reveal-pending'));
    if (!preference.matches) items.forEach((item) => {
      if (item.getBoundingClientRect().top > window.innerHeight) {
        item.classList.add('reveal-pending');
        observer.observe(item);
      }
    });
    preference.addEventListener('change', reset);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', reset);
      reset();
    };
  }, []);
  return ref;
}
