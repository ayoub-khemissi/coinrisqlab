import { useState, useEffect } from "react";

/**
 * Hook to track which section is currently in view
 * @param sectionIds Array of IDs for the sections to track
 * @param offset px offset from top to trigger active state (default: 100)
 * @returns The ID of the currently active section
 */
export function useScrollSpy(sectionIds: string[], offset: number = 100) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };

    const observerOptions = {
      rootMargin: `-${offset}px 0px -80% 0px`,
      threshold: 0,
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);

      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [sectionIds, offset]);

  return activeId;
}
