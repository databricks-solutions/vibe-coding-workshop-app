/**
 * ServicePopover - Shared Databricks service popover with chat functionality
 * 
 * Used across:
 * - Architecture Overview diagram (click on services)
 * - Chapter Completion modal (clickable service names in learning content)
 * 
 * Includes:
 * - ServicePopover: Click-to-open popover with service info + embedded chat
 * - ServiceChat: Embedded quick-question chat in popovers
 * - ServiceChatModal: Full-screen chat modal
 * - serviceData: Databricks service definitions (12 services)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  CheckCircle2,
  Info,
  Send,
  Loader2,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ReactMarkdown from 'react-markdown';

// =============================================================================
// TYPES
// =============================================================================

export interface ServiceInfo {
  name: string;
  description: string;
  benefits: string[];
  limitations: string[];
  docUrl: string;
  docLabel: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QuickQuestion {
  label: string;
  question: string;
}

// =============================================================================
// SERVICE DATA - All Databricks services
// =============================================================================

export const serviceData: Record<string, ServiceInfo> = {
  databricksApp: {
    name: 'Databricks Apps',
    description: 'Host and deploy custom web applications directly on the Databricks platform. Build full-stack apps with React, Python, or any framework while leveraging Databricks security and governance.',
    benefits: [
      'No separate hosting infrastructure needed',
      'Integrated OAuth and SSO authentication',
      'Direct access to Databricks services and data',
      'Automatic scaling and load balancing',
      'Built-in CI/CD with asset bundles'
    ],
    limitations: [
      'Currently supports specific frameworks and runtimes',
      'Compute resources tied to Databricks pricing',
      'Limited to web application use cases'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/what-is',
    docLabel: 'Databricks Apps Documentation'
  },
  lakebase: {
    name: 'Lakebase (PostgreSQL)',
    description: 'Fully managed PostgreSQL database service built into Databricks. Perfect for transactional workloads, application backends, and operational data that needs ACID compliance.',
    benefits: [
      'Fully managed PostgreSQL - no infrastructure to manage',
      'Automatic backups and point-in-time recovery',
      'Native integration with Lakehouse via mirroring',
      'Standard PostgreSQL compatibility',
      'Unified security with Databricks governance'
    ],
    limitations: [
      'Best suited for transactional workloads, not analytics',
      'Storage limits compared to Delta Lake',
      'PostgreSQL-specific features only'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp',
    docLabel: 'Lakebase Documentation'
  },
  dataIngestion: {
    name: 'Data Ingestion Pipeline',
    description: 'Automated pipelines that sync data from Lakebase (or external sources) into the Lakehouse. Uses change data capture (CDC) to efficiently replicate operational data.',
    benefits: [
      'Automatic CDC-based incremental sync',
      'Near real-time data replication',
      'Schema evolution support',
      'Built-in data quality checks',
      'Declarative pipeline configuration'
    ],
    limitations: [
      'Initial full sync can be resource-intensive',
      'Some complex data types may need transformation',
      'Latency depends on source system'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/oltp',
    docLabel: 'Lakebase Mirroring Documentation'
  },
  bronze: {
    name: 'Bronze Layer',
    description: 'The raw data landing zone in the medallion architecture. Bronze tables store data exactly as received from source systems, preserving the original format for auditability.',
    benefits: [
      'Complete data lineage and auditability',
      'Preserves raw data for reprocessing',
      'Supports schema-on-read flexibility',
      'Enables time travel and versioning',
      'Foundation for data quality checks'
    ],
    limitations: [
      'Data may contain duplicates and errors',
      'Not optimized for direct analytics queries',
      'Requires downstream processing for usability'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  silver: {
    name: 'Silver Layer',
    description: 'Cleaned and conformed data ready for analysis. Silver tables apply data quality rules, deduplication, and standardization while maintaining full lineage back to bronze.',
    benefits: [
      'Clean, deduplicated, validated data',
      'Standardized schemas across sources',
      'Optimized for analytical queries',
      'Data quality metrics and monitoring',
      'Supports both batch and streaming'
    ],
    limitations: [
      'Requires clear business rules for transformation',
      'Processing adds latency to data freshness',
      'Schema changes need careful management'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  gold: {
    name: 'Gold Layer',
    description: 'Business-ready, aggregated data optimized for reporting and analytics. Gold tables contain curated datasets, KPIs, and metrics aligned with business domains.',
    benefits: [
      'Business-aligned, consumption-ready data',
      'Pre-aggregated for fast query performance',
      'Semantic consistency across organization',
      'Direct integration with BI tools',
      'Governed and documented datasets'
    ],
    limitations: [
      'Requires ongoing business alignment',
      'Aggregations may lose granular detail',
      'Multiple gold tables for different use cases'
    ],
    docUrl: 'https://docs.databricks.com/en/lakehouse/medallion.html',
    docLabel: 'Medallion Architecture'
  },
  sdp: {
    name: 'Spark Declarative Pipelines (SDP)',
    description: 'Declarative approach to building reliable data pipelines. Define transformations and quality expectations in SQL or Python, and let Databricks handle orchestration.',
    benefits: [
      'Declarative syntax reduces boilerplate code',
      'Built-in data quality expectations',
      'Automatic dependency management',
      'Enhanced observability and lineage',
      'Supports incremental processing'
    ],
    limitations: [
      'Learning curve for declarative paradigm',
      'Some complex transformations need custom code',
      'Debugging can be different from traditional jobs'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/dlt/',
    docLabel: 'Spark Declarative Pipelines Documentation'
  },
  tvf: {
    name: 'Table Value Functions (TVFs)',
    description: 'Reusable SQL functions that return tables. TVFs encapsulate complex query logic, enable parameterized data access, and provide governed data products.',
    benefits: [
      'Encapsulate complex business logic',
      'Parameterized, reusable queries',
      'Row-level security implementation',
      'Simplified data consumption',
      'Version-controlled like tables'
    ],
    limitations: [
      'SQL knowledge required for creation',
      'Performance depends on underlying queries',
      'Not all BI tools support TVF syntax directly'
    ],
    docUrl: 'https://docs.databricks.com/en/sql/language-manual/sql-ref-syntax-qry-select-tvf.html',
    docLabel: 'SQL Table Functions'
  },
  metricViews: {
    name: 'Metric Views',
    description: 'Standardized business metric definitions that ensure consistent calculations across all analytics. Define metrics once, use everywhere with governed semantic layer.',
    benefits: [
      'Single source of truth for metrics',
      'Consistent calculations organization-wide',
      'Self-service analytics enablement',
      'Automatic aggregation and filtering',
      'Integration with Genie and dashboards'
    ],
    limitations: [
      'Requires upfront metric definition work',
      'Changes affect all downstream consumers',
      'Complex metrics may need custom logic'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/metric-views',
    docLabel: 'Metric Views Documentation'
  },
  genieSpaces: {
    name: 'Genie Spaces',
    description: 'Natural language interface for data exploration. Business users can ask questions in plain English and get instant answers, charts, and insights from governed data.',
    benefits: [
      'Natural language data queries',
      'No SQL knowledge required for users',
      'Governed by underlying data permissions',
      'Integrates with curated gold tables',
      'Conversational follow-up questions'
    ],
    limitations: [
      'Quality depends on data documentation',
      'Complex analytical queries may need refinement',
      'Requires well-structured gold layer'
    ],
    docUrl: 'https://docs.databricks.com/en/genie/index.html',
    docLabel: 'Genie Spaces Documentation'
  },
  aiBIDashboards: {
    name: 'AI/BI Dashboards',
    description: 'Native business intelligence dashboards built into Databricks. Create interactive visualizations, reports, and analytics directly on your Lakehouse data.',
    benefits: [
      'No per-user or per-viewer licensing',
      'Lives as close to actual data as possible',
      'Integrated Genie for conversational analytics',
      'Uses same compute as notebooks and pipelines',
      'Approaching feature parity with PowerBI'
    ],
    limitations: [
      'Newer product, still expanding features',
      'Migration from existing BI tools takes effort',
      'Advanced visualizations still maturing'
    ],
    docUrl: 'https://docs.databricks.com/en/ai-bi/index.html',
    docLabel: 'AI/BI Dashboards Documentation'
  },
  agents: {
    name: 'Databricks Agents',
    description: 'Build and deploy AI agents that can reason, take actions, and interact with your data and applications. Powered by foundation models with enterprise guardrails.',
    benefits: [
      'Pre-built agent frameworks and tools',
      'Integration with Genie and data catalog',
      'Enterprise-grade security and governance',
      'Model serving with automatic scaling',
      'Evaluation and monitoring built-in'
    ],
    limitations: [
      'Requires ML/AI expertise for custom agents',
      'Token costs for foundation models',
      'Complex agent logic needs careful design'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Databricks Agents Documentation'
  },
  agentFramework: {
    name: 'Agent Framework',
    description: 'The Mosaic AI Agent Framework lets you build production-grade agents with the ResponsesAgent or ChatAgent interfaces. Framework-agnostic (LangGraph, LlamaIndex, OpenAI SDK, custom Python) with automatic MLflow signature inference and native compatibility with Playground, Agent Evaluation, and Databricks Apps.',
    benefits: [
      'ResponsesAgent recommended primary interface — auto MLflow signature inference',
      'ChatAgent for streaming + markdown + persistent chat UI',
      'Bring any agent framework (LangGraph, LlamaIndex, OpenAI SDK, custom)',
      'Native Playground / Agent Evaluation / Apps integration',
      'Single agent definition deploys via mlflow.models.log_model + agents.deploy'
    ],
    limitations: [
      'Requires Python and basic ML serving familiarity',
      'Agent reasoning quality depends on the underlying foundation model',
      'Streaming responses require careful client wiring'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-agent',
    docLabel: 'Mosaic AI Agent Framework Documentation'
  },
  toolsMcp: {
    name: 'Tools & MCP',
    description: 'Connect agents to capabilities via Model Context Protocol (MCP). Three server types: Managed (Unity Catalog Functions, Vector Search, Genie Spaces, Databricks SQL), External (OAuth-connected third-party MCP servers), and Custom (proprietary tools hosted as a Databricks App).',
    benefits: [
      'Standardized MCP protocol — agents reuse tools across frameworks',
      'Managed servers handle auth, governance, and lifecycle automatically',
      'Unity Catalog Functions become callable tools with one decorator',
      'Vector Search + Genie Spaces give grounded retrieval and SQL access',
      'Custom servers let you wrap proprietary APIs behind a uniform interface'
    ],
    limitations: [
      'External MCP servers require OAuth and approval flow setup',
      'Custom servers add an extra Databricks App to manage',
      'Token costs scale with tool-call count'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/mcp',
    docLabel: 'MCP on Databricks Documentation'
  },
  lakebaseMemory: {
    name: 'Lakebase Memory',
    description: 'Persist agent conversation state on Lakebase Postgres. Short-term memory uses a LangGraph (or OpenAI Agents SDK) checkpointer keyed by thread_id. Long-term memory extracts key insights into a Lakebase table that the agent queries via Mosaic AI Vector Search.',
    benefits: [
      'Short-term memory survives across requests (LangGraph thread_id checkpoint)',
      'Long-term memory enables personalization across sessions',
      'Reuses the existing Lakebase instance — no extra infra',
      'Same Postgres governance covers both UI data and agent memory',
      'Vector Search over insight extracts gives semantic recall'
    ],
    limitations: [
      'Long-term memory needs a curation/extraction pipeline',
      'Vector Search index updates have minutes-scale latency',
      'Memory growth requires retention policies'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/stateful-agents',
    docLabel: 'Stateful Agents on Lakebase Documentation'
  },
  mlflowPromptRegistry: {
    name: 'Prompt Registry',
    description: 'MLflow 3 Prompt Registry provides git-style versioning for prompts, including aliases (e.g. @production, @staging) for promotion. Pin agents to specific prompt versions and roll back without redeploying code.',
    benefits: [
      'Git-style version history per prompt',
      'Aliases (@production, @staging, etc.) for safe promotion',
      'Diff views across versions',
      'Prompts decoupled from agent code',
      'Native integration with mlflow.genai.evaluate'
    ],
    limitations: [
      'Requires MLflow 3 (mlflow >= 3.3.0)',
      'Aliases are mutable — treat promotion as a deployment event',
      'Prompts are text-only; structured templates need versioning convention'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/evaluate-prompts',
    docLabel: 'MLflow 3 Prompt Registry Documentation'
  },
  mlflowEval: {
    name: 'MLflow Evaluation',
    description: 'Curate evaluation datasets in Unity Catalog, define scorers and LLM-as-judge graders (Correctness, RetrievalGroundedness, Guidelines, Custom, Code-based), then run mlflow.genai.evaluate() across prompt and model variants. Inspect traces and capture human ratings via the Review App.',
    benefits: [
      'Curated UC-table datasets — same dataset across runs for fair comparison',
      'Built-in judges + Guidelines + Custom Python scorers',
      'Side-by-side evaluation runs in the MLflow UI',
      'Review App for human ratings + sign-off',
      'Traces capture every tool call for debugging'
    ],
    limitations: [
      'LLM-judge scoring incurs token costs',
      'Eval datasets need refresh as the use case evolves',
      'Some judges are still in preview'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/judges',
    docLabel: 'MLflow 3 Evaluation Documentation'
  },
  mlflowMonitoring: {
    name: 'Production Monitoring',
    description: 'Enable AI Gateway-enabled inference tables to capture every production request and response, then run MLflow 3 scheduled scorers (scorer.register() / .start()) at a configurable sampling rate (0.0–1.0, max 20 scorers per experiment) to detect quality drift in production.',
    benefits: [
      'AI Gateway-enabled inference tables (legacy tables deprecated 2026-04-30)',
      'Scheduled scorers run continuously without redeploying the agent',
      'Sampling rate keeps cost predictable',
      'Surface drift in an AI/BI dashboard wired to scorer outputs',
      'Ties production traffic back to MLflow experiment runs'
    ],
    limitations: [
      'Max 20 scheduled scorers per MLflow experiment',
      'Scorer cadence has minute-scale floor',
      'AI Gateway must be enabled on the serving endpoint'
    ],
    docUrl: 'https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/run-scorer-in-prod',
    docLabel: 'MLflow 3 Production Monitoring Documentation'
  }
};

export type ServiceKey = keyof typeof serviceData;

// =============================================================================
// SHARED QUICK QUESTIONS
// =============================================================================

const DEFAULT_QUICK_QUESTIONS: QuickQuestion[] = [
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
  li: ({children}: {children?: React.ReactNode}) => <li className="flex items-start gap-2"><span className="text-blue-400 shrink-0 mt-0.5">•</span><span className="flex-1">{children}</span></li>,
  strong: ({children}: {children?: React.ReactNode}) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({children}: {children?: React.ReactNode}) => <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">{children}</code>,
  pre: ({children}: {children?: React.ReactNode}) => <pre className="bg-slate-900 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
  a: ({href, children}: {href?: string; children?: React.ReactNode}) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};

const markdownComponentsSmall = {
  p: ({children}: {children?: React.ReactNode}) => <p className="my-1">{children}</p>,
  ul: ({children}: {children?: React.ReactNode}) => <ul className="my-1 space-y-0.5">{children}</ul>,
  ol: ({children}: {children?: React.ReactNode}) => <ol className="my-1 space-y-0.5 list-decimal list-inside">{children}</ol>,
  li: ({children}: {children?: React.ReactNode}) => <li className="flex items-start gap-1"><span className="text-blue-400 shrink-0">•</span><span>{children}</span></li>,
  strong: ({children}: {children?: React.ReactNode}) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({children}: {children?: React.ReactNode}) => <code className="bg-secondary px-1 rounded text-ui-3xs">{children}</code>,
};

// =============================================================================
// HELPER: Build system prompt for service chat
// =============================================================================

function buildSystemPrompt(serviceName: string, serviceDescription: string, docUrl: string, conversationHistory: string, wordLimit: string) {
  return `You are a Databricks expert assistant. Your knowledge is strictly limited to Databricks products, services, and official documentation.

SERVICE CONTEXT:
- Service: ${serviceName}
- Description: ${serviceDescription}
- Documentation: ${docUrl}

${conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CRITICAL FORMATTING RULES - USE MARKDOWN LISTS:
Your response MUST use proper markdown bullet list syntax for easy reading.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**Key Points:**

- First point with **bold** for important terms
- Second point - keep each bullet concise
- Third point with more details

**Additional Info:**

- More details here
- Use \`code\` for technical terms

STRICT RULES:
1. Use markdown dash lists (- item) for ALL bullet points
2. Put each bullet on its OWN LINE with a blank line before the list
3. Use **bold** for key terms and concepts
4. Keep each bullet to 1-2 lines max
5. Be concise - ${wordLimit} words total
6. Only answer about ${serviceName}

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
              // Silently skip retry events — backend handles backoff
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
  serviceName: string;
  serviceDescription: string;
  docUrl: string;
  initialMessages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
}

function ServiceChatModal({ 
  isOpen, 
  onClose, 
  serviceName, 
  serviceDescription, 
  docUrl,
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
    const systemPrompt = buildSystemPrompt(serviceName, serviceDescription, docUrl, conversationHistory, '150-300');

    try {
      const fullText = await streamServiceChat(q, serviceName, systemPrompt, setStreamingContent);
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
  }, [serviceName, serviceDescription, docUrl, isLoading, messages, onMessagesUpdate]);

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
        className="w-full max-w-2xl h-[80vh] bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        data-service-chat-modal-content
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-primary px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Ask about {serviceName}
            </h3>
            <p className="text-xs text-white/70 mt-0.5">{serviceDescription.slice(0, 80)}...</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            ✕
          </button>
        </div>

        {/* Sticky Documentation Link */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between">
          <span className="text-ui-xs text-slate-400">📚 Official Documentation</span>
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>View Docs</span>
          </a>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingContent && !isLoading && (
            <div className="py-6">
              <div className="text-center mb-6">
                <HelpCircle className="w-10 h-10 text-blue-500/60 mx-auto mb-3" />
                <p className="text-slate-300 text-sm font-medium">Ask any question about {serviceName}</p>
                <p className="text-slate-500 text-xs mt-1">I'll help you understand features, best practices, and more</p>
              </div>
              
              <div className="max-w-md mx-auto">
                <p className="text-ui-xs text-slate-500 uppercase tracking-wide mb-3 text-center">Quick Questions</p>
                <div className="space-y-2">
                  {DEFAULT_QUICK_QUESTIONS.map((qq, idx) => (
                    <button
                      key={idx}
                      onClick={() => askQuestion(qq.question)}
                      className="w-full text-left px-4 py-3 text-sm bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700 hover:border-blue-500/50 flex items-center gap-3 group"
                    >
                      <span className="text-lg">{qq.label.split(' ')[0]}</span>
                      <span>{qq.label.split(' ').slice(1).join(' ')}</span>
                      <Send className="w-4 h-4 ml-auto text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </button>
                  ))}
                </div>
                <p className="text-center text-ui-xs text-slate-600 mt-4">
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
                  : 'bg-slate-800 border border-slate-700'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <div className="text-sm text-slate-200 leading-relaxed">
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
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-slate-800 border border-slate-700">
                <div className="text-sm text-slate-200 leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>
                    {streamingContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-slate-800 border border-slate-700">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 p-4 bg-slate-800/50">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-sm bg-slate-800 border border-slate-600 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
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
  serviceName: string;
  serviceDescription: string;
  docUrl: string;
}

function ServiceChat({ serviceName, serviceDescription, docUrl }: ServiceChatProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [hasAsked, setHasAsked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || isLoading) return;
    
    setIsLoading(true);
    setResponse('');
    setHasAsked(true);
    setCurrentQuestion(q);
    
    const systemPrompt = buildSystemPrompt(serviceName, serviceDescription, docUrl, '', '100-150');

    try {
      const fullText = await streamServiceChat(
        q + '\n\nUse markdown dash lists (- item) on separate lines.',
        serviceName,
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
  }, [serviceName, serviceDescription, docUrl, isLoading]);

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
      <div className="border-t border-slate-700">
        {/* Chat Header */}
        <div className="px-3 py-2 bg-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-3 h-3 text-blue-400" />
            <span className="text-ui-2xs font-medium text-slate-300">Ask about {serviceName}</span>
          </div>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2 py-0.5 text-ui-3xs bg-blue-600/80 hover:bg-blue-500 text-white rounded transition-colors"
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
          <div className="px-3 py-2 space-y-1.5">
            {DEFAULT_QUICK_QUESTIONS.map((qq, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestion(qq.question)}
                className="w-full text-left px-2.5 py-1.5 text-ui-2xs bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-2 border border-slate-600/50"
              >
                {qq.label}
              </button>
            ))}
          </div>
        )}

        {/* Response Area */}
        {(hasAsked || isLoading) && (
          <div 
            ref={responseRef}
            className="px-3 py-2 max-h-28 overflow-y-auto bg-slate-900/50 relative"
          >
            {isLoading && !response && (
              <div className="flex items-center gap-2 text-ui-2xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            {response && (
              <>
                <div className="text-ui-3xs text-blue-400 mb-1.5 italic">Q: {currentQuestion.slice(0, 50)}...</div>
                <div className="text-ui-2xs text-slate-300 leading-relaxed whitespace-pre-line
                  [&_strong]:text-foreground [&_strong]:font-semibold
                  [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_code]:text-ui-3xs">
                  <ReactMarkdown components={markdownComponentsSmall}>
                    {response}
                  </ReactMarkdown>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
              </>
            )}
          </div>
        )}

        {/* Input Form or Expand Prompt */}
        {hasAsked && response && !isLoading ? (
          <div className="px-3 py-2 bg-slate-900/30 flex items-center justify-center">
            <button
              onClick={handleExpand}
              className="flex items-center gap-2 px-3 py-1.5 text-ui-2xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              Open full chat for follow-up questions
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-3 py-2 bg-slate-900/30">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Or type your own question..."
                disabled={isLoading}
                className="flex-1 px-2 py-1.5 text-ui-2xs bg-slate-800 border border-slate-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500 disabled:opacity-50"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                disabled={!question.trim() || isLoading}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                ) : (
                  <Send className="w-3 h-3 text-white" />
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <ServiceChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceName={serviceName}
        serviceDescription={serviceDescription}
        docUrl={docUrl}
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
  /** When true, uses block-level display and hides the Info icon (for architecture diagram boxes) */
  block?: boolean;
}

export function ServicePopover({ 
  children, 
  serviceKey,
  position = 'top',
  block = false
}: ServicePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const service = serviceData[serviceKey];
  const POPOVER_WIDTH = 340;
  const POPOVER_HEIGHT = 480;
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
      
      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${POPOVER_WIDTH}px`,
        zIndex: 9999
      });
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (isOpen) {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
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

  const popoverContent = shouldRender ? createPortal(
    <div 
      data-popover
      style={{ ...popoverStyle, transitionDuration: `${TRANSITION_MS}ms` }}
      className={`transition-all ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-primary px-4 py-2.5 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4" />
            {service.name}
          </h4>
          <button 
            onClick={(e) => { e.stopPropagation(); closePopover(); }}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Description */}
        <div className="px-4 py-2.5 border-b border-slate-700">
          <p className="text-ui-xs text-slate-300 leading-relaxed">
            {service.description}
          </p>
        </div>
        
        {/* Benefits */}
        <div className="px-4 py-2.5 border-b border-slate-700">
          <h5 className="text-ui-2xs font-semibold text-emerald-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Key Benefits
          </h5>
          <ul className="space-y-0.5">
            {service.benefits.slice(0, 4).map((benefit, idx) => (
              <li key={idx} className="text-ui-2xs text-slate-300 flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Documentation Link */}
        <div className="px-4 py-2 bg-slate-800/50 flex items-center justify-between">
          <a
            href={service.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-ui-2xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {service.docLabel}
          </a>
          <span className="text-ui-3xs text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-2.5 h-2.5" />
            Ask a question below
          </span>
        </div>

        {/* AI Chat Section */}
        <ServiceChat 
          serviceName={service.name}
          serviceDescription={service.description}
          docUrl={service.docUrl}
        />
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div 
      className={`relative ${block ? 'block group/sp' : 'inline-block'}`}
      ref={triggerRef}
    >
      <div 
        className={block ? 'cursor-pointer' : 'cursor-pointer inline-flex items-center gap-0.5'}
        onClick={toggleOpen}
        title="Click for details"
      >
        {children}
        {!block && <Info className="w-3 h-3 text-blue-400/60 shrink-0" />}
      </div>

      {block && (
        <div className="absolute -top-1.5 -right-1.5 z-10 pointer-events-none">
          <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/40 backdrop-blur-sm transition-all duration-200 group-hover/sp:bg-blue-500/40 group-hover/sp:border-blue-400/70 group-hover/sp:scale-110">
            <Info className="w-2.5 h-2.5 text-blue-400/80 group-hover/sp:text-blue-300" />
            <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping opacity-0 group-hover/sp:opacity-100" />
          </div>
        </div>
      )}
      
      {popoverContent}
    </div>
  );
}

export default ServicePopover;
