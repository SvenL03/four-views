"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Lets [data-reveal] blocks rise into place as they scroll into view.
 * Content is never hidden without script: only blocks below the fold at
 * mount are held back, and reduced-motion readers get no travel at all.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // reveal on entry, and also anything the reader has jumped past
          if (!e.isIntersecting && e.boundingClientRect.top > 0) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const scan = () => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-held):not(.is-in)").forEach((el) => {
        if (el.getBoundingClientRect().top < vh * 0.92) return; // already on screen: leave it
        el.classList.add("is-held");
        io.observe(el);
      });
    };

    const raf = requestAnimationFrame(scan);
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
