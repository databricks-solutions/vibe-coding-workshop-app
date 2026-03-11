/**
 * API Client for Vibe Coding Workshop Application
 * Handles all communication with the FastAPI backend
 */

const API_BASE_URL = '/api';

// ============== Type Definitions ==============

export interface SelectOption {
  value: string;
  label: string;
}

export interface GeneratedContent {
  prompt: string;
  input: string;
  input_template?: string;  // Raw input template with variables (for reference)
  how_to_apply?: string;
  expected_output?: string;
  how_to_apply_images?: ImageMetadata[];
  expected_output_images?: ImageMetadata[];
  source?: 'llm_generated' | 'mock_llm' | 'input_only_no_llm' | 'fallback_due_to_error';
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface WorkflowStep {
  id: number;
  icon: string;
  title: string;
  description: string;
  color: string;
  input?: string;
  section_tag: string;
  option_label?: string;
  branch?: string;
}

export interface PrerequisiteLink {
  label: string;
  url: string;
  color: string;
}

export interface PrerequisiteCommand {
  label: string;
  cmd: string;
  os?: string; // 'windows', 'macos', or undefined for all
}

export interface Prerequisite {
  id: number;
  icon: string;
  icon_color: string;
  title: string;
  description: string;
  links: PrerequisiteLink[];
  command?: string;
  commands?: PrerequisiteCommand[];
  is_optional: boolean;
}

export interface AllData {
  industries: SelectOption[];
  use_cases: Record<string, SelectOption[]>;
  prompt_templates: Record<string, Record<string, string>>;
  workflow_steps: WorkflowStep[];
  prerequisites: Prerequisite[];
  disabled_steps?: string[];
}

// ============== Configuration Management Types ==============

export interface PromptConfig {
  config_id?: number;
  industry: string;
  industry_label: string;
  use_case: string;
  use_case_label: string;
  prompt_template: string;
  version: number;
  is_active: boolean;
  inserted_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface ImageMetadata {
  id: string;
  filename: string;
  path: string;
  uploaded_at: string;
  uploaded_by?: string;
}

export interface SectionMetadata {
  how_to_apply: string;
  expected_output: string;
  how_to_apply_images: ImageMetadata[];
  expected_output_images: ImageMetadata[];
}

export interface SectionInput {
  input_id?: number;
  section_tag: string;
  section_title?: string;
  section_description?: string;
  input_template: string;
  system_prompt: string;
  order_number?: number;
  how_to_apply?: string;
  expected_output?: string;
  how_to_apply_images?: ImageMetadata[];
  expected_output_images?: ImageMetadata[];
  bypass_llm: boolean;  // If true, return input_template as-is without LLM processing
  step_enabled: boolean;
  version: number;
  is_active: boolean;
  inserted_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface ConfigVersionInfo {
  version: number;
  inserted_at?: string;
  updated_at?: string;
  created_by?: string;
  is_active: boolean;
}

export interface IndustryCreateRequest {
  industry: string;
  industry_label: string;
}

export interface UseCaseCreateRequest {
  industry: string;
  use_case: string;
  use_case_label: string;
}

export interface PromptConfigCreateRequest {
  industry: string;
  industry_label: string;
  use_case: string;
  use_case_label: string;
  prompt_template: string;
}

export interface SectionInputCreateRequest {
  section_tag: string;
  section_title?: string;
  section_description?: string;
  input_template: string;
  system_prompt: string;
  order_number?: number;
  how_to_apply?: string;
  expected_output?: string;
  bypass_llm?: boolean;  // If true, return input_template as-is without LLM processing
}

export interface SectionTagInfo {
  section_tag: string;
  section_title: string;
}

// ============== Workshop Parameters Types ==============

export interface WorkshopParameter {
  param_id?: number;
  param_key: string;
  param_label: string;
  param_value: string;
  param_description?: string;
  param_type: string;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  allow_session_override: boolean;
}

export interface WorkshopParameterUpdate {
  param_value: string;
}

// ============== Session Parameters Types ==============

export interface SessionParameter {
  param_key: string;
  param_label: string;
  param_value: string;      // Effective value (session override or global default)
  global_value: string;     // Global default value
  is_overridden: boolean;   // Whether this is a session override
  allow_session_override: boolean;  // Whether override is allowed
  param_type: string;
  param_description?: string;
}

export interface SessionParameterUpdate {
  parameters: Record<string, string>;
}

// ============== Lakehouse Params Types (Chapter 3 - Step 10) ==============

export interface LakehouseParams {
  catalog: string;
  schema_name: string;
  is_overridden: boolean;
}

// ============== Session Types ==============

export interface SessionSaveRequest {
  session_id: string;
  industry?: string;
  industry_label?: string;
  use_case?: string;
  use_case_label?: string;
  session_name?: string;
  session_description?: string;
  feedback_rating?: 'thumbs_up' | 'thumbs_down' | null;
  feedback_comment?: string;
  current_step: number;
  workshop_level?: string;
  completed_steps: number[];
  step_prompts: Record<number, string>;
}

export interface SessionSaveResponse {
  success: boolean;
  session_id: string;
  message: string;
  share_url?: string;
}

export interface SessionLoadResponse {
  success: boolean;
  session_id: string;
  industry?: string;
  industry_label?: string;
  use_case?: string;
  use_case_label?: string;
  session_name?: string;
  session_description?: string;
  feedback_rating?: string;
  feedback_comment?: string;
  prerequisites_completed?: boolean;
  current_step: number;
  workshop_level?: string;
  completed_steps: number[];
  skipped_steps?: number[];
  step_prompts: Record<number, string>;
  session_parameters?: Record<string, string>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_saved: boolean;
  message: string;
}

export interface NewSessionResponse {
  session_id: string;
}

export interface FeedbackRequest {
  session_id: string;
  feedback_rating: 'thumbs_up' | 'thumbs_down';
  feedback_comment?: string;
  feedback_request_followup?: boolean;
}

export interface ChapterFeedbackRequest {
  session_id: string;
  chapter_name: string;
  rating: 'up' | 'down';
}

export interface UpdateStepPromptRequest {
  session_id: string;
  step_number: number;
  prompt_text: string;
  workshop_level?: string;
}

export interface UpdateSessionMetadataRequest {
  session_id: string;
  industry?: string;
  industry_label?: string;
  use_case?: string;
  use_case_label?: string;
  prerequisites_completed?: boolean;
  workshop_level?: string;
  completed_steps?: number[];
  skipped_steps?: number[];
  custom_use_case_label?: string;
  custom_use_case_description?: string;
  level_explicitly_selected?: boolean;
  company_brand_url?: string;
}

export interface SessionListItem {
  session_id: string;
  session_name?: string;
  session_description?: string;
  industry?: string;
  industry_label?: string;
  use_case?: string;
  use_case_label?: string;
  current_step: number;
  feedback_rating?: string;
  created_at?: string;
  updated_at?: string;
  is_saved: boolean;
}

// ============== Leaderboard Types ==============

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar: string;
  score: number;
  completed_steps: number[];
  skipped_steps: number[];
  completed_chapters: string[];
  in_progress_chapters: string[];
  updated_at?: string;
  workshop_level?: string;
}

export interface WorkshopUser {
  display_name: string;
  email: string;
  workshop_level?: string;
  workshop_level_label?: string;
  updated_at?: string;
  last_session_id?: string;
  is_saved?: boolean;
}

export interface WorkshopUsersResponse {
  total: number;
  users: WorkshopUser[];
}

// ============== API Client ==============

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /** Get all configuration data in a single request */
  async getAllData(): Promise<AllData> {
    return this.fetch<AllData>('/all-data');
  }

  /** Get list of industries */
  async getIndustries(): Promise<SelectOption[]> {
    return this.fetch<SelectOption[]>('/industries');
  }

  /** Get use cases for a specific industry */
  async getUseCases(industryId: string): Promise<SelectOption[]> {
    return this.fetch<SelectOption[]>(`/use-cases/${industryId}`);
  }

  /** Get the main prompt template for an industry and use case */
  async getPromptTemplate(industryId: string, useCaseId: string): Promise<{ prompt: string }> {
    return this.fetch<{ prompt: string }>(`/prompt-template/${industryId}/${useCaseId}`);
  }

  /** Generate prompt content for a workflow section */
  async generatePrompt(
    industry: string,
    useCase: string,
    sectionTag: string,
    useLlm: boolean = true,
    previousOutputs?: Record<string, string>,
    sessionId?: string | null
  ): Promise<GeneratedContent> {
    return this.fetch<GeneratedContent>('/generate-prompt', {
      method: 'POST',
      body: JSON.stringify({
        industry,
        use_case: useCase,
        section_tag: sectionTag,
        use_llm: useLlm,
        previous_outputs: previousOutputs,
        session_id: sessionId || undefined,  // Use session-specific parameters if provided
      }),
    });
  }

  /** Get section metadata (how_to_apply, expected_output, images) from lightweight cache-backed endpoint */
  async getSectionMetadata(
    sectionTag: string,
    industry: string = '',
    useCase: string = '',
    sessionId?: string | null
  ): Promise<SectionMetadata> {
    const params = new URLSearchParams({ industry, use_case: useCase });
    if (sessionId) params.set('session_id', sessionId);
    return this.fetch<SectionMetadata>(`/section-metadata/${encodeURIComponent(sectionTag)}?${params}`);
  }

  /** Get workflow steps configuration */
  async getWorkflowSteps(): Promise<WorkflowStep[]> {
    return this.fetch<WorkflowStep[]>('/workflow-steps');
  }

  /** Get prerequisites list */
  async getPrerequisites(): Promise<Prerequisite[]> {
    return this.fetch<Prerequisite[]>('/prerequisites');
  }

  /**
   * Generate prompt with streaming (Server-Sent Events)
   * Content arrives in real-time chunks for better UX
   */
  generatePromptStream(
    industry: string,
    useCase: string,
    sectionTag: string,
    onContent: (content: string) => void,
    onComplete: (model?: string) => void,
    onError: (error: string) => void,
    previousOutputs?: Record<string, string>,
    sessionId?: string | null
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/generate-prompt-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            industry,
            use_case: useCase,
            section_tag: sectionTag,
            use_llm: true,
            previous_outputs: previousOutputs,
            session_id: sessionId || undefined,  // Use session-specific parameters if provided
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let model: string | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onComplete(model);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'start' && data.model) {
                  model = data.model;
                } else if (data.type === 'content' && data.content) {
                  onContent(data.content);
                } else if (data.type === 'done') {
                  onComplete(model);
                  return;
                } else if (data.type === 'error') {
                  onError(data.error || 'Unknown error');
                  return;
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message || 'Streaming failed');
        }
      }
    })();

    return controller;
  }

  /**
   * Process an uploaded metadata CSV through the LLM (Server-Sent Events)
   * Generates a coding-assistant-ready prompt from the CSV content
   */
  processMetadataCsvStream(
    csvContent: string,
    industry: string,
    useCase: string,
    sessionId: string | null,
    sectionTag: string = 'bronze_table_metadata_upload',
    onContent: (content: string) => void,
    onComplete: (model?: string) => void,
    onError: (error: string) => void
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/process-metadata-csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csv_content: csvContent,
            session_id: sessionId || undefined,
            industry,
            use_case: useCase,
            section_tag: sectionTag,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let model: string | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onComplete(model);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'start' && data.model) {
                  model = data.model;
                } else if (data.type === 'content' && data.content) {
                  onContent(data.content);
                } else if (data.type === 'done') {
                  onComplete(model);
                  return;
                } else if (data.type === 'error') {
                  onError(data.error || 'Unknown error');
                  return;
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message || 'Streaming failed');
        }
      }
    })();

    return controller;
  }

  /**
   * Test prompt generation with custom values (Server-Sent Events)
   * Used by Configuration page to preview prompt output before saving
   */
  testPromptStream(
    sectionTag: string,
    systemPrompt: string,
    inputTemplate: string,
    bypassLlm: boolean,
    onContent: (content: string) => void,
    onComplete: (model?: string) => void,
    onError: (error: string) => void,
    industry: string = 'sample',
    useCase: string = 'booking_app'
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/test-prompt-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            industry,
            use_case: useCase,
            section_tag: sectionTag,
            system_prompt: systemPrompt,
            input_template: inputTemplate,
            bypass_llm: bypassLlm,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let model: string | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onComplete(model);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'start' && data.model) {
                  model = data.model;
                } else if (data.type === 'content' && data.content) {
                  onContent(data.content);
                } else if (data.type === 'done') {
                  onComplete(model);
                  return;
                } else if (data.type === 'error') {
                  onError(data.error || 'Unknown error');
                  return;
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message || 'Test streaming failed');
        }
      }
    })();

    return controller;
  }

  // ============== Configuration Management API ==============

  /** Get latest prompt configurations */
  async getLatestPromptConfigs(): Promise<PromptConfig[]> {
    return this.fetch<PromptConfig[]>('/config/prompts/latest');
  }

  /** Get versions of a specific prompt configuration */
  async getPromptConfigVersions(industry: string, useCase: string): Promise<ConfigVersionInfo[]> {
    return this.fetch<ConfigVersionInfo[]>(
      `/config/prompts/versions?industry=${encodeURIComponent(industry)}&use_case=${encodeURIComponent(useCase)}`
    );
  }

  /** Get a specific version of a prompt configuration */
  async getPromptConfigByVersion(industry: string, useCase: string, version: number): Promise<PromptConfig> {
    return this.fetch<PromptConfig>(
      `/config/prompts/version/${encodeURIComponent(industry)}/${encodeURIComponent(useCase)}/${version}`
    );
  }

  /** Create a new prompt configuration version */
  async createPromptConfig(request: PromptConfigCreateRequest): Promise<PromptConfig> {
    return this.fetch<PromptConfig>('/config/prompts', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Add a new industry */
  async addIndustry(request: IndustryCreateRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/config/industries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Add a new use case */
  async addUseCase(request: UseCaseCreateRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/config/use-cases', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Toggle active status for a use case */
  async toggleUseCaseActive(industry: string, useCase: string): Promise<{ success: boolean; is_active: boolean; message: string }> {
    return this.fetch(`/config/prompts/${encodeURIComponent(industry)}/${encodeURIComponent(useCase)}/toggle-active`, {
      method: 'PATCH',
    });
  }

  /** Delete a use case */
  async deleteUseCase(industry: string, useCase: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/config/prompts/${encodeURIComponent(industry)}/${encodeURIComponent(useCase)}`, {
      method: 'DELETE',
    });
  }

  /** Delete an industry and all its use cases */
  async deleteIndustry(industry: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/config/industries/${encodeURIComponent(industry)}`, {
      method: 'DELETE',
    });
  }

  /** Get latest section inputs */
  async getLatestSectionInputs(): Promise<SectionInput[]> {
    return this.fetch<SectionInput[]>('/config/section-inputs/latest');
  }

  /** Get versions of a specific section input */
  async getSectionInputVersions(sectionTag: string): Promise<ConfigVersionInfo[]> {
    return this.fetch<ConfigVersionInfo[]>(
      `/config/section-inputs/versions?section_tag=${encodeURIComponent(sectionTag)}`
    );
  }

  /** Get a specific version of a section input */
  async getSectionInputByVersion(sectionTag: string, version: number): Promise<SectionInput> {
    return this.fetch<SectionInput>(
      `/config/section-inputs/version/${encodeURIComponent(sectionTag)}/${version}`
    );
  }

  /** Create a new section input version */
  async createSectionInput(request: SectionInputCreateRequest): Promise<SectionInput> {
    return this.fetch<SectionInput>('/config/section-inputs', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Get all section tags */
  async getSectionTags(): Promise<SectionTagInfo[]> {
    return this.fetch<SectionTagInfo[]>('/config/section-tags');
  }

  /** Delete a section input */
  async deleteSectionInput(sectionTag: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/config/section-inputs/${encodeURIComponent(sectionTag)}`, {
      method: 'DELETE',
    });
  }

  // ============== Step Visibility API ==============

  /** Get list of disabled step section_tags */
  async getDisabledSteps(): Promise<string[]> {
    return this.fetch<string[]>('/config/disabled-steps');
  }

  /** Toggle a step's visibility (enable/disable) */
  async toggleStepVisibility(sectionTag: string, enabled: boolean): Promise<{ success: boolean; section_tag: string; step_enabled: boolean }> {
    return this.fetch(`/config/step-visibility/${encodeURIComponent(sectionTag)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  // ============== Workshop Parameters API ==============

  /** Get all workshop parameters */
  async getWorkshopParameters(): Promise<WorkshopParameter[]> {
    return this.fetch<WorkshopParameter[]>('/config/workshop-parameters');
  }

  /** Get a specific workshop parameter by key */
  async getWorkshopParameter(paramKey: string): Promise<WorkshopParameter> {
    return this.fetch<WorkshopParameter>(`/config/workshop-parameters/${paramKey}`);
  }

  /** Update a workshop parameter value */
  async updateWorkshopParameter(paramKey: string, paramValue: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/config/workshop-parameters/${paramKey}`, {
      method: 'PUT',
      body: JSON.stringify({ param_value: paramValue }),
    });
  }

  /** Get all workshop parameters as a key-value dictionary */
  async getWorkshopParametersDict(): Promise<Record<string, string>> {
    return this.fetch<Record<string, string>>('/config/workshop-parameters-dict');
  }

  /** Delete a workshop parameter */
  async deleteWorkshopParameter(paramKey: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/config/workshop-parameters/${encodeURIComponent(paramKey)}`, {
      method: 'DELETE',
    });
  }

  /** Update whether a parameter can be overridden at session level */
  async updateWorkshopParameterOverride(paramKey: string, allowOverride: boolean): Promise<{ success: boolean }> {
    return this.fetch(`/config/workshop-parameters/${encodeURIComponent(paramKey)}/override`, {
      method: 'PUT',
      body: JSON.stringify({ allow_session_override: allowOverride }),
    });
  }

  // ============== Session Parameters API ==============

  /** Get effective parameters for a session (merged global + overrides) */
  async getSessionParameters(sessionId: string): Promise<SessionParameter[]> {
    return this.fetch<SessionParameter[]>(`/session/${sessionId}/parameters`);
  }

  /** Update session parameter overrides */
  async updateSessionParameters(sessionId: string, parameters: Record<string, string>): Promise<{ success: boolean }> {
    return this.fetch(`/session/${sessionId}/parameters`, {
      method: 'PUT',
      body: JSON.stringify({ parameters }),
    });
  }

  /** Reset a session parameter to global default */
  async resetSessionParameter(sessionId: string, paramKey: string): Promise<{ success: boolean }> {
    return this.fetch(`/session/${sessionId}/parameters/${encodeURIComponent(paramKey)}`, {
      method: 'DELETE',
    });
  }

  // ============== Lakehouse Params API (Chapter 3 - Step 10) ==============

  /** Get effective lakehouse catalog/schema for a session */
  async getLakehouseParams(sessionId: string): Promise<LakehouseParams> {
    return this.fetch<LakehouseParams>(`/session/${sessionId}/lakehouse-params`);
  }

  /** Update lakehouse catalog/schema for a session */
  async updateLakehouseParams(sessionId: string, catalog: string, schemaName: string): Promise<{ success: boolean }> {
    return this.fetch(`/session/${sessionId}/lakehouse-params`, {
      method: 'PUT',
      body: JSON.stringify({ catalog, schema_name: schemaName }),
    });
  }

  /** Reset lakehouse params to global defaults */
  async resetLakehouseParams(sessionId: string): Promise<{ success: boolean }> {
    return this.fetch(`/session/${sessionId}/lakehouse-params`, {
      method: 'DELETE',
    });
  }

  /** Auto-set lakehouse params from Lakebase UC catalog (called when Step 9 completes) */
  async autoSetLakehouseParamsFromLakebase(sessionId: string): Promise<LakehouseParams> {
    return this.fetch<LakehouseParams>(`/session/${sessionId}/lakehouse-params/auto-from-lakebase`, {
      method: 'POST',
    });
  }

  // ============== Session Management API ==============

  /** Get or create the user's default session (continues where they left off) */
  async getDefaultSession(): Promise<SessionLoadResponse> {
    return this.fetch<SessionLoadResponse>('/session/default');
  }

  /** Create a brand new session (starts fresh, overwriting any existing default) */
  async createNewSession(): Promise<NewSessionResponse> {
    return this.fetch<NewSessionResponse>('/session/new');
  }

  /** Save session to database */
  async saveSession(request: SessionSaveRequest): Promise<SessionSaveResponse> {
    return this.fetch<SessionSaveResponse>('/session/save', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Load session by ID */
  async loadSession(sessionId: string): Promise<SessionLoadResponse> {
    return this.fetch<SessionLoadResponse>(`/session/${sessionId}`);
  }

  /** Delete session */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /** Update a specific step's generated prompt */
  async updateStepPrompt(request: UpdateStepPromptRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/session/update-step', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Update session metadata (industry/use case selection) */
  async updateSessionMetadata(request: UpdateSessionMetadataRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/session/update-metadata', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Submit feedback for a session */
  async submitFeedback(request: FeedbackRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/session/feedback', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Submit thumbs up/down feedback for a completed chapter */
  async submitChapterFeedback(request: ChapterFeedbackRequest): Promise<{ success: boolean; message: string }> {
    return this.fetch('/session/chapter-feedback', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /** Get list of user's sessions */
  async getUserSessions(): Promise<SessionListItem[]> {
    return this.fetch<SessionListItem[]>('/session/user/list');
  }

  /** Check Lakebase session status */
  async getSessionLakebaseStatus(): Promise<{ configured: boolean; mode: string }> {
    return this.fetch('/session/status/lakebase');
  }

  /** Get current logged in user */
  async getCurrentUser(): Promise<{ user: string; display_name: string }> {
    return this.fetch('/user/current');
  }

  // ============== Leaderboard API ==============

  /** Get leaderboard with top performers */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.fetch<LeaderboardEntry[]>('/leaderboard?limit=100');
  }

  /** Get all distinct workshop users */
  async getWorkshopUsers(): Promise<WorkshopUsersResponse> {
    return this.fetch<WorkshopUsersResponse>('/workshop-users');
  }

  // ============== Section Image Upload Methods ==============

  /** Upload an image for a section field (how_to_apply or expected_output) */
  async uploadSectionImage(
    file: File,
    sectionTag: string,
    fieldType: 'how_to_apply' | 'expected_output'
  ): Promise<{ success: boolean; image: ImageMetadata; total_images: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('section_tag', sectionTag);
    formData.append('field_type', fieldType);

    const response = await fetch(`${API_BASE_URL}/uploads/section-image`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  /** Delete an image from a section field */
  async deleteSectionImage(
    imageId: string,
    sectionTag: string,
    fieldType: 'how_to_apply' | 'expected_output'
  ): Promise<{ success: boolean; deleted_id: string; remaining_images: number }> {
    const params = new URLSearchParams({
      section_tag: sectionTag,
      field_type: fieldType,
    });

    const response = await fetch(
      `${API_BASE_URL}/uploads/section-image/${imageId}?${params}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
      throw new Error(error.detail || 'Delete failed');
    }

    return response.json();
  }

  /** Get list of images for a section field */
  async getSectionImages(
    sectionTag: string,
    fieldType: 'how_to_apply' | 'expected_output'
  ): Promise<{ section_tag: string; field_type: string; images: ImageMetadata[]; count: number }> {
    return this.fetch(`/uploads/section-images/${sectionTag}/${fieldType}`);
  }

  // ===========================================================================
  // BUILD YOUR USE CASE [BETA]
  // ===========================================================================

  /**
   * Stream use case generation from the LLM (Server-Sent Events).
   * Returns an AbortController to cancel the stream.
   */
  useCaseBuilderStream(
    params: {
      industry?: string;
      use_case_name?: string;
      hints?: string;
      images?: string[];
      text_attachments?: { name: string; content: string }[];
      pdf_attachments?: { name: string; data: string }[];
      current_draft?: string;
      refinement_feedback?: string;
      mode: 'generate' | 'refine';
    },
    onContent: (content: string) => void,
    onComplete: (model?: string) => void,
    onError: (error: string) => void,
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/usecase-builder/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let model: string | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onComplete(model);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'start' && data.model) {
                  model = data.model;
                } else if (data.type === 'content' && data.content) {
                  onContent(data.content);
                } else if (data.type === 'done') {
                  onComplete(model);
                  return;
                } else if (data.type === 'error') {
                  onError(data.error || 'Unknown error');
                  return;
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message || 'Streaming failed');
        }
      }
    })();

    return controller;
  }

  /** Save a use case description to the community library */
  async saveUseCase(data: {
    industry: string;
    use_case_name: string;
    description: string;
  }): Promise<{ success: boolean; id: number; message: string }> {
    const response = await fetch(`${this.baseUrl}/usecase-builder/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Save failed' }));
      throw new Error(err.detail || 'Save failed');
    }
    return response.json();
  }

  /** Get all saved use cases (public community library) */
  async listSavedUseCases(): Promise<{ use_cases: SavedUseCase[] }> {
    return this.fetch('/usecase-builder/list');
  }

  /** Update a saved use case (collaborative -- any user can edit) */
  async updateSavedUseCase(
    id: number,
    data: { industry?: string; use_case_name?: string; description?: string }
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/usecase-builder/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Update failed' }));
      throw new Error(err.detail || 'Update failed');
    }
    return response.json();
  }

  /** Soft-delete a saved use case */
  async deleteSavedUseCase(id: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/usecase-builder/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Delete failed' }));
      throw new Error(err.detail || 'Delete failed');
    }
    return response.json();
  }
}

// ===========================================================================
// TYPE DEFINITIONS: Build Your Use Case [Beta]
// ===========================================================================

export interface SavedUseCase {
  id: number;
  created_by: string;
  display_name: string;
  updated_by: string;
  industry: string;
  use_case_name: string;
  description: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom configurations
export { ApiClient };
