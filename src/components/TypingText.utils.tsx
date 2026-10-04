import type { ReactNode } from 'react';
import { ServicePopover } from './ServicePopover';
import { serviceData, type ServiceKey } from './ServicePopover.utils';

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
): ReactNode {
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
