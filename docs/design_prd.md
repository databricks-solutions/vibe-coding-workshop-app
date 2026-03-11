# V2V: Vibe-to-Value — Product Requirements Document

## Overview

The Vibe Coding Workshop App is an AI-powered interactive development workflow that guides users through building data applications on Databricks. It generates customized, actionable prompts for each step of the development process, leveraging LLMs to create industry-specific guidance that can be used directly with AI coding assistants like Cursor, GitHub Copilot, or Claude Code.

## Problem Statement

Developers and data engineers building applications on Databricks face several challenges:

1. **Learning Curve**: Understanding the full Databricks ecosystem (Apps, Unity Catalog, Model Serving, Asset Bundles, Lakebase) takes significant time
2. **Best Practices**: Knowing the recommended patterns for medallion architecture, data pipelines, and AI agents requires experience
3. **Context Switching**: Moving between different tools and documentation disrupts the development flow
4. **Prompt Engineering**: Crafting effective prompts for AI coding assistants is a skill that takes practice
5. **Industry Specificity**: Generic tutorials don't address domain-specific requirements

## User Story

> As a **Developer or Data Engineer**, I want to select my industry and use case, then receive step-by-step AI-generated prompts that guide me through building a complete data application on Databricks — so I can learn best practices while building production-ready solutions faster.

## Target Users

| User Type | Use Case |
|-----------|----------|
| **Data Engineers** | Building medallion architecture pipelines and data products |
| **Full-Stack Developers** | Creating Databricks Apps with UI and backend |
| **Solutions Architects** | Demonstrating Databricks capabilities to clients |
| **Workshop Facilitators** | Running hands-on training sessions |
| **AI/ML Engineers** | Building agents and connecting to model serving endpoints |

## Core Features

### 1. Industry & Use Case Selection

Users select an industry vertical and specific use case. The app customizes all generated prompts to that domain context.

### 2. Guided Workshop Workflow

The application guides users through a comprehensive development lifecycle organized into sections:

| Section | Focus |
|---------|-------|
| **Foundation** | Define intent, set up project, generate PRD |
| **Databricks App** | Design UI and deploy to Databricks Apps |
| **Lakebase** | Set up PostgreSQL database, connect to app, deploy |
| **Lakehouse** | Bronze/Silver/Gold medallion architecture, data pipelines |
| **Data Intelligence** | Genie Spaces, AI agents, AI/BI dashboards |
| **Refinement** | Redeploy, test, iterate, and enhance |
| **Agent Skills** | Build custom agent skills guided by use case |

Each section contains multiple steps with AI-generated prompts tailored to the user's selected industry and use case.

### 3. AI-Powered Prompt Generation

For each step:
- **Input Template**: Pre-configured context with placeholders
- **System Prompt**: LLM instructions for generating high-quality output
- **Streaming Response**: Real-time display of generated prompt
- **Markdown Rendering**: Formatted output with code blocks, lists, headers
- **Copy-Ready**: One-click copy to clipboard for use with AI assistants

### 4. Application Guidance

Each prompt includes:
- **How to Apply**: Step-by-step instructions for using the generated prompt
- **Expected Output**: Description of what to expect after applying the prompt
- **Reference Links**: Links to relevant Databricks documentation

### 5. Configuration Management (Admin)

Administrators can edit use case descriptions, prompt templates, section input prompts, and system messages via the `/config` route.

### 6. Leaderboard & Progress Tracking

Workshop participants can track their progress through the workflow, see completion status, and compare progress on the leaderboard.

## Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| API response (non-streaming) | < 200ms |
| First token latency (streaming) | < 500ms |
| Full prompt generation | < 30 seconds |
| Frontend build size | < 500KB gzipped |

### Usability

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Progress Indication**: Visual workflow diagram shows current step
- **Streaming Feedback**: Users see text appearing in real-time
- **One-Click Copy**: All generated content easily copyable
- **Dark/Light Mode**: Professional appearance in both themes

### Reliability

- **YAML Fallback**: If database unavailable, uses local YAML config
- **Graceful Degradation**: LLM failures show clear error messages
- **Session Persistence**: Configuration survives app restarts

### Security

- **OAuth Authentication**: Uses Databricks OAuth for API access
- **No Sensitive Data**: Prompts contain no credentials or secrets
- **Input Validation**: All user input sanitized

## Success Metrics

| Metric | Target |
|--------|--------|
| **Workshop Completion Rate** | > 80% of participants complete the workflow |
| **Prompt Quality Score** | > 4.5/5 user rating on generated prompts |
| **Time to First App** | < 2 hours for workshop participants |
| **System Uptime** | > 99.5% availability |
