import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Art } from './Art';

/** Composited atmosphere pauses outside the viewport and in hidden tabs.
 * No animation completion controls navigation or learning state. */
export function RealmScene({
  children,
  className = '',
  art = 'scene-river',
}: {
  children: ReactNode;
  className?: string;
  art?:
    'realm-opening-v2' | 'scene-river' | 'scene-harbour' | 'scene-pass' | 'scene-ridge' | 'camp-bg';
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(true);
  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;
    let visible = true;
    const update = () => setActive(visible && document.visibilityState !== 'hidden');
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            update();
          });
    observer?.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return (
    <section ref={sceneRef} data-active={active} className={`realm-scene ${className}`}>
      <div className="realm-scenery" aria-hidden="true">
        <Art name={art} priority className="realm-painting" />
        <div className="realm-scene-shade" />
        <div className="realm-mist realm-mist-back" />
        <div className="realm-mist realm-mist-front" />
        <div className="realm-stars">
          {Array.from({ length: 16 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--x': `${(i * 37 + 13) % 100}%`,
                  '--y': `${(i * 23 + 19) % 90}%`,
                  '--delay': `${i * -1.7}s`,
                  '--duration': `${7 + (i % 5)}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
