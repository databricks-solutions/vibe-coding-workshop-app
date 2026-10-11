-- =============================================================================
-- SEED: Office of the CFO / CMO / COO / CHRO plays (PostgreSQL/Lakebase)
-- =============================================================================
-- Genie-led plays homed in each office (Ask and Explore, Predict and Act),
-- and industry cards cross-listed into each office's Industry Plays column.
-- The offices stay off until an admin enables them. Inserts skip anything
-- that already exists.
-- Safe to re-run on every deploy.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

SELECT setval(pg_get_serial_sequence('${schema}.usecase_descriptions', 'config_id'), COALESCE((SELECT MAX(config_id) FROM ${schema}.usecase_descriptions), 0) + 1, false);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cfo', 'Office of the CFO', 'cfo_genie_space', 'Ask Your P&L', 'Ask and Explore', 1, 1,
'Give finance leaders and business partners a governed Genie space over the P&L, budget and forecast, so they get answers in seconds instead of waiting days for an analyst to build another spreadsheet.

## Application Type
Finance Q&A app that embeds a **Genie space over curated P&L, budget and forecast tables**, with trusted answers for the top questions and an AI/BI dashboard beside the chat for the standard monthly view.

## Key Personas
- **CFO / VP Finance**: Asks ad hoc questions about performance, variance and drivers
- **FP&A Business Partner**: Curates the Genie space, certifies trusted questions and explains results to budget owners

## Core Features Required

### Ask, Trust and Explain (3 Scenarios)

#### 1. Conversational P&L
Ask about revenue, cost and margin in plain English:
- Actuals vs budget vs forecast by month, entity, region and cost center
- Drill from a variance to the accounts and transactions behind it
- Answers shown as a table, chart and the SQL used

#### 2. Trusted Answers
The most common questions always return the approved number:
- Certified SQL for top questions (gross margin, opex, EBITDA)
- Unity Catalog metric views so every KPI has one definition
- Badge on answers that came from a certified query

#### 3. Variance Narratives
Turn a variance into an explanation:
- ai_query() drafts a commentary paragraph for the month''s top variances
- Business partner edits and saves the final commentary

### Finance Q&A Workspace
- Genie chat with suggested questions
- Embedded AI/BI dashboard for the monthly P&L
- Saved commentary by month and cost center

## Ask It in Genie
The heart of this app is the Genie space itself. Typical questions it must answer with trusted SQL:
- *"Why is gross margin down 2 points vs budget this quarter?"*
- *"Which cost centers are more than 10 percent over budget year to date?"*
- *"Show revenue by region for the last 6 months vs forecast"*
- *"What drove the increase in travel expense in March?"*

## Data Entities
Core entities: Entities, Accounts, Cost Centers, GL Balances, Journal Lines, Budgets, Forecasts, Metric Definitions, Commentary

## Technical Considerations
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 3 entities, 20 cost centers, 18 months of GL data and the three scenarios**, using generated synthetic data. We do not need real ERP integration, consolidation logic, intercompany eliminations or user authentication. This will be an **open, public demo** where anyone can ask P&L questions in plain English, drill into a variance and save the commentary.',
1, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cfo' AND use_case = 'cfo_genie_space' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cfo', 'Office of the CFO', 'close_cockpit', 'Financial Close Cockpit', 'Ask and Explore', 1, 2,
'Shorten the month-end close by tracking every task, reconciliation and journal in one cockpit and flagging the accounts most likely to hold errors before they reach the reported numbers.

## Application Type
Close management app that connects the **Controller''s team** with a **Close Analytics Engine** that tracks task status, scores reconciliations for risk and lets anyone ask Genie about close progress.

## Key Personas
- **Controller**: Owns the close calendar and signs off on results
- **Accountant**: Completes close tasks, reconciliations and journals

## Core Features Required

### Track, Reconcile and Certify (3 Scenarios)

#### 1. Close Task Tracker
See the close at a glance:
- Tasks by day, owner and entity with status and dependencies
- Critical path and late tasks highlighted

#### 2. Reconciliation Risk
Find the accounts that need attention:
- Unreconciled balances and aging
- Anomaly score on journals (unusual amounts, timing, preparers)
- Top 10 risky accounts each close

#### 3. Close Performance
Get faster every month:
- Days to close trend and task cycle times
- Recurring late tasks and bottleneck owners

### Close Cockpit
- Calendar and Kanban of close tasks
- Risk-ranked reconciliation list
- Genie panel: "what''s still open for entity UK?"

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which close tasks are late for the EMEA entities?"*
- *"Which accounts have unreconciled balances over $50k?"*
- *"How many days did the close take each month this year?"*

## Data Entities
Core entities: Entities, Close Periods, Close Tasks, Owners, Reconciliations, Accounts, Journals, Anomaly Scores

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 3 entities, one close period with about 150 tasks and the three scenarios**, using generated synthetic data. We do not need real close software or ERP integration, approval workflows, SOX evidence storage or user authentication. This will be an **open, public demo** where anyone can walk through a simulated close day by day, clear risky reconciliations and ask Genie what is still open.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cfo' AND use_case = 'close_cockpit' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cfo', 'Office of the CFO', 'driver_based_forecasting', 'Driver-Based Forecasting', 'Predict and Act', 2, 1,
'Replace spreadsheet roll-forwards with a driver-based forecast that updates from actuals and lets finance test scenarios like a price change, volume drop or hiring freeze in minutes.

## Application Type
Forecasting app that connects **FP&A Analysts** with a **Driver Forecast Engine** using ai_forecast() for baseline drivers and a scenario builder that flows driver changes through to the P&L.

## Key Personas
- **FP&A Analyst**: Maintains drivers, runs the forecast and builds scenarios
- **CFO**: Compares scenarios and picks the outlook to share with the board

## Core Features Required

### Forecast, Simulate and Decide (3 Scenarios)

#### 1. Baseline Driver Forecast
Forecast the drivers, not just the totals:
- ai_forecast() on volume, price, headcount and unit cost
- Confidence ranges and forecast accuracy history

#### 2. Scenario Builder
Test what-if changes:
- Sliders for price, volume, FX and hiring
- Revenue, margin and cash impact side by side
- Save, name and compare scenarios

#### 3. Forecast Narrative
Explain the outlook:
- ai_query() summarizes what changed vs last forecast and why

### Forecast Studio
- Driver tree view
- Scenario comparison table and waterfall
- Genie panel over forecast and scenarios

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"What happens to EBITDA if volume drops 5 percent next quarter?"*
- *"How accurate was last quarter''s revenue forecast?"*
- *"Which drivers changed most since the last forecast?"*

## Data Entities
Core entities: Drivers, Driver Values, Actuals, Forecasts, Scenarios, Scenario Assumptions, P&L Lines, Forecast Accuracy

## Technical Considerations
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one business unit, 8 drivers, 3 years of monthly actuals and the three scenarios**, using generated synthetic data. We do not need real planning tool integration, workforce planning detail, approvals or user authentication. This will be an **open, public demo** where anyone can move a driver slider, watch the P&L and cash update and compare saved scenarios.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cfo' AND use_case = 'driver_based_forecasting' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cfo', 'Office of the CFO', 'spend_working_capital_agent', 'Spend & Working Capital Agent', 'Predict and Act', 2, 2,
'Use an agent to find spend leakage and working-capital opportunities, such as duplicate invoices, off-contract purchases and early payments, and draft the fix for a human to approve.

## Application Type
Spend intelligence app that connects **Procurement and AP Leads** with a **Spend Agent** that scans invoices, POs and contracts, explains each finding with sources and drafts the action for approval.

## Key Personas
- **Procurement / AP Lead**: Reviews findings and approves recovery or policy actions
- **Treasurer**: Tracks DSO, DPO and cash released

## Core Features Required

### Detect, Explain and Act (3 Scenarios)

#### 1. Spend Leakage Detection
Find money already lost:
- Duplicate invoices, off-contract prices and maverick spend
- Each finding linked to the invoice and contract clause via Vector Search

#### 2. Working Capital Opportunities
Release cash:
- Invoices paid earlier than terms
- Customers drifting past payment terms (DSO risk)
- Cash impact of each opportunity

#### 3. Agent-Drafted Actions
Human approves, agent drafts:
- Draft supplier recovery email or payment-term change
- Approve, edit or reject; every action logged

### Spend Agent Console
- Findings queue ranked by cash impact
- Finding detail with evidence and draft action
- Cash released tracker

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"How much did we pay before terms last quarter?"*
- *"Which suppliers have the most off-contract invoices?"*
- *"What is our DSO trend by region?"*

## Data Entities
Core entities: Suppliers, Contracts, Purchase Orders, Invoices, Payments, Customers, Receivables, Findings, Draft Actions

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 30 suppliers, about 2,000 invoices, 10 contracts and the three scenarios**, using generated synthetic data. We do not need real ERP or AP integration, sending real emails, payment execution or user authentication. This will be an **open, public demo** where anyone can let the agent find a duplicate invoice, review the evidence and approve the drafted recovery.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cfo' AND use_case = 'spend_working_capital_agent' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cmo', 'Office of the CMO', 'cmo_genie_space', 'Ask Your Marketing Data', 'Ask and Explore', 1, 1,
'Give marketing leaders a governed Genie space over campaigns, spend, audiences and conversions, so questions about what''s working get answered on the spot instead of in next week''s report.

## Application Type
Marketing Q&A app that embeds a **Genie space over curated campaign, spend and conversion tables**, with trusted answers for the core marketing KPIs and an AI/BI dashboard for the weekly view.

## Key Personas
- **CMO / VP Marketing**: Asks about performance, budget and audiences
- **Marketing Analyst**: Curates the Genie space and certifies the KPI questions

## Core Features Required

### Ask, Trust and Share (3 Scenarios)

#### 1. Conversational Campaign Performance
Ask about spend and results in plain English:
- Spend, impressions, clicks, conversions and revenue by channel and campaign
- Compare periods, regions and audiences
- Answers as table, chart and SQL

#### 2. Trusted Marketing KPIs
One definition for CAC, ROAS and conversion rate:
- Unity Catalog metric views and certified SQL
- Badge on certified answers

#### 3. Weekly Insight Summary
Turn results into a story:
- ai_query() drafts the weekly marketing highlights
- Analyst edits and shares

### Marketing Q&A Workspace
- Genie chat with suggested questions
- Embedded AI/BI dashboard
- Saved weekly summaries

## Ask It in Genie
The heart of this app is the Genie space itself. Typical questions it must answer with trusted SQL:
- *"Which channel had the best ROAS last month?"*
- *"What was our customer acquisition cost by region this quarter?"*
- *"Which campaigns are overspending vs plan?"*
- *"How did conversion rate change after the site redesign?"*

## Data Entities
Core entities: Campaigns, Channels, Ad Spend, Impressions, Clicks, Conversions, Customers, Segments, Metric Definitions

## Technical Considerations
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one brand, 6 channels, 20 campaigns, 12 months of data and the three scenarios**, using generated synthetic data. We do not need real ad platform connectors, identity resolution, attribution vendors or user authentication. This will be an **open, public demo** where anyone can ask marketing questions in plain English and publish an AI-drafted weekly summary.',
1, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cmo' AND use_case = 'cmo_genie_space' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cmo', 'Office of the CMO', 'campaign_cockpit', 'Campaign & Attribution Cockpit', 'Ask and Explore', 1, 2,
'See every campaign''s spend, reach and contribution to revenue in one cockpit, with simple attribution that marketers trust and can explain to finance.

## Application Type
Campaign analytics app that connects **Channel Managers** with an **Attribution Engine** that compares first-touch, last-touch and data-driven views and shows incremental impact from holdouts.

## Key Personas
- **Channel Manager**: Owns a channel budget and optimizes campaigns
- **Marketing Finance Partner**: Validates ROI and budget decisions

## Core Features Required

### Monitor, Attribute and Optimize (3 Scenarios)

#### 1. Campaign Pacing
Track delivery vs plan:
- Spend, reach and conversions vs plan by day
- Alerts for under- and over-pacing

#### 2. Attribution Views
Understand contribution:
- First-touch, last-touch and data-driven attribution side by side
- Journey paths leading to conversion

#### 3. Incrementality
Prove real lift:
- Holdout vs exposed comparison per campaign
- Incremental revenue and cost per incremental conversion

### Campaign Cockpit
- Channel and campaign leaderboard
- Attribution comparison chart
- Genie panel over campaign data

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which campaigns get credit under data-driven attribution but not last-touch?"*
- *"What was the incremental lift of the spring email campaign?"*
- *"Which campaigns are pacing behind plan this week?"*

## Data Entities
Core entities: Campaigns, Channels, Touchpoints, Journeys, Conversions, Attribution Results, Holdouts, Budgets

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one brand, 5 channels, 12 campaigns, 20k synthetic customer journeys and the three scenarios**, using generated synthetic data. We do not need real ad platforms, identity graphs, media buying or user authentication. This will be an **open, public demo** where anyone can compare attribution models for a campaign and check its holdout-based lift.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cmo' AND use_case = 'campaign_cockpit' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cmo', 'Office of the CMO', 'marketing_mix_forecast', 'Marketing Mix & Budget Planner', 'Predict and Act', 2, 1,
'Estimate how each channel drives sales and forecast what a different budget split would deliver, so the CMO can defend the plan with numbers.

## Application Type
Budget planning app that connects **Marketing Planners** with a **Marketing Mix Model** and ai_forecast() to project sales under alternative channel budgets.

## Key Personas
- **Marketing Planner**: Builds the channel budget and runs scenarios
- **CMO**: Chooses the budget plan and presents it to the CFO

## Core Features Required

### Model, Forecast and Allocate (3 Scenarios)

#### 1. Channel Contribution
How much each channel drives sales:
- Simple marketing mix model with diminishing returns per channel
- Contribution and ROI by channel

#### 2. Budget Scenarios
Test a different split:
- Sliders per channel with projected sales and ROI
- Recommended split for a target budget

#### 3. Sales Forecast
Forecast the plan:
- ai_forecast() baseline plus marketing-driven uplift
- Plan vs actual tracking during the quarter

### Budget Planner
- Response curves per channel
- Scenario comparison
- Genie panel over plan and actuals

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which channel has the highest marginal ROI right now?"*
- *"What sales do we expect if we move 10 percent of TV budget to social?"*
- *"How is the quarter tracking against the marketing plan?"*

## Data Entities
Core entities: Channels, Weekly Spend, Weekly Sales, Seasonality, Model Coefficients, Response Curves, Budget Scenarios, Forecasts

## Technical Considerations
- **MLflow** to track, evaluate and version the scoring models
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one brand, 6 channels, 2 years of weekly spend and sales and the three scenarios**, using generated synthetic data. We do not need production-grade Bayesian MMM, external market data, media buying or user authentication. This will be an **open, public demo** where anyone can shift budget between channels and see projected sales and ROI update.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cmo' AND use_case = 'marketing_mix_forecast' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_cmo', 'Office of the CMO', 'campaign_agent', 'Audience-to-Campaign Agent', 'Predict and Act', 2, 2,
'Let marketers describe a goal in plain English and have an agent build the audience, size it, draft the creative brief and messages, and wait for approval before anything launches.

## Application Type
Campaign assistant app that connects **Campaign Managers** with a **Campaign Agent** that queries customer data, proposes an audience, drafts copy within brand guidelines and logs every step for approval.

## Key Personas
- **Campaign Manager**: Describes the goal and approves audience and copy
- **Brand Lead**: Maintains brand guidelines the agent must follow

## Core Features Required

### Brief, Build and Approve (3 Scenarios)

#### 1. Goal to Audience
Describe the goal, get an audience:
- Agent translates "win back lapsed high-value customers" into audience rules
- Audience size, value and overlap with running campaigns

#### 2. Brief and Copy Drafts
Draft on-brand content:
- Creative brief and 3 message variants per channel
- Brand guideline check with cited rules via Vector Search

#### 3. Approval and Launch Log
Human in the loop:
- Approve, edit or reject each step
- Simulated launch and expected response

### Campaign Agent Workspace
- Chat-style brief with step cards
- Audience preview
- Approval log

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"How many lapsed high-value customers do we have by region?"*
- *"Which audiences are already targeted by more than two campaigns?"*
- *"What response rate did similar win-back campaigns get?"*

## Data Entities
Core entities: Customers, Segments, Audiences, Campaigns, Briefs, Message Drafts, Brand Guidelines, Approvals

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one brand, 50k synthetic customers, a short brand guideline document and the three scenarios**, using generated synthetic data. We do not need real marketing automation integration, sending real messages, image generation or user authentication. This will be an **open, public demo** where anyone can type a campaign goal and watch the agent build the audience and drafts for approval.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_cmo' AND use_case = 'campaign_agent' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_coo', 'Office of the COO', 'coo_genie_space', 'Ask Your Operations', 'Ask and Explore', 1, 1,
'Give operations leaders a governed Genie space over throughput, service levels, cost and quality, so they can ask what''s happening across sites and get a trusted answer immediately.

## Application Type
Operations Q&A app that embeds a **Genie space over curated operations tables** (orders, capacity, service levels, quality and cost), with trusted answers for core KPIs and an AI/BI dashboard for the daily view.

## Key Personas
- **COO / VP Operations**: Asks about performance across sites and processes
- **Operations Analyst**: Curates the Genie space and certifies KPI questions

## Core Features Required

### Ask, Trust and Act (3 Scenarios)

#### 1. Conversational Operations
Ask about throughput and service in plain English:
- Volume, cycle time, on-time rate and cost per unit by site and process
- Compare sites, shifts and periods
- Answers as table, chart and SQL

#### 2. Trusted Operations KPIs
One definition for OTIF, utilization and cost per unit:
- Unity Catalog metric views and certified SQL

#### 3. Daily Operations Brief
Start the day with the story:
- ai_query() drafts the morning brief: what slipped, where and why

### Operations Q&A Workspace
- Genie chat with suggested questions
- Embedded AI/BI dashboard
- Morning brief archive

## Ask It in Genie
The heart of this app is the Genie space itself. Typical questions it must answer with trusted SQL:
- *"Which sites missed their on-time target yesterday?"*
- *"What is cost per unit by site this month vs last?"*
- *"Where is utilization above 90 percent next week?"*
- *"What were the top three causes of delays this week?"*

## Data Entities
Core entities: Sites, Processes, Orders, Capacity, Shifts, Service Levels, Quality Events, Costs, Metric Definitions

## Technical Considerations
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 5 sites, 6 months of daily operations data and the three scenarios**, using generated synthetic data. We do not need real MES, ERP or WMS integration, IoT streaming or user authentication. This will be an **open, public demo** where anyone can ask operations questions in plain English and read the AI-drafted morning brief.',
1, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_coo' AND use_case = 'coo_genie_space' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_coo', 'Office of the COO', 'ops_control_tower', 'Operations Control Tower', 'Ask and Explore', 1, 2,
'Watch operations end to end in near real time, see disruptions as they develop and understand the downstream impact on customers, cost and service before it shows up in the monthly numbers.

## Application Type
Control tower app that connects **Operations Managers** with a **Disruption Detection Engine** that monitors flows across sites, flags exceptions and estimates impact.

## Key Personas
- **Operations Manager**: Monitors flows and coordinates responses across sites
- **Site Lead**: Owns resolution of exceptions at one site

## Core Features Required

### Monitor, Detect and Coordinate (3 Scenarios)

#### 1. End-to-End Visibility
One view across sites:
- Flow map of orders through each stage and site
- Backlog, throughput and service level by stage

#### 2. Disruption Detection
Catch problems early:
- Anomaly flags on volume, cycle time and quality
- Impact estimate: customers, orders and revenue affected

#### 3. Coordinated Response
Assign and track:
- Exception assigned to site lead with due time
- Status and resolution notes

### Control Tower
- Live flow map
- Exception list by impact
- Genie panel for follow-up questions

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which orders are at risk because of the delay at site 3?"*
- *"Where is the backlog growing fastest today?"*
- *"How many exceptions were resolved within target this week?"*

## Data Entities
Core entities: Sites, Stages, Orders, Flow Events, Exceptions, Impact Estimates, Assignments, Resolutions

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 4 sites, a simulated day of order flow and the three scenarios**, using generated synthetic data. We do not need real system integration, streaming at scale, mobile apps or user authentication. This will be an **open, public demo** where anyone can play a simulated day, catch a disruption, see its impact and assign it.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_coo' AND use_case = 'ops_control_tower' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_coo', 'Office of the COO', 'demand_capacity_forecast', 'Demand & Capacity Planner', 'Predict and Act', 2, 1,
'Forecast demand and match it against capacity by site and week, so operations can add shifts, move volume or flag shortfalls weeks before they hit service levels.

## Application Type
Capacity planning app that connects **Operations Planners** with ai_forecast() demand forecasts and a **Capacity Gap Engine** that compares demand with labor and equipment capacity.

## Key Personas
- **Operations Planner**: Builds the capacity plan and proposes changes
- **COO**: Approves overtime, shift and volume moves

## Core Features Required

### Forecast, Match and Plan (3 Scenarios)

#### 1. Demand Forecast
Forecast volume by site and week:
- ai_forecast() with seasonality and events
- Forecast accuracy tracking

#### 2. Capacity Gap
Compare demand and capacity:
- Labor and equipment capacity by site and week
- Shortfall and slack heatmap

#### 3. Plan Options
Close the gap:
- Options: overtime, temp labor, move volume to another site
- Cost and service impact per option

### Capacity Planner
- Demand vs capacity heatmap
- Option comparison
- Genie panel over forecast and plan

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which sites are short on capacity in the next 6 weeks?"*
- *"What does it cost to cover the peak with overtime vs temp labor?"*
- *"How accurate was last month''s demand forecast?"*

## Data Entities
Core entities: Sites, Weeks, Demand History, Forecasts, Labor Capacity, Equipment Capacity, Plan Options, Costs

## Technical Considerations
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 5 sites, 2 years of weekly volume and the three scenarios**, using generated synthetic data. We do not need real workforce management integration, optimization solvers, scheduling or user authentication. This will be an **open, public demo** where anyone can spot a capacity shortfall and compare the cost of options to close it.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_coo' AND use_case = 'demand_capacity_forecast' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_coo', 'Office of the COO', 'exception_resolution_agent', 'Exception Resolution Agent', 'Predict and Act', 2, 2,
'Let an agent triage operational exceptions, look up the playbook and history, propose the fix and draft the communications, so teams resolve issues faster and more consistently.

## Application Type
Exception handling app that connects **Operations Teams** with a **Resolution Agent** that classifies each exception, retrieves the matching playbook via Vector Search, proposes actions and waits for approval.

## Key Personas
- **Operations Coordinator**: Works the exception queue and approves agent proposals
- **Process Owner**: Maintains playbooks and reviews resolution quality

## Core Features Required

### Triage, Propose and Resolve (3 Scenarios)

#### 1. Smart Triage
Classify and prioritize:
- Exception type, severity and impact
- Similar past exceptions and how they were solved

#### 2. Playbook-Grounded Proposal
Recommend the fix:
- Playbook steps cited from the document library
- Proposed action with expected outcome

#### 3. Drafted Communications
Keep people informed:
- Draft customer or partner message
- Approve, edit or reject; everything logged

### Resolution Workspace
- Exception queue
- Agent proposal with evidence
- Resolution history

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"What are the most common exception types this month?"*
- *"What is the average time to resolve by exception type?"*
- *"How often are agent proposals accepted without edits?"*

## Data Entities
Core entities: Exceptions, Exception Types, Playbooks, Past Resolutions, Proposals, Messages, Approvals

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one operation, 5 exception types, 10 playbooks, 200 historical exceptions and the three scenarios**, using generated synthetic data. We do not need real ticketing integration, sending real messages, voice or user authentication. This will be an **open, public demo** where anyone can pick an exception and watch the agent triage it, cite the playbook and draft the message.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_coo' AND use_case = 'exception_resolution_agent' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_chro', 'Office of the CHRO', 'chro_genie_space', 'Ask Your People Data', 'Ask and Explore', 1, 1,
'Give HR leaders a governed Genie space over headcount, hiring, attrition and engagement, with privacy controls built in, so people questions get answered without waiting on an HRIS report.

## Application Type
People Q&A app that embeds a **Genie space over curated, privacy-safe workforce tables**, with trusted answers for core HR KPIs, an AI/BI dashboard and Unity Catalog masks on sensitive fields.

## Key Personas
- **CHRO / HR Business Partner**: Asks about headcount, hiring, attrition and engagement
- **People Analyst**: Curates the Genie space and certifies HR KPI questions

## Core Features Required

### Ask, Trust and Protect (3 Scenarios)

#### 1. Conversational Workforce Analytics
Ask about the workforce in plain English:
- Headcount, hires, exits and open roles by org, location and level
- Trends and comparisons
- Answers as table, chart and SQL

#### 2. Trusted HR KPIs
One definition for attrition, time to hire and span of control:
- Unity Catalog metric views and certified SQL

#### 3. Privacy by Design
Protect individuals:
- Row filters by HRBP scope and masks on salary and personal fields
- Minimum group size on aggregate answers

### People Q&A Workspace
- Genie chat with suggested questions
- Embedded AI/BI dashboard
- Persona switcher showing what each role can see

## Ask It in Genie
The heart of this app is the Genie space itself. Typical questions it must answer with trusted SQL:
- *"What is regretted attrition by department this year?"*
- *"How long does it take to fill engineering roles?"*
- *"How has headcount changed by location since January?"*
- *"Which teams have the widest span of control?"*

## Data Entities
Core entities: Employees (synthetic), Org Units, Positions, Hires, Exits, Requisitions, Engagement Scores, Metric Definitions

## Technical Considerations
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, about 2,000 synthetic employees, 2 years of HR events and the three scenarios**, using generated synthetic data. We do not need real HRIS integration, payroll, real employee data or user authentication beyond a persona switcher. This will be an **open, public demo** where anyone can ask people questions in plain English and switch personas to see privacy controls in action.',
1, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_chro' AND use_case = 'chro_genie_space' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_chro', 'Office of the CHRO', 'workforce_cockpit', 'Workforce Health Cockpit', 'Ask and Explore', 1, 2,
'Track the health of the workforce in one cockpit, from hiring velocity and internal moves to engagement and burnout signals, so HR and leaders spot issues by team before they turn into exits.

## Application Type
Workforce analytics app that connects **HR Business Partners** with a **Workforce Health Engine** that combines HR events, engagement surveys and workload signals into team-level health scores.

## Key Personas
- **HR Business Partner**: Supports a set of business leaders and their teams
- **Business Leader**: Reviews their team''s health and agrees actions

## Core Features Required

### Measure, Compare and Act (3 Scenarios)

#### 1. Hiring and Mobility
Is talent flowing?:
- Time to hire, offer acceptance and internal fill rate
- Promotion and transfer rates by org

#### 2. Engagement and Burnout Signals
How are people doing?:
- Survey scores and comments themes via ai_query()
- Overtime and PTO patterns as burnout signals

#### 3. Team Health Score
Where to focus:
- Composite health score per team with drivers
- Suggested actions and owner

### Workforce Cockpit
- Org heatmap of health scores
- Team detail with drivers
- Genie panel for follow-ups

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which teams have falling engagement and rising overtime?"*
- *"What themes come up most in survey comments this quarter?"*
- *"What share of open roles were filled internally?"*

## Data Entities
Core entities: Employees (synthetic), Teams, Requisitions, Moves, Survey Responses, Comment Themes, Time Off, Overtime, Health Scores

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 40 teams, 2,000 synthetic employees and the three scenarios**, using generated synthetic data. We do not need real survey tool or HRIS integration, individual-level performance data or user authentication. This will be an **open, public demo** where anyone can find the team with the weakest health score and see what is driving it.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_chro' AND use_case = 'workforce_cockpit' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_chro', 'Office of the CHRO', 'attrition_forecast', 'Attrition Risk Forecast', 'Predict and Act', 2, 1,
'Forecast attrition by team and role, understand the drivers and estimate the cost, so HR can target retention actions where they matter most.

## Application Type
Retention app that connects **People Analysts** with an **Attrition Model** tracked in MLflow and ai_forecast() for team-level exit projections.

## Key Personas
- **People Analyst**: Builds and explains the attrition model
- **CHRO**: Prioritizes retention budget and programs

## Core Features Required

### Predict, Explain and Retain (3 Scenarios)

#### 1. Attrition Forecast
How many people will we lose?:
- Team- and role-level exit forecast for the next 2 quarters
- Confidence range and accuracy history

#### 2. Risk Drivers
Why people leave:
- Top drivers such as tenure, pay position, manager change and mobility
- Aggregated so no individual is exposed

#### 3. Retention Scenarios
What would help?:
- Impact of programs like pay adjustment or mobility on projected exits
- Cost of attrition vs cost of action

### Retention Planner
- Risk heatmap by team and role
- Driver chart
- Scenario comparison

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which roles have the highest projected attrition next quarter?"*
- *"What is the estimated cost of attrition in engineering this year?"*
- *"How does attrition differ for employees who moved internally?"*

## Data Entities
Core entities: Employees (synthetic), Teams, Roles, Tenure, Pay Bands, Exits, Risk Scores, Forecasts, Retention Programs

## Technical Considerations
- **MLflow** to track, evaluate and version the scoring models
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 2,000 synthetic employees, 3 years of HR history and the three scenarios**, using generated synthetic data. We do not need real employee data, individual-level risk lists, HRIS integration or user authentication. This will be an **open, public demo** where anyone can see which teams are most at risk, what drives it and how a retention program changes the forecast.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_chro' AND use_case = 'attrition_forecast' AND version >= 1);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'office_of_chro', 'Office of the CHRO', 'talent_mobility_agent', 'Internal Mobility Agent', 'Predict and Act', 2, 2,
'Match employees to open roles and growth opportunities using skills, not job titles, with an agent that explains each match and drafts the outreach for the recruiter to approve.

## Application Type
Mobility app that connects **Talent Acquisition Partners** with a **Mobility Agent** that matches skills profiles to open roles using Vector Search, explains the fit and drafts outreach.

## Key Personas
- **Talent Acquisition Partner**: Fills open roles and approves outreach
- **Employee**: Sees suggested roles and skill gaps in a self-service view

## Core Features Required

### Match, Explain and Engage (3 Scenarios)

#### 1. Skills-Based Matching
Find internal candidates:
- Skills extracted from profiles and role descriptions
- Ranked internal matches per open role

#### 2. Explainable Fit
Why this person:
- Matching skills, gaps and suggested learning
- Fairness check across groups

#### 3. Drafted Outreach
Human approves:
- Draft message to employee and manager
- Approve, edit or reject; outcomes tracked

### Mobility Workspace
- Open roles with internal matches
- Match detail with skills comparison
- Employee self-service view

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"How many open roles have a strong internal match?"*
- *"Which skills are most often missing for data roles?"*
- *"What share of internal candidates accepted outreach this quarter?"*

## Data Entities
Core entities: Employees (synthetic), Skills, Skill Profiles, Open Roles, Matches, Learning Items, Outreach Drafts, Outcomes

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one company, 500 synthetic employee profiles, 30 open roles and the three scenarios**, using generated synthetic data. We do not need real HRIS or ATS integration, sending real messages, real employee data or user authentication. This will be an **open, public demo** where anyone can pick an open role, review the agent''s internal matches and approve the outreach.',
1, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'office_of_chro' AND use_case = 'talent_mobility_agent' AND version >= 1);

INSERT INTO ${schema}.usecase_collection_members (collection_id, home_industry, use_case, category, category_order, display_order, added_by) VALUES
('office_of_coo', 'travel', 'autonomous_disruption_response', 'Industry Plays', 3, 1, 'seed'),
('office_of_coo', 'travel', 'predictive_maintenance', 'Industry Plays', 3, 2, 'seed'),
('office_of_coo', 'travel', 'smarter_scheduling', 'Industry Plays', 3, 3, 'seed'),
('office_of_coo', 'travel', 'realtime_operations_view', 'Industry Plays', 3, 4, 'seed'),
('office_of_coo', 'cpg', 'cpg_demand_inventory', 'Industry Plays', 3, 5, 'seed'),
('office_of_coo', 'cpg', 'cpg_supply_chain_risk', 'Industry Plays', 3, 6, 'seed'),
('office_of_coo', 'cpg', 'cpg_supplier_collaboration', 'Industry Plays', 3, 7, 'seed'),
('office_of_coo', 'retail', 'demand_inventory', 'Industry Plays', 3, 8, 'seed'),
('office_of_coo', 'retail', 'supply_chain_risk', 'Industry Plays', 3, 9, 'seed'),
('office_of_coo', 'retail', 'supplier_collaboration', 'Industry Plays', 3, 10, 'seed'),
('office_of_cfo', 'travel', 'dynamic_pricing', 'Industry Plays', 3, 1, 'seed'),
('office_of_cfo', 'travel', 'intelligent_offers_management', 'Industry Plays', 3, 2, 'seed'),
('office_of_cfo', 'travel', 'product_channel_development', 'Industry Plays', 3, 3, 'seed'),
('office_of_cfo', 'travel', 'cross_sell_upsell_optimization', 'Industry Plays', 3, 4, 'seed'),
('office_of_cfo', 'travel', 'personalized_ancillaries_offer', 'Industry Plays', 3, 5, 'seed'),
('office_of_cfo', 'travel', 'custom_loyalty_based_offers', 'Industry Plays', 3, 6, 'seed'),
('office_of_cfo', 'cpg', 'revenue_growth_mgmt', 'Industry Plays', 3, 7, 'seed'),
('office_of_cfo', 'cpg', 'portfolio_innovation', 'Industry Plays', 3, 8, 'seed'),
('office_of_cfo', 'retail', 'commerce_media', 'Industry Plays', 3, 9, 'seed'),
('office_of_cfo', 'retail', 'maximize_roi', 'Industry Plays', 3, 10, 'seed'),
('office_of_cmo', 'travel', 'ai_driven_booking', 'Industry Plays', 3, 1, 'seed'),
('office_of_cmo', 'travel', 'hyper_personalized_marketing', 'Industry Plays', 3, 2, 'seed'),
('office_of_cmo', 'travel', 'agentic_customer_service', 'Industry Plays', 3, 3, 'seed'),
('office_of_cmo', 'travel', 'customer_360_audience_builder', 'Industry Plays', 3, 4, 'seed'),
('office_of_cmo', 'cpg', 'retailer_insights', 'Industry Plays', 3, 5, 'seed'),
('office_of_cmo', 'cpg', 'shopper_insights', 'Industry Plays', 3, 6, 'seed'),
('office_of_cmo', 'cpg', 'brand_insights', 'Industry Plays', 3, 7, 'seed'),
('office_of_cmo', 'retail', 'customer_data_management', 'Industry Plays', 3, 8, 'seed'),
('office_of_cmo', 'retail', 'engage_convert', 'Industry Plays', 3, 9, 'seed'),
('office_of_cmo', 'retail', 'marketing_growth', 'Industry Plays', 3, 10, 'seed'),
('office_of_chro', 'travel', 'airline_crew_workforce', 'Industry Plays', 3, 1, 'seed'),
('office_of_chro', 'cpg', 'cpg_agentic_workforce', 'Industry Plays', 3, 2, 'seed'),
('office_of_chro', 'cpg', 'cpg_employee_360', 'Industry Plays', 3, 3, 'seed'),
('office_of_chro', 'retail', 'agentic_workforce', 'Industry Plays', 3, 4, 'seed'),
('office_of_chro', 'retail', 'employee_360', 'Industry Plays', 3, 5, 'seed')
ON CONFLICT DO NOTHING;

-- Offices ship off; admins switch them on from the Library. An earlier
-- version of this seed turned them on (updated_by = 'seed_v2'), so that
-- state is reverted here. Admin toggles change updated_by and are kept.
UPDATE ${schema}.usecase_collections
SET is_enabled = FALSE, updated_by = 'seed_v3', updated_at = CURRENT_TIMESTAMP
WHERE collection_id IN ('office_of_cfo', 'office_of_cmo', 'office_of_coo', 'office_of_chro') AND updated_by = 'seed_v2';
