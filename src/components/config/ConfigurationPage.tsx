/**
 * Configuration Page
 * Main container for configuration management with tabbed navigation
 * Updated to match dark theme
 * 
 * URL Routes:
 * - /config or /config/prompts -> Use Case Descriptions tab
 * - /config/section-inputs -> Section Input Prompts tab  
 * - /config/workshop-parameters -> Workshop Parameters tab
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PromptsConfig } from './PromptsConfig';
import { SectionInputsConfig } from './SectionInputsConfig';
import { WorkshopParametersConfig } from './WorkshopParametersConfig';
import { StepVisibilityConfig } from './StepVisibilityConfig';

type TabType = 'prompts' | 'section-inputs' | 'workshop-parameters' | 'step-visibility';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// Map URL params to tab types
const tabParamMap: Record<string, TabType> = {
  'prompts': 'prompts',
  'section-inputs': 'section-inputs',
  'workshop-parameters': 'workshop-parameters',
  'step-visibility': 'step-visibility',
};

export function ConfigurationPage() {
  const { tab } = useParams<{ tab?: string }>();
  
  // Determine active tab from URL param, default to 'prompts'
  const getActiveTab = (): TabType => {
    if (tab && tabParamMap[tab]) {
      return tabParamMap[tab];
    }
    return 'prompts';
  };
  
  const [activeTab, setActiveTab] = useState<TabType>(getActiveTab());
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [tab]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  function showToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground mb-1">Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Manage use case descriptions and section input prompts with version history
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-card border-b border-border">
        <div className="px-6 flex gap-1">
          <Link
            to="/config/prompts"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'prompts'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Use Case Descriptions
            </span>
          </Link>
          <Link
            to="/config/section-inputs"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'section-inputs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Section Input Prompts
            </span>
          </Link>
          <Link
            to="/config/workshop-parameters"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'workshop-parameters'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Workshop Parameters
            </span>
          </Link>
          <Link
            to="/config/step-visibility"
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'step-visibility'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Step Visibility
            </span>
          </Link>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-background p-6">
        <div className="h-full">
          {activeTab === 'prompts' && <PromptsConfig onToast={showToast} />}
          {activeTab === 'section-inputs' && <SectionInputsConfig onToast={showToast} />}
          {activeTab === 'workshop-parameters' && <WorkshopParametersConfig onToast={showToast} />}
          {activeTab === 'step-visibility' && <StepVisibilityConfig onToast={showToast} />}
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
