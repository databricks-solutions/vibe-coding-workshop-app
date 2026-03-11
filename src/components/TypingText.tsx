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

import { useState, useEffect, useRef, useCallback } from 'react';
import { serviceData, ServicePopover } from './ServicePopover';
import type { ServiceKey } from './ServicePopover';

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

// Build a map from service display name to service key for text matching
export function buildServiceNameMap(services: ServiceKey[]): Map<string, ServiceKey> {
  const map = new Map<string, ServiceKey>();
  for (const key of services) {
    const service = serviceData[key];
    if (service) {
      map.set(service.name, key);
    }
  }
  return map;
}

// Render text with clickable service name highlights
export function renderTextWithServices(
  text: string,
  serviceNameMap: Map<string, ServiceKey>
): React.ReactNode {
  if (serviceNameMap.size === 0) return text;

  // Build regex from service names (sorted longest first to match greedily)
  const names = Array.from(serviceNameMap.keys()).sort((a, b) => b.length - a.length);
  const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');

  const parts = text.split(regex);
  
  return parts.map((part, idx) => {
    const serviceKey = serviceNameMap.get(part);
    if (serviceKey) {
      return (
        <ServicePopover key={idx} serviceKey={serviceKey} position="right">
          <span className="font-semibold text-blue-400 border-b border-dashed border-blue-400/50 cursor-pointer hover:text-blue-300 hover:border-blue-300/70 transition-colors">
            {part}
          </span>
        </ServicePopover>
      );
    }
    return <span key={idx}>{part}</span>;
  });
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
  const serviceNameMap = useRef(buildServiceNameMap(services));

  // Update service name map when services change
  useEffect(() => {
    serviceNameMap.current = buildServiceNameMap(services);
  }, [services]);

  // Start delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentBulletIndex(0);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [startDelay]);

  // Typing animation using requestAnimationFrame
  const animate = useCallback((timestamp: number) => {
    if (currentBulletIndex < 0 || currentBulletIndex >= bullets.length) return;
    
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
  }, [currentBulletIndex, currentCharIndex, bullets, speed, onComplete]);

  useEffect(() => {
    if (currentBulletIndex >= 0 && !isComplete) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, currentBulletIndex, isComplete]);

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
                  : renderTextWithServices(displayText, serviceNameMap.current)
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
