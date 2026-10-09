/**
 * TypingText - ChatGPT-style typing animation for bullet points
 * 
 * Renders an array of bullet strings character-by-character with a blinking cursor.
 * Completed bullets render immediately; only the current bullet types.
 * Fires onComplete callback when all bullets have finished typing.
 * 
 * Databricks service names in the text are rendered as clickable spans
 * that trigger the shared ServicePopover.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { ServiceKey } from './ServicePopover';
import { buildServiceNameMap, renderTextWithServices } from './TypingText.utils';

interface TypingTextProps {
  /** Summary line shown immediately (not typed) */
  summary: string;
  /** Bullet strings to type one by one */
  bullets: string[];
  /** Databricks service keys to make clickable in the text */
  services: ServiceKey[];
  /** Typing speed in ms per character */
  speed?: number;
  /** Delay before starting to type (ms) */
  startDelay?: number;
  /** Called when all bullets have finished typing */
  onComplete?: () => void;
}

export function TypingText({ 
  summary, 
  bullets, 
  services, 
  speed = 18, 
  startDelay = 300,
  onComplete 
}: TypingTextProps) {
  const [currentBulletIndex, setCurrentBulletIndex] = useState(-1); // -1 = not started
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const completeCalled = useRef(false);
  const serviceNameMap = useMemo(() => buildServiceNameMap(services), [services]);

  // Start delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentBulletIndex(0);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [startDelay]);

  // Typing animation using requestAnimationFrame
  useEffect(() => {
    if (currentBulletIndex < 0 || isComplete) return;

    const animate = (timestamp: number) => {
      if (currentBulletIndex >= bullets.length) return;

      const currentBullet = bullets[currentBulletIndex];

      if (timestamp - lastTimeRef.current >= speed) {
        lastTimeRef.current = timestamp;

        if (currentCharIndex < currentBullet.length) {
          setCurrentCharIndex(prev => prev + 1);
        } else {
          // Current bullet complete, move to next
          if (currentBulletIndex < bullets.length - 1) {
            setCurrentBulletIndex(prev => prev + 1);
            setCurrentCharIndex(0);
          } else {
            // All bullets complete
            setIsComplete(true);
            if (!completeCalled.current) {
              completeCalled.current = true;
              onComplete?.();
            }
            return;
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentBulletIndex, currentCharIndex, bullets, speed, onComplete, isComplete]);

  return (
    <div className="space-y-3">
      {/* Summary (shown immediately) */}
      <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
      
      {/* Bullet list */}
      <ul className="space-y-2">
        {bullets.map((bullet, idx) => {
          if (idx > currentBulletIndex && currentBulletIndex >= 0) return null; // Not yet reached
          if (currentBulletIndex < 0) return null; // Not started
          
          const isCurrentlyTyping = idx === currentBulletIndex && !isComplete;
          const displayText = isCurrentlyTyping 
            ? bullet.slice(0, currentCharIndex)
            : bullet;
          
          return (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <span className="text-emerald-400 mt-0.5 shrink-0">&#x2022;</span>
              <span className="text-slate-200 leading-relaxed">
                {isCurrentlyTyping 
                  ? <>{displayText}<span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse" /></>
                  : renderTextWithServices(displayText, serviceNameMap)
                }
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TypingText;
