/**
 * ServicePopover - Shared Databricks service popover with chat functionality
 * 
 * Used across:
 * - Architecture Overview diagram (click on services)
 * - Workshop Path stage strip & chips
 * - Chapter Completion modal (clickable service names in learning content)
 * 
 * Includes:
 * - ServicePopover: Click-to-open popover with "what it is", "use it when", benefits/watch-outs toggle + embedded chat
 * - ServiceChat: Embedded quick-question chat in popovers
 * - ServiceChatModal: Full-screen chat modal
 * - serviceData (ServicePopover.utils.ts): Databricks service definitions (25 services)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Send,
  Loader2,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ReactMarkdown from 'react-markdown';
import { serviceData, type ServiceInfo, type ServiceKey, type ServiceQuickQuestion } from './ServicePopover.utils';

export type { ServiceInfo, ServiceKey, ServiceQuickQuestion } from './ServicePopover.utils';

// =============================================================================
// TYPES
// =============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// =============================================================================
// SHARED QUICK QUESTIONS (Fallback when a service doesn't define custom ones)
// =============================================================================

const DEFAULT_QUICK_QUESTIONS: ServiceQuickQuestion[] = [
  { 
    label: '⚠️ What are the considerations?', 
    question: 'What are the key considerations, limitations, and potential challenges when using this service?' 
  },
  { 
    label: '🚀 How do I get started?', 
    question: 'How do I get started with this service? Give me a quick start guide with step-by-step instructions.' 
  },
];

// =============================================================================
// MARKDOWN COMPONENTS (shared across chat components)
// =============================================================================

const markdownComponents = {
  p: ({children}: {children?: React.ReactNode}) => <p className="my-2">{children}</p>,
  ul: ({children}: {children?: React.ReactNode}) => <ul className="my-2 space-y-1">{children}</ul>,
  ol: ({children}: {children?: React.ReactNode}) => <ol className="my-2 space-y-1 list-decimal list-inside">{children}</ol>,
  li: ({children}: {children?: React.ReactNode}) => <li className="flex items-start gap-2"><span className="text-primary shrink-0 mt-0.5">•</span><span className="flex-1">{children}</span></li>,
  strong: ({children}: {children?: React.ReactNode}) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({children}: {children?: React.ReactNode}) => <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">{children}</code>,
  pre: ({children}: {children?: React.ReactNode}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
  a: ({href, children}: {href?: string; children?: React.ReactNode}) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};

const markdownComponentsSmall = {
  p: ({children}: {children?: React.ReactNode}) => <p className="my-1">{children}</p>,
  ul: ({children}: {children?: React.ReactNode}) => <ul className="my-1 space-y-0.5">{children}</ul>,
  ol: ({children}: {children?: React.ReactNode}) => <ol className="my-1 space-y-0.5 list-decimal list-inside">{children}</ol>,
  li: ({children}: {children?: React.ReactNode}) => <li className="flex items-start gap-1"><span className="text-primary shrink-0">•</span><span>{children}</span></li>,
  strong: ({children}: {children?: React.ReactNode}) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({children}: {children?: React.ReactNode}) => <code className="bg-secondary px-1 rounded text-ui-3xs">{children}</code>,
};

/** Renders `code` and **bold** spans in short strings so markdown markers never show literally. */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={idx} className="bg-secondary px-1 py-px rounded text-[0.9em] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

// =============================================================================
// HELPER: Build system prompt for service chat
// =============================================================================

function buildSystemPrompt(
  service: ServiceInfo,
  conversationHistory: string,
  wordLimit: string
) {
  const benefitsList = service.benefits.map(b => `  - ${b.title}: ${b.detail}`).join('\n');
  const limitationsList = service.limitations.map(l => `  - ${l.title}: ${l.detail}`).join('\n');

  return `You are a Databricks expert assistant. Your knowledge is strictly grounded in official 2026 Databricks products, services, and documentation.

SERVICE CONTEXT:
- Service: ${service.name}${service.badge ? ` (${service.badge})` : ''}
- In plain words: ${service.summary}
- Use it when: ${service.useWhen}
- Technical description: ${service.description}
- Official Documentation: ${service.docUrl}
- Key Benefits & Capabilities:
${benefitsList}
- Considerations & Limitations:
${limitationsList}

${conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CRITICAL FORMATTING RULES - USE MARKDOWN LISTS:
Your response MUST use proper markdown bullet list syntax for easy reading.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**Key Points:**

- First point with **bold** for important terms
- Second point - keep each bullet concise
- Third point with more details

**Best Practices:**

- More details here
- Use \`code\` for technical terms, SQL, or YAML keys

STRICT RULES:
1. Use markdown dash lists (- item) for ALL bullet points
2. Put each bullet on its OWN LINE with a blank line before the list
3. Use **bold** for key terms and concepts
4. Keep each bullet to 1-2 lines max
5. Be concise - ${wordLimit} words total
6. Only answer about ${service.name} and how it integrates with Databricks

NEVER use • symbol. ALWAYS use - for bullets. Each - must start on a new line.`;
}

// =============================================================================
// HELPER: Stream LLM response
// =============================================================================

async function streamServiceChat(
  question: string,
  serviceName: string,
  systemPrompt: string,
  onChunk: (fullText: string) => void
): Promise<string> {
  const response = await fetch('/api/test-prompt-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'databricks',
      use_case: 'service_chat',
      section_tag: 'architecture_service',
      system_prompt: systemPrompt,
      input_template: `Question about ${serviceName}: ${question}`,
      bypass_llm: false
    })
  });

  if (!response.ok) throw new Error('Failed to get response');

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'retry') {
              continue;
            }
            if (parsed.type === 'error') {
              throw new Error(parsed.error || 'Generation failed');
            }
            if (parsed.content) {
              fullText += parsed.content;
              onChunk(fullText);
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes('Generation failed')) throw e;
            if (data && data !== '[DONE]') {
              fullText += data;
              onChunk(fullText);
            }
          }
        }
      }
    }
  }

  return fullText;
}

// =============================================================================
// SERVICE CHAT MODAL - Full-screen chat experience
// =============================================================================

interface ServiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceInfo;
  initialMessages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
}

function ServiceChatModal({ 
  isOpen, 
  onClose, 
  service,
  initialMessages,
  onMessagesUpdate
}: ServiceChatModalProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEscapeKey(isOpen, onClose);

  const quickQuestions = service.quickQuestions?.length ? service.quickQuestions : DEFAULT_QUICK_QUESTIONS;

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || isLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', content: q };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingContent('');
    setQuestion('');
    
    const conversationHistory = newMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const systemPrompt = buildSystemPrompt(service, conversationHistory, '150-300');

    try {
      const fullText = await streamServiceChat(q, service.name, systemPrompt, setStreamingContent);
      const assistantMessage: ChatMessage = { role: 'assistant', content: fullText };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      onMessagesUpdate(updatedMessages);
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = { role: 'assistant', content: 'Sorry, I couldn\'t process your question. Please try again.' };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      onMessagesUpdate(updatedMessages);
      setStreamingContent('');
    } finally {
      setIsLoading(false);
    }
  }, [service, isLoading, messages, onMessagesUpdate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-service-chat-modal
    >
      <div 
        className="w-full max-w-2xl h-[80vh] bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        data-service-chat-modal-content
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-primary px-5 py-4 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>Ask about {service.name}</span>
              </h3>
              {service.badge && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/25">
                  {service.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-white/85 mt-1 line-clamp-2"><InlineText text={service.summary} /></p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Sticky Documentation Link */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-secondary/70 backdrop-blur-sm border-b border-border flex items-center justify-between">
          <span className="text-ui-xs text-muted-foreground">{service.docLabel}</span>
          <a
            href={service.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Official Docs</span>
          </a>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/40">
          {messages.length === 0 && !streamingContent && !isLoading && (
            <div className="py-6">
              <div className="text-center mb-6">
                <HelpCircle className="w-10 h-10 text-primary/70 mx-auto mb-3" />
                <p className="text-foreground text-sm font-medium">Ask any question about {service.name}</p>
                <p className="text-muted-foreground text-xs mt-1">Grounded in 2026 Databricks documentation and workshop patterns</p>
              </div>
              
              <div className="max-w-md mx-auto">
                <p className="text-ui-xs text-muted-foreground uppercase tracking-wide mb-3 text-center">Suggested Questions</p>
                <div className="space-y-2">
                  {quickQuestions.map((qq, idx) => (
                    <button
                      key={idx}
                      onClick={() => askQuestion(qq.question)}
                      className="w-full text-left px-4 py-3 text-sm bg-card hover:bg-secondary/60 text-foreground rounded-xl transition-all border border-border hover:border-primary/50 flex items-center gap-3 group"
                    >
                      <span className="text-lg">{qq.label.split(' ')[0]}</span>
                      <span className="flex-1">{qq.label.split(' ').slice(1).join(' ')}</span>
                      <Send className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
                <p className="text-center text-ui-xs text-muted-foreground mt-4">
                  Or type your own question below
                </p>
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-card border border-border'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <div className="text-sm text-foreground leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-card border border-border">
                <div className="text-sm text-foreground leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>
                    {streamingContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-card">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask a question about ${service.name}...`}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-sm bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="p-3 bg-primary hover:opacity-90 disabled:bg-secondary disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-primary-foreground" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================================================
// SERVICE CHAT - Embedded chat for popovers
// =============================================================================

interface ServiceChatProps {
  service: ServiceInfo;
}

function ServiceChat({ service }: ServiceChatProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [hasAsked, setHasAsked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickQuestions = service.quickQuestions?.length ? service.quickQuestions : DEFAULT_QUICK_QUESTIONS;

  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || isLoading) return;
    
    setIsLoading(true);
    setResponse('');
    setHasAsked(true);
    setCurrentQuestion(q);
    
    const systemPrompt = buildSystemPrompt(service, '', '100-150');

    try {
      const fullText = await streamServiceChat(
        q + '\n\nUse markdown dash lists (- item) on separate lines.',
        service.name,
        systemPrompt,
        setResponse
      );
      setChatMessages([
        { role: 'user', content: q },
        { role: 'assistant', content: fullText }
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setResponse('Sorry, I couldn\'t process your question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [service, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
    setQuestion('');
  };

  const handleQuickQuestion = (q: string) => {
    setQuestion('');
    askQuestion(q);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleMessagesUpdate = (messages: ChatMessage[]) => {
    setChatMessages(messages);
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
    if (lastAssistant) {
      setResponse(lastAssistant.content);
    }
  };

  return (
    <>
      <div className="border-t border-border">
        {/* Chat Header */}
        <div className="px-3.5 py-2 bg-secondary/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-ui-2xs font-medium text-foreground truncate">Ask about {service.name}</span>
          </div>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2 py-0.5 text-ui-3xs bg-primary text-primary-foreground hover:opacity-90 rounded transition-colors font-medium shrink-0"
            title="Open full chat window"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {hasAsked ? 'Expand' : 'Full Chat'}
          </button>
        </div>

        {/* Quick Questions */}
        {!hasAsked && !isLoading && (
          <div className="px-3.5 py-2 space-y-1.5">
            {quickQuestions.map((qq, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestion(qq.question)}
                className="w-full text-left px-2.5 py-1.5 text-ui-2xs bg-secondary/70 hover:bg-secondary text-foreground rounded-lg transition-colors flex items-center gap-2 border border-border hover:border-primary/40"
              >
                <span className="truncate">{qq.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Response Area */}
        {(hasAsked || isLoading) && (
          <div 
            ref={responseRef}
            className="px-3.5 py-2 max-h-32 overflow-y-auto bg-background/60 relative"
          >
            {isLoading && !response && (
              <div className="flex items-center gap-2 text-ui-2xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            {response && (
              <>
                <div className="text-ui-3xs text-primary mb-1.5 italic truncate">Q: {currentQuestion}</div>
                <div className="text-ui-2xs text-foreground/90 leading-relaxed whitespace-pre-line
                  [&_strong]:text-foreground [&_strong]:font-semibold
                  [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_code]:text-ui-3xs">
                  <ReactMarkdown components={markdownComponentsSmall}>
                    {response}
                  </ReactMarkdown>
                </div>
                <div className=" sticky bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover/90 to-transparent pointer-events-none" />
              </>
            )}
          </div>
        )}

        {/* Input Form or Expand Prompt */}
        {hasAsked && response && !isLoading ? (
          <div className="px-3.5 py-2 bg-secondary/30 flex items-center justify-center">
            <button
              onClick={handleExpand}
              className="flex items-center gap-2 px-3 py-1.5 text-ui-2xs bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-colors font-medium"
            >
              <MessageCircle className="w-3 h-3" />
              Open full chat for follow-up questions
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-3.5 py-2 bg-secondary/30">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Or type your own question..."
                disabled={isLoading}
                className="flex-1 px-2.5 py-1.5 text-ui-2xs bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                disabled={!question.trim() || isLoading}
                className="p-1.5 bg-primary text-primary-foreground hover:opacity-90 disabled:bg-secondary disabled:cursor-not-allowed rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <ServiceChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        service={service}
        initialMessages={chatMessages}
        onMessagesUpdate={handleMessagesUpdate}
      />
    </>
  );
}

// =============================================================================
// SERVICE POPOVER - Hover/click popover with service info + chat
// =============================================================================

export interface ServicePopoverProps {
  children: React.ReactNode;
  serviceKey: ServiceKey;
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** When true, uses block-level display and applies the interactive border-beam glow + corner badge */
  block?: boolean;
  /** When true (with block), renders a compact corner indicator for tight chips instead of a full badge */
  hideBadge?: boolean;
}

export function ServicePopover({ 
  children, 
  serviceKey,
  position = 'top',
  block = false,
  hideBadge = false
}: ServicePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'benefits' | 'considerations'>('benefits');
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const service = serviceData[serviceKey];
  const POPOVER_WIDTH = 360;
  const POPOVER_HEIGHT = 690;
  const OFFSET = 12;
  const TRANSITION_MS = 200;
  
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = 0;
      let left = 0;
      
      switch (position) {
        case 'top':
          top = triggerRect.top - POPOVER_HEIGHT - OFFSET;
          left = triggerRect.left + (triggerRect.width / 2) - (POPOVER_WIDTH / 2);
          if (top < 10) top = triggerRect.bottom + OFFSET;
          break;
        case 'bottom':
          top = triggerRect.bottom + OFFSET;
          left = triggerRect.left + (triggerRect.width / 2) - (POPOVER_WIDTH / 2);
          if (top + POPOVER_HEIGHT > viewportHeight - 10) top = triggerRect.top - POPOVER_HEIGHT - OFFSET;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (POPOVER_HEIGHT / 2);
          left = triggerRect.left - POPOVER_WIDTH - OFFSET;
          if (left < 10) left = triggerRect.right + OFFSET;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (POPOVER_HEIGHT / 2);
          left = triggerRect.right + OFFSET;
          if (left + POPOVER_WIDTH > viewportWidth - 10) left = triggerRect.left - POPOVER_WIDTH - OFFSET;
          break;
      }
      
      if (left < 10) left = 10;
      if (left + POPOVER_WIDTH > viewportWidth - 10) left = viewportWidth - POPOVER_WIDTH - 10;
      if (top < 10) top = 10;
      if (top + POPOVER_HEIGHT > viewportHeight - 10) top = viewportHeight - POPOVER_HEIGHT - 10;
      
      // eslint-disable-next-line react-hooks/set-state-in-effect -- position comes from measuring the trigger's DOM rect after it renders
      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${POPOVER_WIDTH}px`,
        zIndex: 9999
      });
    }
  }, [isOpen, position]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setShouldRender(true);
      setActiveTab('benefits');
    } else {
      setIsVisible(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      exitTimeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, TRANSITION_MS);
    }
  }, [isOpen]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The full-chat modal handles its own Escape; leave the popover open beneath it.
      if (document.querySelector('[data-service-chat-modal]')) return;
      setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const isInsidePopover = target.closest('[data-popover]');
        const isInsideTrigger = triggerRef.current?.contains(target);
        const isInsideChatModal = target.closest('[data-service-chat-modal]') || target.closest('[data-service-chat-modal-content]');
        
        if (!isInsidePopover && !isInsideTrigger && !isInsideChatModal) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!service) return <>{children}</>;

  const popoverContent = shouldRender ? createPortal(
    <div 
      data-popover
      style={{ ...popoverStyle, transitionDuration: `${TRANSITION_MS}ms` }}
      className={`transition-all ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-x-hidden overflow-y-auto max-h-[calc(100vh-20px)] ring-1 ring-primary/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-primary px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Info className="w-4 h-4 shrink-0" />
              <span className="truncate">{service.name}</span>
            </h4>
            {service.badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/25 text-white/95 border border-white/25 leading-none shrink-0">
                {service.badge}
              </span>
            )}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); closePopover(); }}
            className="text-white/80 hover:text-white text-lg leading-none shrink-0"
            aria-label="Close popover"
          >
            ×
          </button>
        </div>
        
        {/* What it is / Use it when */}
        <div className="px-4 py-3 border-b border-border bg-card/60 space-y-2.5">
          <div>
            <p className="text-ui-3xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">What it is</p>
            <p className="text-ui-xs text-foreground leading-relaxed">
              <InlineText text={service.summary} />
            </p>
          </div>
          <div className="rounded-lg bg-primary/[0.07] border border-primary/15 px-2.5 py-1.5">
            <p className="text-ui-3xs font-bold uppercase tracking-wider text-primary mb-0.5">Use it when</p>
            <p className="text-ui-xs text-foreground/90 leading-relaxed">
              <InlineText text={service.useWhen} />
            </p>
          </div>
        </div>
        
        {/* Segmented Benefits / Watch-outs Section */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-1 mb-3 p-0.5 rounded-lg bg-secondary/50 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('benefits')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-ui-2xs font-semibold uppercase tracking-wide transition-all ${
                activeTab === 'benefits'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Benefits ({service.benefits.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('considerations')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-ui-2xs font-semibold uppercase tracking-wide transition-all ${
                activeTab === 'considerations'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Watch-outs ({service.limitations.length})</span>
            </button>
          </div>

          <ul className="space-y-2.5">
            {(activeTab === 'benefits' ? service.benefits : service.limitations).map((point) => (
              <li key={point.title} className="flex items-start gap-2.5">
                {activeTab === 'benefits' ? (
                  <CheckCircle2 className="w-4 h-4 mt-px shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-px shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-ui-xs font-semibold text-foreground leading-snug">
                    <InlineText text={point.title} />
                  </p>
                  <p className="text-ui-2xs text-muted-foreground leading-relaxed mt-0.5">
                    <InlineText text={point.detail} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Documentation Link */}
        <div className="px-4 py-2 bg-secondary/40 flex items-center justify-between gap-2">
          <a
            href={service.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-ui-2xs font-semibold text-primary hover:underline transition-colors truncate"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{service.docLabel}</span>
          </a>
          <span className="text-ui-3xs text-muted-foreground flex items-center gap-1 shrink-0">
            <HelpCircle className="w-2.5 h-2.5" />
            Ask AI below
          </span>
        </div>

        {/* AI Chat Section */}
        <ServiceChat service={service} />
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div 
      className={`relative ${block ? `block h-full group/sp service-interactive-tile ${isOpen ? 'is-open' : ''}` : 'inline-block'}`}
      ref={triggerRef}
    >
      <div 
        className={block ? 'cursor-pointer relative z-10 h-full flex flex-col [&>*]:flex-1' : 'cursor-pointer inline-flex items-center gap-0.5'}
        onClick={toggleOpen}
        title={`Click to explore ${service.name}`}
      >
        {children}
        {!block && <Info className="w-3 h-3 text-primary/80 shrink-0" />}
      </div>

      {block && (
        <div className={`absolute ${hideBadge ? 'top-1 right-1' : 'top-1.5 right-1.5'} z-20 pointer-events-none`}>
          <div
            className={`service-info-badge relative flex items-center justify-center rounded-full transition-all duration-200 group-hover/sp:scale-110 ${
              hideBadge ? 'w-4 h-4' : 'w-5 h-5'
            }`}
          >
            <Info className={`relative z-10 ${hideBadge ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} strokeWidth={2.6} />
            <span className="service-info-pulse absolute inset-0 rounded-full" />
          </div>
        </div>
      )}
      
      {popoverContent}
    </div>
  );
}

export default ServicePopover;
