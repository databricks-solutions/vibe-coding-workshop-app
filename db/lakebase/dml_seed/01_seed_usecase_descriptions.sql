-- =============================================================================
-- SEED DATA: USE CASE DESCRIPTIONS
-- =============================================================================
-- Business-first use case definitions organized by industry
-- Based on Databricks industry solutions framework
-- =============================================================================

-- =============================================================================
-- SAMPLE INDUSTRY
-- =============================================================================

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1, 'sample', 'Sample', 'booking', 'Booking App', 
'Create a simple **consumer marketplace/booking application** similar to Airbnb.

## Application Type
Consumer-facing marketplace that connects **Guests/Customers** with **Hosts/Providers** to discover, search, and book accommodations.

## Key Personas
- **Guest/Customer**: End users who search, compare, book, and pay
- **Host/Provider**: Businesses or individuals who list offerings, manage availability, and fulfill bookings

## Core Features Required

### Discovery & Search (3 Search Types)

The application must support **three distinct search experiences**:

#### 1. Standard Search (Structured Filters)
Traditional filter-based search where users explicitly select:
- Location/destination
- Check-in and check-out dates
- Number of guests
- Price range, amenities, property type
- Results page with ranking, listing cards, map sync, filters, and pagination

#### 2. Natural Language Search (Text-to-Filters)
Free-text search that parses user queries into structured filters:
- Example: *"quiet 2-bedroom near downtown this weekend under $200/night with parking"*
- System translates natural language into filter parameters
- Combines with availability checking
- Returns same structured results as standard search

#### 3. Agent-Based Search (Intent & Context-Aware)
AI-powered search that interprets higher-level user intent:
- Example: *"I want to stay near the concert venue for the Taylor Swift show next month"*
- Agent understands context (event dates, venue location, typical needs)
- Proactively suggests options based on inferred preferences
- Uses additional contextual information to refine and rank results
- Can ask clarifying questions and iterate on search criteria

### Search Results & Details
- Results page with ranking, listing cards, map sync, filters, and pagination
- Detail page with content sections, media galleries, amenities, reviews summary

### Booking & Transactions
- All-in pricing display with taxes, fees, discounts, and coupons
- Booking confirmation and modification workflows

## Data Entities
Core entities: Users, Listings, Units/Rooms, Availability, Pricing, Fees/Taxes, Bookings, Payments, Refunds, Reviews, Wishlists, Messages

## Technical Considerations
- Web-first with mobile considerations
- Map integration for location-based search
- Payment gateway integration (Stripe, etc.)
- AI/LLM integration for natural language and agent-based search

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core search and booking features for **US listings with USD currency**. We do not need user registration, login, user management, host management, property management, or any additional functionality. This will be an **open, public site** where anyone can search for a listing and make a booking.', 
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- RETAIL INDUSTRY
-- =============================================================================

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(3, 'retail', 'Retail', 'customer_data_management', 'Customer Data Management', 
'Unify customer data across *POS, ecommerce, loyalty, mobile, service, and third-party sources* into a governed **Customer 360** that resolves identities and standardizes key attributes.

The goal is to make customer data **trusted, consistent, and usable** across analytics, personalization, and measurement—while supporting *privacy, consent, and access controls*.

With this foundation, teams can reliably power:
- **Segmentation** and audience building
- **Personalization** across channels
- **Marketing activation** and measurement
- **Customer service** experiences

*No more rebuilding datasets for each channel or team.*', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(4, 'retail', 'Retail', 'marketing_growth', 'Drive Marketing Growth', 
'Connect **customer + campaign + conversion data** to understand what''s working, who to target, and where to spend.

This use case focuses on improving *acquisition and retention efficiency* through:
- Better **audience creation** and propensity modeling
- **Journey optimization** across touchpoints
- **Closed-loop measurement** that ties spend to outcomes
- More accurate **attribution and incrementality analysis**

The result? Growth comes from **smarter decisions**, not just more spend. Teams can run *faster experiments* on creative, offers, and channels—and know exactly what''s driving results.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(5, 'retail', 'Retail', 'engage_convert', 'Engage & Convert Customers', 
'Deliver **personalized experiences** that increase conversion and satisfaction across every touchpoint.

Key capabilities include:
- *Recommendations* tailored to browsing and purchase behavior
- *Search relevance* that understands intent
- *Dynamic merchandising* and tailored offers
- *Contextual messaging* across digital and in-store

The emphasis is on using **behavioral and transactional signals** to make the next interaction more relevant, *reducing friction in the funnel*.

This use case pairs **real-time decisioning** with rapid test-and-learn so teams can continuously improve *conversion, basket size, and loyalty engagement*.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(6, 'retail', 'Retail', 'maximize_roi', 'Maximize ROI', 
'Use enterprise data to identify **where cost can be reduced** and **where revenue can be increased** across merchandising, marketing, operations, and finance.

Practically, this includes:
- **Demand forecasting** at multiple horizons
- **Promotional effectiveness** analysis
- **Pricing and assortment** optimization
- **Operational efficiency** improvements

The outcome is *improved profitability* through:
- Reduced waste (*markdowns, overstocks*)
- Better investment decisions
- Measurable operational efficiencies

**Resources get allocated to the highest-return actions.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(7, 'retail', 'Retail', 'commerce_media', 'Commerce Media Networks', 
'Monetize **retailer-owned channels**—site, app, email, in-store—by offering brands *privacy-safe targeting* and performance measurement using first-party data.

This use case builds the **audience, activation, and reporting layer** needed to run *retail media as a scalable business*.

Benefits:
- **High-margin incremental revenue** for retailers
- **Better outcomes for advertisers** through precise targeting
- **Privacy-safe measurement** linking ad exposure to sales
- **Scalable infrastructure** for growing the media business

*Turn your customer relationships into a competitive advantage.*', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(8, 'retail', 'Retail', 'employee_360', 'Employee 360', 
'Create a **unified view of workforce data**—roles, performance, scheduling, training, and operational KPIs—to improve staffing decisions and productivity.

This enables leaders to identify:
- **Bottlenecks** in operations
- **Skill gaps** across teams
- **Performance drivers** by store, distribution center, or function

*Employee 360* supports better **labor planning** and **targeted coaching** by turning fragmented HR and operational data into *actionable insight*.

The result? **Optimized schedules**, reduced turnover, and teams that perform at their best.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(9, 'retail', 'Retail', 'agentic_workforce', 'Agentic Workforce', 
'Augment employees with **AI assistants** that can interpret context, retrieve knowledge, summarize issues, and propose *next-best actions* across daily workflows.

The goal is to **shorten time-to-decision** and reduce manual effort, especially in high-variance operations like:
- *Store execution* and task management
- *Inventory exceptions* and stockouts
- *Customer escalations* and service recovery

Well-designed agents combine **governed enterprise data** with workflow automation so *humans stay in control* while execution becomes faster and more consistent.

**Empower every employee to make expert decisions.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(10, 'retail', 'Retail', 'supply_chain_risk', 'Supply Chain Risk Management', 
'Detect and manage **supply risk** by combining supplier performance, logistics signals, lead-time variability, disruptions, and external indicators to surface *early warnings*.

This use case prioritizes **visibility and scenario planning** so teams can act *before* issues become shortages or service failures.

Key capabilities:
- **Early warning systems** for emerging risks
- **Scenario modeling** for contingency planning
- **Coordinated response** across the supply chain

The outcome? *Fewer disruptions*, lower expedite costs, and **better service levels** through proactive mitigation.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(11, 'retail', 'Retail', 'demand_inventory', 'Demand & Inventory Optimization', 
'Improve **forecast accuracy** and **inventory positioning** by using demand signals—*sales, promotions, seasonality, events*—and supply constraints to optimize replenishment, allocation, and safety stock.

This helps **reduce stockouts and excess inventory simultaneously**.

Operationally, it supports:
- Smarter **planning decisions** across DCs and stores
- Tighter **feedback loops** between forecasting, ordering, and execution
- **Automated replenishment** triggers based on real-time signals

*The right product, in the right place, at the right time.*', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(12, 'retail', 'Retail', 'supplier_collaboration', 'Supplier Collaboration', 
'Share insights and coordinate plans with suppliers to improve **fill rates, lead times, and responsiveness**.

This includes:
- **Joint forecasting** based on shared demand signals
- **Exception management** for disruptions and delays
- **Shared KPIs** so both sides act on the same version of reality

The result is **stronger resilience** through faster alignment when constraints change—*capacity, delays, quality issues*—and fewer downstream surprises.

**Transform supplier relationships from transactional to strategic.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- CPG INDUSTRY
-- =============================================================================

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(13, 'cpg', 'CPG', 'shopper_insights', 'Shopper Insights', 
'Understand **who buys, why they buy, and how behavior changes** across channels by combining retailer data, loyalty signals, digital engagement, and panel/market data.

The focus is on identifying:
- **Demand drivers** and category dynamics
- **Shopper segments** and personas
- **Shopping missions** and occasions

This enables more effective activation—brands can *tailor offers and campaigns to shopper intent*, improving **conversion and loyalty outcomes**.

**Know your shopper better than anyone else.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(14, 'cpg', 'CPG', 'brand_insights', 'Brand Insights', 
'Measure **brand health and marketing impact** by connecting campaign exposure, engagement, sentiment, and sales outcomes to identify *what is moving the brand*.

This use case supports faster learning on:
- **Messaging effectiveness** and creative performance
- **Channel mix** optimization
- **Competitive positioning** and share of voice

Practically, it turns marketing analysis into an **always-on feedback loop** that ties brand-building activity to *measurable results*.

**Invest with confidence—know exactly what''s working.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(15, 'cpg', 'CPG', 'retailer_insights', 'Retailer Insights', 
'Improve performance **at each retailer** by analyzing assortment, pricing, promotions, on-shelf availability, and execution against plan.

The goal is to identify:
- **Where growth is being won or lost**
- **Execution gaps** and compliance issues
- **Opportunities** for share and velocity gains

This becomes the **analytical backbone** for field sales and category teams—helping them *prioritize actions* that will drive results.

**Support fact-based joint business planning** with retail partners.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(16, 'cpg', 'CPG', 'cpg_employee_360', 'Employee 360', 
'Unify **workforce and performance data** across sales, merchandising, supply chain, and corporate teams to improve productivity and planning.

This helps leaders understand:
- **Capacity** and resource allocation
- **Performance drivers** by role, region, and team
- **Training needs** and development opportunities

The result is *better execution quality*—especially for **field teams** where time and focus directly drive revenue outcomes.

**Empower every team member to perform at their best.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(17, 'cpg', 'CPG', 'cpg_agentic_workforce', 'Agentic Workforce', 
'Enable **proactive decision-making** with AI agents that support common workflows:
- *Summarizing retailer performance* at a glance
- *Drafting account plans* and recommendations
- *Answering policy and product questions* instantly
- *Surfacing risks and opportunities* before they''re missed

The focus is on **reducing time spent on manual analysis** and increasing time spent on *high-value execution*.

When integrated with governed data, agents help **standardize best practices** and make insight accessible to *every rep and manager*.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(18, 'cpg', 'CPG', 'cpg_supply_chain_risk', 'Supply Chain Risk Management', 
'Proactively detect **disruptions across suppliers, manufacturing, and logistics** by monitoring constraints, delays, quality signals, and external events.

This supports:
- **Scenario planning** for what-if analysis
- **Faster mitigation** to protect service levels
- **Coordinated response** across the network

The outcome is *improved resilience*—**fewer surprises**, faster response, and lower cost impact when variability hits.

**Stay ahead of disruptions, not behind them.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(19, 'cpg', 'CPG', 'cpg_demand_inventory', 'Demand & Inventory Optimization', 
'Align **production, distribution, and inventory with demand** by improving forecast accuracy and optimizing inventory policies across the network.

This reduces *obsolescence and stockouts* while improving **working capital efficiency**.

Key benefits:
- Tighter loop between **demand sensing** (what''s happening now) and **planning** (what to do next)
- Better **service levels** with less inventory
- Improved **responsiveness** to market changes

**Balance supply and demand like never before.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(20, 'cpg', 'CPG', 'cpg_supplier_collaboration', 'Supplier Collaboration', 
'Coordinate plans and share insights with **suppliers and key retail partners** to reduce variability and improve reliability.

This includes:
- **Shared forecasting** and demand signals
- **Exception handling** for disruptions
- **Performance tracking** against commitments

Better collaboration drives *higher fill rates* and fewer costly last-minute changes by **aligning all parties** on constraints and commitments.

**Build a supply chain that works as one.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(21, 'cpg', 'CPG', 'revenue_growth_mgmt', 'Revenue Growth Management', 
'Optimize **pricing, promotions, and trade investment** to grow revenue profitably.

This use case includes:
- **Elasticity modeling** to understand price sensitivity
- **Promotion effectiveness** analysis
- **Scenario planning** for strategic decisions
- **Guardrails** that balance volume, margin, and brand strategy

The outcome is *improved ROI* on trade spend and promotions by shifting investment toward tactics that generate **incremental profit**—not just sales.

**Every dollar works harder.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(22, 'cpg', 'CPG', 'portfolio_innovation', 'Portfolio Optimization & Innovation', 
'Evaluate which products to **grow, refresh, retire, or launch** by combining performance data with market trends and consumer signals.

This supports stronger decisions on:
- **Innovation pipelines** and new product development
- **Pack/price architecture** optimization
- **Portfolio roles** across channels and segments

Practically, it helps teams *prioritize R&D and commercial investment* toward opportunities with the **highest likelihood of sustainable growth**.

**Build the portfolio of the future.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- TRAVEL & HOSPITALITY INDUSTRY
-- =============================================================================
-- Legacy rows 23-28 (Customer Data Management, Customer Insights & Activation,
-- Employee 360, Agentic Workforce, Call Center Operations, Dynamic Pricing &
-- Promotion) have been replaced by the 10 outcome-map-aligned use cases below
-- (config_ids 200-209). The legacy slugs are no longer seeded; if any session
-- references them, the frontend gracefully falls back to custom mode.
-- =============================================================================

-- =============================================================================
-- SAMPLE INDUSTRY: BUILD A DATA CONTRACT SKILL
-- =============================================================================

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(29, 'sample', 'Sample', 'build_skill', 'Build a Data Contract Skill', 
'Build an **Agent Skill** that defines and enforces **data contracts** on gold-layer tables using Unity Catalog tags.

## Skill Identity
- **Name**: `databricks-data-contract`
- **Description**: Applies data contract measures as Unity Catalog tags to gold-layer tables, validates compliance, and manages certification status
- **Triggers**: "data contract", "certification", "gold layer tags", "contract measures", "validate compliance"

## Extends
- **Builds on**: `naming-tagging-standards` (adds contract governance beyond basic naming conventions)
- **Template**: `create-agent-skill` (standard folder structure and SKILL.md format)

## Target Assets
- Gold-layer tables in Unity Catalog
- Applied via: `ALTER TABLE ... SET TAGS`
- Verified via: `SHOW TAGS ON TABLE` and `system.information_schema.table_tags`

## Measures / Rules
Define these as Unity Catalog tags on each gold-layer table:
- `freshness_sla` — Maximum acceptable data age (e.g., "24h", "1h", "7d")
- `completeness_threshold` — Minimum non-null percentage for key columns (e.g., "99.5%")
- `schema_version` — Semantic version of table schema (e.g., "v1.0")
- `owner` — Responsible team or individual (e.g., "data-engineering")
- `update_frequency` — Expected refresh cadence (e.g., "daily", "hourly")
- `quality_score_min` — Minimum data quality score (e.g., "0.95")

## Validation Approach
- For each measure, a SQL query checks compliance (e.g., timestamp recency for freshness, null counts for completeness)
- Queries use `system.information_schema` and direct table data
- Results are boolean pass/fail per measure per table

## Certification Criteria
- Tables passing ALL contract measures receive: `system.certification_status = ''certified''`
- Tables failing ANY measure receive: `system.certification_status = ''deprecated''`
- Grace period for newly created tables
- Validation runs on a schedule (daily) via Databricks Jobs

## Skill Artifacts
- `SKILL.md` — Primary skill file with triggers, instructions, references, and assets
- `references/validation-patterns.md` — SQL validation queries per measure
- `assets/contract-schema.yaml` — YAML config defining measures, defaults, and certification rules

## Outcome
A **production-ready Agent Skill** that any AI coding assistant can use to enforce data quality contracts across your Lakehouse gold layer.', 
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- ============================================================================
-- Travel & Hospitality Use Case Descriptions
-- Insert into usecase_descriptions table for use case catalog
-- ============================================================================

-- 1. MRO Control Tower
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(100, 'travel', 'Travel & Hospitality', 'airline_mro_control_tower', 'MRO Control Tower',
'Unify **maintenance, repair & overhaul operations** across 14+ source systems into a single operational intelligence platform with 67 integrated pages, 13 AI models, and 120+ KPIs organized around five personas: MOC Controller, Reliability Engineer, VP Maintenance, Planner, and Data Steward.

This supports:
- **Situational awareness** — Command Center, Daily Ops, Fleet Map, War Room, ETOPS Monitor
- **Defect & delay management** — AI-powered delay coding (91%+ accuracy), defect tagging, ATA trending
- **MSG-3 reliability program** — SPC control charts, auto-triggered investigations, corrective action tracking
- **Compliance & airworthiness** — AD/SB deadline alerting, risk scoring, EO lifecycle, audit readiness
- **Engine health** — EGT margin monitoring, shop visit projections, LLP lifecycle, digital twin with RUL prediction
- **Shop intelligence** — AI extraction from vendor PDFs, failure trend clustering, vendor scorecards, warranty recovery pipeline
- **Parts & supply chain** — AI demand forecasting, rotable pool lifecycle, inter-station redistribution
- **Workforce management** — Certification tracking, skill gap analysis, FRMS fatigue risk scoring
- **Cost analytics** — Cost per flight hour, TCO modeling, fleet economics with what-if scenarios
- **Data quality** — 6-dimension DQ scoring, quarantine with AI pattern detection, pipeline health monitoring

Data flows through a **Bronze → Silver → Gold** medallion architecture (84 tables) with CDC from the MRO system, batch from flight ops, streaming from in-flight telemetry, and document AI for regulatory docs and shop reports. An AI Copilot with 5 specialized sub-agents is embedded across every page.

The outcome is a shift from *reactive break-fix maintenance* to **predictive, data-driven fleet management** — reducing AOG events, automating compliance, recovering warranty value, and saving **$13M–$36M annually** for a 300–400 aircraft fleet.

**The screen that is up in the MOC 24/7.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 2. Safety Management System (SMS)
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(101, 'travel', 'Travel & Hospitality', 'airline_safety_management', 'Safety Management System (SMS)',
'Build a **Safety Management System** that integrates hazard reporting, risk assessment, incident investigation, and safety performance monitoring into a unified platform — meeting ICAO Annex 19 and regulatory SMS requirements while transforming safety culture from reactive compliance to proactive risk management.

This supports:
- **Hazard identification** — Voluntary safety reports (ASAPs, ASRS), mandatory occurrence reports, fatigue reports, and anonymous submissions with NLP-based categorization and duplicate detection
- **Risk assessment** — 5×5 risk matrix (likelihood × severity), bowtie analysis for barriers and controls, residual risk scoring after mitigations, and risk register with trend tracking
- **Incident investigation** — Structured investigation workflow (notification → data collection → analysis → corrective action → effectiveness review), root cause analysis with human factors taxonomy (HFACS), and causal chain visualization
- **Safety performance monitoring** — Leading and lagging indicators with SPC control charts, Safety Performance Indicators (SPIs) tracked against Safety Performance Targets (SPTs), and regulatory threshold alerting
- **Predictive safety analytics** — AI models that score emerging risks from unstructured safety reports, identify precursor patterns before incidents occur, and flag organizational drift using text mining across reporting trends
- **Safety assurance** — Internal audit management, change management risk assessment (new routes, fleet types, procedures), and continuous monitoring of safety action effectiveness
- **Safety promotion** — Safety bulletin distribution, training compliance tracking, safety culture survey integration, and communication effectiveness metrics

Source systems include the **safety reporting database**, **flight data monitoring (FDM/FOQA)**, **crew fatigue reporting**, **ATC incident feeds**, **MRO defect data**, **weather systems**, and **HR/training records**. The medallion architecture normalizes taxonomy differences across voluntary and mandatory reporting streams.

The outcome is a *safety intelligence platform* that moves beyond checkbox compliance to **genuine risk prediction** — catching the signals in safety reports that precede serious events, and ensuring every hazard drives action through closure.

**See the risk before it becomes an incident.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 3. Loyalty & Rewards Program Analytics
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(102, 'travel', 'Travel & Hospitality', 'airline_loyalty_rewards', 'Loyalty & Rewards Analytics',
'Build a **loyalty and rewards intelligence platform** that unifies member behavior, earn/burn patterns, partner economics, and lifetime value modeling to maximize program revenue, optimize partner margins, and reduce attrition across millions of members and dozens of co-brand and coalition partners.

This supports:
- **Member 360 profile** — Unified view across flights, credit card spend, partner transactions, redemptions, service interactions, and digital engagement with real-time tier status and lifetime value score
- **Earn & burn analytics** — Mileage accrual patterns by channel (flights, credit card, partners, promotions), redemption behavior (award flights, upgrades, merchandise, partner rewards), breakage forecasting, and liability management
- **Tier & status management** — Qualification tracking, tier migration modeling (who will qualify/drop), proactive retention offers for at-risk elites, and status match/challenge program optimization
- **Partner economics** — Co-brand credit card revenue modeling, partner earn/burn margin analysis, dynamic partner pricing optimization, and settlement reconciliation across coalition partners
- **Churn prediction & retention** — ML models predicting member disengagement 60–90 days ahead based on activity decay, competitive switching signals, and life event detection, with automated re-engagement campaign triggers
- **Personalization engine** — Next-best-offer recommendations, dynamic award pricing, personalized upgrade offers, and contextual in-journey engagement based on real-time member context
- **Program financial modeling** — Deferred revenue liability estimation (ASC 606), breakage rate forecasting, program P&L by segment, and what-if analysis for earn rate or redemption chart changes

Source systems include the **loyalty management platform**, **reservation system**, **co-brand credit card transaction feeds**, **partner settlement systems**, **digital engagement platforms** (app, web, email), **customer service interactions**, and **revenue accounting**. The Gold layer powers both real-time personalization (sub-second recommendations) and batch analytics (monthly program P&L).

The outcome is a loyalty program that *feels personal to every member* while being **financially optimized at the portfolio level** — maximizing the $2B+ annual revenue that loyalty programs generate for major carriers.

**Every mile tells a story. Read them all.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 4. Revenue Management & Pricing
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(103, 'travel', 'Travel & Hospitality', 'airline_revenue_management', 'Revenue Management & Pricing',
'Build a **revenue management intelligence platform** that integrates demand forecasting, pricing optimization, inventory control, and competitive intelligence to maximize Revenue per Available Seat Mile (RASM) across the entire network.

This supports:
- **Demand forecasting** — ML-based booking curve prediction by market, fare class, and day-of-week, incorporating seasonality, events, macroeconomic signals, and competitive capacity changes with confidence intervals
- **Fare optimization** — Dynamic pricing recommendations across fare classes, ancillary bundles, and distribution channels, with price elasticity modeling by customer segment and market
- **Inventory control** — Bid price optimization, nested fare class availability, O&D (origin-destination) revenue management, and overbooking models calibrated by no-show and go-show rates per market
- **Competitive intelligence** — Real-time fare monitoring across competitors, capacity change detection, market share trending, and alert-driven responses to competitor pricing moves
- **Ancillary revenue** — Seat selection, baggage, lounge access, and upgrade pricing optimization with customer willingness-to-pay modeling and bundle attach rate analysis
- **Group & corporate pricing** — RFP response optimization, corporate discount analysis, and group booking displacement cost calculation
- **Network revenue** — Connecting itinerary revenue allocation, hub feed optimization, codeshare proration analysis, and route profitability including true allocated costs

Source systems include the **reservation and ticketing system**, **departure control system**, **competitor fare feeds**, **GDS booking data**, **web/app shopping and conversion data**, **economic indicator feeds**, **event calendars**, and **historical revenue accounting**. Real-time streaming enables dynamic pricing updates within minutes of market changes.

The outcome is **1–3% RASM improvement** through better demand prediction, faster competitive response, and optimized ancillary attachment — translating to **$50M–$200M annually** for a mid-to-large carrier.

**The right price, for the right seat, at the right time.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 5. Flight Operations & Crew Management
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(104, 'travel', 'Travel & Hospitality', 'airline_flight_ops', 'Flight Operations & Crew Intelligence',
'Build a **flight operations intelligence platform** that integrates flight planning, crew scheduling, fuel optimization, and operational control into a unified decision-support system for dispatchers, crew schedulers, and operations controllers.

This supports:
- **Flight planning optimization** — Route optimization considering winds, weather, NOTAM restrictions, and airspace charges, with fuel burn modeling per aircraft type and payload configuration
- **Fuel management** — Tankering analysis (when to carry extra fuel vs. buy at destination), fuel price arbitrage across stations, APU usage optimization, and fleet-wide fuel efficiency trending with engine wash scheduling
- **Crew scheduling & tracking** — Legal rest compliance monitoring, duty time limit tracking, crew pairing optimization, reserve utilization, and real-time crew position tracking across the network
- **Disruption management** — Automated recovery recommendations during irregular operations (IROPS) — aircraft swaps, crew reassignments, passenger rebooking priorities, and cost-of-delay modeling for hold vs. cancel decisions
- **OTP analytics** — On-time performance decomposition by cause (maintenance, crew, ATC, weather, ground handling), station-level trending, and root cause pattern detection with AI-driven improvement recommendations
- **Weight & balance** — Automated load planning, trim optimization for fuel savings, and cargo revenue integration with passenger loads
- **Operational risk scoring** — Per-flight risk scores combining weather severity, crew fatigue indicators, aircraft MEL status, and airport operational complexity

Source systems include the **flight planning system**, **crew management system**, **operational control center systems**, **weather services**, **ATC flow control feeds**, **fuel supplier pricing**, **load planning system**, and **airport operations data**. Streaming ingestion enables real-time operational awareness during IROPS events.

The outcome is **reduced fuel costs** ($0.50–$1.00/FH savings × fleet hours), **improved OTP** (1–2 percentage points), and **faster IROPS recovery** — translating to **$20M–$80M annually** in operational savings.

**Every flight is a plan. Make every plan optimal.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 6. Customer Experience 360
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(105, 'travel', 'Travel & Hospitality', 'airline_customer_360', 'Customer Experience 360',
'Build a **customer experience intelligence platform** that unifies every touchpoint of the passenger journey — from booking through arrival — to enable real-time service recovery, proactive engagement, and data-driven CX improvement across all channels.

This supports:
- **Passenger 360 profile** — Unified view across reservations, check-in, lounge visits, onboard purchases, service interactions, complaints, social media sentiment, loyalty status, and lifetime value
- **Journey analytics** — End-to-end journey mapping from search → book → check-in → lounge → board → inflight → arrive → post-trip, with friction point identification and drop-off analysis at each stage
- **Real-time service recovery** — AI-driven disruption impact scoring per passenger (connection risk, loyalty tier, fare value, rebooking options), automated compensation offers, and proactive notification before the passenger knows there is a problem
- **Voice of Customer (VoC)** — NLP analysis of survey responses, complaint text, social media mentions, and call center transcripts with automated theme extraction, sentiment trending, and root cause clustering
- **NPS & satisfaction modeling** — Predictive NPS scoring before the survey is sent, driver analysis (what moves the needle most), and closed-loop action tracking from insight to operational change
- **Digital experience optimization** — App and web funnel analytics, A/B test analysis, self-service adoption rates, chatbot effectiveness, and digital-to-human handoff quality
- **Service quality monitoring** — Catering quality scores, IFE availability, cabin cleanliness ratings, ground handling performance, and lounge experience metrics by location

Source systems include the **reservation system**, **departure control system**, **customer service CRM**, **survey platform**, **social media feeds**, **mobile app analytics**, **IFE system**, **catering management**, and **ground handling reports**. Real-time streaming enables in-journey intervention within minutes of a disruption.

The outcome is *service recovery that happens before the complaint* and **CX improvements driven by data, not anecdotes** — improving NPS by 5–10 points and reducing complaint volume by 20–30%.

**Know every passenger. Serve every moment.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 7. Cargo & Freight Operations
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(106, 'travel', 'Travel & Hospitality', 'airline_cargo_ops', 'Cargo & Freight Intelligence',
'Build a **cargo operations intelligence platform** that optimizes freight revenue, capacity utilization, and shipment lifecycle management across belly cargo and dedicated freighter operations.

This supports:
- **Capacity management** — Available cargo capacity forecasting by flight considering passenger loads, mail commitments, and dangerous goods restrictions, with dynamic allocation between ad-hoc and allotment bookings
- **Revenue optimization** — Dynamic cargo pricing based on lane demand, weight/volume density, commodity type, booking lead time, and competitive rates, with yield management by origin-destination pair
- **Shipment lifecycle tracking** — End-to-end visibility from booking through acceptance, build-up, loading, transit, offload, and delivery, with milestone SLA monitoring and exception alerting
- **ULD management** — Unit Load Device position tracking, utilization optimization, repair lifecycle, and inter-station imbalance detection with repositioning recommendations
- **Special cargo handling** — Temperature-controlled shipment monitoring (pharma, perishables), dangerous goods compliance validation, live animal handling protocols, and valuable cargo chain-of-custody
- **Ground handling performance** — Warehouse throughput metrics, build-up/breakdown times, trucking partner SLAs, and acceptance/delivery turnaround by station
- **Interline & partner analytics** — Proration analysis for interline shipments, GSA (General Sales Agent) performance scorecards, and partner revenue contribution trending

Source systems include the **cargo management system**, **reservation and allotment system**, **warehouse management system**, **ULD tracking system**, **trucking/ground transport feeds**, **customs clearance systems**, and **temperature monitoring IoT sensors**. Real-time tracking enables proactive exception management and customer notification.

The outcome is **5–10% cargo revenue uplift** through better capacity utilization and dynamic pricing, plus **reduced mishandling** and improved SLA compliance.

**Every kilogram of capacity is revenue waiting to happen.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 8. Airport & Ground Operations
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(107, 'travel', 'Travel & Hospitality', 'airline_airport_ops', 'Airport & Ground Operations',
'Build an **airport operations intelligence platform** that optimizes turnaround performance, gate utilization, ground handling coordination, and passenger flow to minimize delays and maximize on-time departures at hub and outstation airports.

This supports:
- **Turnaround management** — Real-time monitoring of the 12+ turnaround milestones (block-in → deplane → clean → cater → fuel → board → block-out), with AI-predicted completion times and delay risk scoring per flight
- **Gate & stand management** — Dynamic gate assignment optimization considering aircraft type, connection flows, towing costs, ground power availability, and passenger walking distances, with conflict detection and swap recommendations
- **Ground handling performance** — SLA monitoring across contracted ground handlers (baggage, ramp, cleaning, catering, fueling), with scorecard trending, penalty tracking, and root cause analysis for service failures
- **Passenger flow analytics** — Check-in queue wait times, security throughput, boarding gate congestion, connection minimum times, and missed connection prediction with proactive rebooking
- **Baggage operations** — Baggage system throughput monitoring, mishandled bag prediction, short-connect bag prioritization, and reconciliation rates with lost/delayed/damaged trending by station
- **De-icing operations** — De-icing fluid inventory, holdover time tracking, de-icing pad queue management, and weather-driven demand forecasting for fluid pre-positioning
- **GSE coordination** — Ground Support Equipment availability, positioning optimization, maintenance scheduling, and utilization analytics to right-size the GSE fleet per station

Source systems include the **airport operational database (AODB)**, **gate management system**, **ground handler systems**, **baggage handling system**, **passenger processing systems**, **weather services**, **de-icing management**, and **GSE tracking**. Real-time feeds enable turnaround management with minute-by-minute visibility.

The outcome is **1–3 minute improvement in average turnaround time** (compounding across hundreds of daily turns), **reduced ground-handling penalties**, and **fewer missed connections** — driving both cost savings and OTP improvement.

**Win the turn, win the day.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 9. Route Network & Schedule Planning
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(108, 'travel', 'Travel & Hospitality', 'airline_network_planning', 'Route Network & Schedule Planning',
'Build a **network planning intelligence platform** that integrates market demand analysis, competitive dynamics, fleet assignment, and schedule optimization to maximize network profitability and strategic positioning.

This supports:
- **Market analysis** — Demand estimation by O&D market using booking data, MIDT (Marketing Information Data Tapes), economic indicators, population/GDP data, and event calendars, with segmentation by purpose of travel and price sensitivity
- **Competitive landscape** — Capacity share by market, competitor schedule changes, new route announcements, codeshare/JV impact analysis, and low-cost carrier threat assessment
- **Route profitability** — Fully allocated route P&L including passenger revenue, ancillary, cargo, true operating cost (fuel, crew, maintenance, airport charges, overfly), and network contribution (feed value to hub)
- **Schedule optimization** — Departure time optimization by market (consumer preference, slot availability, connection windows), frequency analysis, and seasonal schedule design with wave structure optimization at hubs
- **Fleet assignment** — Aircraft gauge optimization by route (right-sizing capacity to demand), fleet transition planning (new type introduction, retirement scheduling), and range-payload trade-off analysis
- **New route evaluation** — Business case modeling for prospective routes with demand stimulation estimates, competitive response scenarios, ramp-up curves, and break-even analysis across fare/load factor assumptions
- **Codeshare & alliance optimization** — Partner network overlap analysis, codeshare revenue contribution, metal-neutral joint venture modeling, and interline proration optimization

Source systems include **booking and ticketing data**, **MIDT / market intelligence feeds**, **competitor schedule databases**, **economic data providers**, **fleet planning tools**, **airport slot coordination**, **revenue accounting**, and **cost allocation models**. The analytical layer combines historical performance with forward-looking demand models.

The outcome is **network decisions grounded in data rather than intuition** — identifying profitable new markets, right-sizing existing routes, and optimizing the schedule for both local and connecting revenue.

**Every route is an investment thesis. Test it with data.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 10. Sustainability & ESG
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(109, 'travel', 'Travel & Hospitality', 'airline_sustainability_esg', 'Sustainability & ESG',
'Build a **sustainability and ESG intelligence platform** that tracks, reports, and optimizes environmental impact across flight operations, ground operations, and the supply chain — meeting CORSIA, EU ETS, and investor ESG disclosure requirements while identifying genuine efficiency opportunities.

This supports:
- **Carbon emissions tracking** — Per-flight CO2 calculation (fuel burn × emission factor), fleet-wide Scope 1 emissions, Scope 2 (ground energy), and Scope 3 (supply chain, employee travel), with year-over-year trending and intensity metrics (CO2/RPK, CO2/RTK)
- **Fuel efficiency optimization** — Single-engine taxi savings, APU usage reduction, continuous descent approach adoption rates, optimal altitude/speed trade-offs, fuel tankering carbon cost analysis, and engine wash scheduling for compressor efficiency recovery
- **Sustainable Aviation Fuel (SAF)** — SAF procurement tracking, blending ratios by station, cost premium analysis, supply chain certification (ISCC/RSB), and lifecycle emission reduction accounting with book-and-claim reconciliation
- **CORSIA & EU ETS compliance** — Automated emissions monitoring, reporting, and verification (MRV) for CORSIA and EU ETS, offset credit tracking and retirement, compliance deadline management, and regulatory scenario modeling for evolving policy
- **Fleet modernization impact** — Carbon reduction modeling from fleet renewal (e.g., next-gen narrowbody replacing legacy types), retirement acceleration scenarios, and total fleet emissions trajectory vs. industry/national targets
- **Ground operations sustainability** — Electric GSE adoption tracking, terminal energy usage, waste management (catering, cabin, maintenance), water usage, and de-icing fluid environmental impact
- **ESG reporting & disclosure** — Automated data assembly for TCFD, CDP, SASB, and GRI frameworks, board-ready sustainability dashboards, investor ESG questionnaire response support, and materiality assessment tracking

Source systems include **flight data recorders / ACARS**, **fuel management systems**, **SAF procurement records**, **ground energy meters**, **waste management systems**, **fleet planning data**, **emissions factor databases**, and **regulatory reporting portals**. The Gold layer automates what is typically a months-long annual reporting exercise.

The outcome is **regulatory compliance with minimal manual effort**, identification of **$5M–$15M in fuel efficiency savings**, and a credible, data-backed sustainability narrative for investors, regulators, and passengers.

**Measure it. Reduce it. Report it. Repeat.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 11. Airline Finance & Cost Management
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(110, 'travel', 'Travel & Hospitality', 'airline_finance_cost', 'Airline Finance & Cost Intelligence',
'Build an **airline finance and cost intelligence platform** that provides granular cost visibility, variance analysis, and predictive financial modeling across the uniquely complex airline cost structure — where fuel, labor, maintenance, and airport charges interact across thousands of daily flights.

This supports:
- **CASM decomposition** — Cost per Available Seat Mile broken down by category (fuel, labor, maintenance, airport, distribution, overhead), fleet type, route, and station, with peer benchmarking
- **Fuel cost management** — Fuel hedge position monitoring, physical vs. financial settlement tracking, fuel price exposure by forward month, and fuel cost variance analysis (price × volume × efficiency)
- **Maintenance cost forecasting** — Engine shop visit reserve modeling, airframe check cost projection by fleet age, component repair cost trending, and power-by-the-hour contract optimization
- **Revenue accounting** — Ticket revenue recognition, interline proration, ancillary revenue attribution, loyalty program deferred revenue (ASC 606), and cargo revenue allocation
- **Airport & distribution costs** — Landing fee analysis by station, terminal rent optimization, GDS segment fees, NDC adoption savings tracking, and distribution channel cost comparison
- **Labor cost analytics** — Crew cost per block hour by fleet type, overtime trending, training cost amortization, productivity metrics, and collective bargaining scenario modeling
- **Capital planning** — Fleet acquisition cash flow modeling, lease vs. buy analysis, aircraft residual value tracking, sale-leaseback evaluation, and debt maturity profiling

Source systems include the **general ledger**, **revenue accounting system**, **fuel procurement and hedging platform**, **payroll system**, **MRO cost system**, **airport billing**, **distribution/GDS feeds**, and **treasury management**. The analytical layer allocates shared costs to routes and flights for true profitability analysis.

The outcome is **financial transparency at the flight level**, enabling route-level profitability decisions, cost reduction targeting, and accurate forward financial modeling.

**Know the true cost of every seat, every mile, every day.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());


-- 12. Crew Experience & Workforce 360
INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(111, 'travel', 'Travel & Hospitality', 'airline_crew_workforce', 'Crew & Workforce 360',
'Build a **crew and workforce intelligence platform** that integrates scheduling, fatigue management, training, performance, and engagement data to optimize crew utilization while prioritizing safety and quality of life — critical in an industry facing structural pilot and technician shortages.

This supports:
- **Crew utilization analytics** — Block hours, duty hours, credit hours, and productivity metrics by base, fleet qualification, and seniority, with utilization vs. contractual limits visualization
- **Fatigue risk management** — Bio-mathematical fatigue modeling, duty period analysis, circadian rhythm disruption scoring, cumulative fatigue tracking, and correlation with safety report trends
- **Training & qualification** — Type rating currency tracking, recurrent training compliance, simulator scheduling optimization, line check pass rates, and training cost per crew member with competency gap analysis
- **Bidding & preference optimization** — Schedule bidding analytics, preference satisfaction scoring, quality-of-life metrics (commute patterns, home base nights, weekend days off), and seniority-adjusted equity analysis
- **Recruitment pipeline** — Pilot/technician pipeline tracking (application → screening → training → line-ready), time-to-productivity, attrition prediction by tenure band, and workforce supply-demand forecasting by fleet type
- **Labor relations analytics** — Grievance trending, arbitration outcome tracking, contract provision utilization, and scenario modeling for collective bargaining (cost of work rule changes, scheduling flexibility impact)
- **Engagement & retention** — Pulse survey analytics, voluntary attrition prediction, stay-driver identification by crew demographic, and early warning for disengagement patterns

Source systems include the **crew management system**, **training management system**, **HR/payroll system**, **fatigue reporting system**, **safety reporting system**, **bid/award system**, and **employee engagement platform**. The analytical layer must handle complex union contractual rules that vary by base, fleet, and seniority.

The outcome is **better crew quality of life** (higher preference satisfaction, fewer fatigue events), **optimized training spend**, and **reduced attrition** in an industry where replacing a single pilot costs $100K–$250K.

**Take care of the crew, and the crew takes care of the operation.**',
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- DEACTIVATE LEGACY AIRLINE DEEP-DIVE ROWS
-- =============================================================================
-- The 12 airline-specific deep-dive rows above (config_ids 100-111) are kept in
-- this seed file for content preservation but flipped to is_active=FALSE so
-- they don't render in the new outcome-map grid alongside the 10 column-level
-- use cases below (config_ids 200-209). Re-activate selectively in the future
-- via the admin UI or a follow-up migration.
-- =============================================================================

UPDATE ${catalog}.${schema}.usecase_descriptions
SET is_active = FALSE
WHERE industry = 'travel'
  AND use_case IN (
    'airline_mro_control_tower',
    'airline_safety_management',
    'airline_loyalty_rewards',
    'airline_revenue_management',
    'airline_flight_ops',
    'airline_customer_360',
    'airline_cargo_ops',
    'airline_airport_ops',
    'airline_network_planning',
    'airline_sustainability_esg',
    'airline_finance_cost',
    'airline_crew_workforce'
  );

-- =============================================================================
-- TRAVEL & HOSPITALITY OUTCOME-MAP USE CASES (10 cards in 3 themed columns)
-- =============================================================================
-- These 10 rows back the OutcomeMapGrid frontend component. They are grouped
-- into three columns via category + category_order, and ordered within each
-- column by display_order. Every row's prompt_template follows the Booking App
-- spec format (Application Type / Personas / Core Features / Data Entities /
-- Technical Considerations / Scope Constraints).
-- =============================================================================

-- Column 1: Agentic AI Operations -- 4 cards

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(200, 'travel', 'Travel & Hospitality', 'autonomous_disruption_response', 'Autonomous Disruption Response',
 'Agentic AI Operations', 1, 1,
'Detect operational disruptions — weather, staffing gaps, supply breaks, guest complaints — and initiate corrective action through AI agents without waiting for human coordination, similar to Airbnb''s automated re-accommodation flow but applied across an entire travel & hospitality operation.

## Application Type
Operations + guest-facing hybrid app that connects **Operations Controllers** with a **Multi-Agent Recovery Engine** to detect, decide, and act across booking, crew, supply, and communication systems within minutes — converting disruption from a cost center into a competitive differentiator.

## Key Personas
- **Guest/Traveler**: End users who receive proactive notifications and accept or modify recovery options on their device
- **Operations Controller**: Internal staff (VP Irregular Operations, Director of Guest Recovery) who monitor portfolio-wide disruptions, tune agent guardrails, and intervene on high-risk or VIP cases

## Core Features Required

### Autonomous Recovery Workflow (4 Disruption Scenarios)

The application must support **four distinct autonomous response scenarios**, each driven by streaming signals and a dedicated recovery agent:

#### 1. Weather-Driven Rebooking Automation
Severe weather events trigger guest rebooking, crew reassignment, and proactive comms before service degrades:
- Multi-step agent fans out across alternate flights, partner-airline options, ground transport, and adjacent properties
- Ranked by total travel time, fare-class continuity, guest CLV, and loyalty tier
- Pre-disruption push: *"We''re moving you to the 9:40 AM before your 11:15 cancels"*
- One-tap accept that reissues tickets and pushes new boarding passes

#### 2. Staffing Shortage Auto-Response
No-shows, sick calls, and unexpected demand surges trigger mitigation without phone-tree coordination:
- Mixed-integer constraint optimizer reassigns shifts respecting union rules, certifications, and fatigue thresholds
- On-call activation, cross-property staff sharing, and service-level adjustments issued automatically
- Surfaces utilization vs contractual-limit dashboards for the duty manager

#### 3. Guest Complaint Real-Time Triage
Complaints from app, chat, social, and call transcripts are detected, classified, and routed in real time:
- Multi-label NLP categorization with severity and sentiment scoring
- Priority queue weighted by guest value (loyalty tier × CLV × recent stay history)
- Auto-resolution for standard recovery (rebook, voucher, points) with human-in-the-loop override
- Audit log of every voucher, refund, or miles issuance with rule citations (EU261, DOT, brand policy)

#### 4. Cascading Incident Coordination
A single trigger (power outage, water main break, fire alarm) hits HVAC, elevators, POS, and rooms simultaneously:
- Multi-agent orchestration with specialized agents per affected system, coordinated by a master agent
- Bayesian dependency-graph forecasting for cascade evolution
- Unified incident view shared between engineering, front desk, and guest services

### Operations War-Room
- Live map of disruptions and agent actions across the portfolio
- Exception queue with severity sort and override controls
- Audit trail of every agent decision with reasoning attached

## Data Entities
Core entities: Guests, Itineraries, Flights, Properties, Crews, Weather Events, Disruption Records, Staffing Records, Complaint Records, Recovery Plans, Compensation Ledger, Notifications, Audit Trail

## Technical Considerations
- **Mosaic AI Agent Framework** for multi-step disruption response agents with tool-calling into PMS / CRS / crew systems
- **Lakeflow** streaming ingest of weather, ops, booking, and crew feeds
- **Delta Lake** unified event store for disruption history and response outcomes
- **Lakebase** sub-millisecond operational state serving for the war-room view
- **Unity AI Gateway** model routing to keep recovery decisions under SLA latency
- **Databricks Apps** for the disruption-response command center; **Unity Catalog** for PII-aware audit lineage

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **the four core scenarios for a single airline or hotel brand, US flights/properties, and USD compensation only**. We do not need real PSS/PMS integration, real payment processing, hotel or ground-transport booking, or user authentication. This will be an **open, public demo** where anyone can replay simulated disruption scenarios and watch the agents detect, decide, notify, and compensate affected guests in real time.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(201, 'travel', 'Travel & Hospitality', 'predictive_maintenance', 'Predictive Maintenance',
 'Agentic AI Operations', 1, 2,
'Use IoT sensor data, maintenance history, and operational telemetry to forecast equipment failures before they occur — similar to Tesla''s over-the-air diagnostic and service-prediction system, applied across hotel HVAC, kitchen equipment, and airline fleet components where unplanned downtime directly degrades the guest experience.

## Application Type
Back-office facilities + MRO app that connects **Reliability Engineers** with a **Predictive Health Engine** to shift maintenance from scheduled or reactive to condition-based — extending asset life, preventing guest-impacting outages, and avoiding emergency repair premiums.

## Key Personas
- **Property Chief Engineer / Maintenance Controller**: Internal staff who watch the fleet of buildings or aircraft, route technicians, and defer or clear work items based on predicted health
- **Reliability Engineer**: Internal staff (VP Engineering, Chief Technical Officer) who tune models, investigate emerging failure patterns, and own the reliability program

## Core Features Required

### Condition-Based Forecasting (3 Asset Classes)

The application must support **three distinct asset classes**, each with its own degradation model:

#### 1. HVAC Failure Prediction (Hotels & Properties)
Forecast HVAC failures 48–72 hours before they occur to prevent guest room temperature complaints:
- Survival analysis (Weibull / Cox proportional hazards) on compressor amperage, refrigerant pressure, and air flow rates
- Multivariate anomaly detection (isolation forests) per unit, with weather and occupancy load context
- Example: *"Unit AHU-12 shows 0.71 failure-risk in 60h driven by compressor amperage drift"*

#### 2. Fleet Component Lifecycle Optimization (Airlines & Cruise)
Optimize replacement timing for high-value rotables (engines, APUs, landing gear, marine propulsion) on condition rather than fixed-interval schedules:
- Physics-informed neural networks combining engineering models with sensor learning
- Cost-benefit projections including parts, labor, dispatch reliability, and regulatory compliance (FAA/EASA AD/SB tracking)
- Side-by-side comparison of "remove now" vs "defer 30 days" with SHAP-based explanations for airworthiness audit

#### 3. Kitchen Equipment Health Monitoring (Restaurants & F&B)
Monitor walk-in coolers, ovens, dishwashers, and ice machines across hundreds of locations to prevent food-safety incidents:
- Anomaly detection with contextual baselines (door-open, defrost, load patterns)
- Gradient boosting on temperature, power draw, and compressor cycles for failure probability
- Auto-alerts before health-code excursion, not after

### Reliability Trend Detection & Repair Planning
- SPC charts that surface emerging fleet-wide reliability issues, clustered across properties or tails
- Shortest-path repair planner that locates the nearest part, matches technician skill to defect, and slots the work into the operational calendar
- One-click drill-down from trend to underlying work orders

## Data Entities
Core entities: Assets (HVAC units / Aircraft / Kitchen Equipment), Sensors, ACARS / BMS Messages, Maintenance Work Orders, Parts Inventory, Technicians, Properties / Stations, Regulatory Compliance Records, Failure History

## Technical Considerations
- **Mosaic AI** for survival analysis, anomaly detection, and degradation modeling
- **MLflow** for maintenance model versioning, experiment tracking, and shadow scoring before promotion
- **Lakeflow** streaming IoT/ACARS sensor ingestion at 1–10 second resolution
- **Delta Lake** time-series sensor data with Z-order clustering for fast health queries
- **Unity Catalog** lineage from raw telemetry through engineering features to predictions (essential for FAA/EASA airworthiness and food-safety audits)

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one asset class (pick HVAC, fleet engine, or walk-in cooler), three component variants, and 5–10 simulated assets**. We do not need real ACARS or BMS integration, real parts-inventory integration, native mobile apps, or user authentication. This will be an **open, public demo** where anyone can replay a CSV of telemetry and watch the platform predict, prioritize, and plan condition-based maintenance.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(202, 'travel', 'Travel & Hospitality', 'smarter_scheduling', 'Smarter Scheduling',
 'Agentic AI Operations', 1, 3,
'Apply AI to labor and resource allocation across airline crews, hotel housekeepers, restaurant front-of-house, and back-of-house production — forecasting demand by time, property, route, or location and matching staffing to expected workload while respecting labor regulations, union agreements, and employee preferences. Similar to Uber''s capacity-balancing system, but applied to the largest controllable cost in T&H: labor.

## Application Type
Planning + operations app that connects **Workforce Management Specialists** with a **Multi-Objective Optimizer** to produce schedules that minimize overtime, prevent understaffing incidents, and improve employee satisfaction across the entire labor footprint.

## Key Personas
- **Crew Planner / Workforce Analyst**: Internal staff (Director of Crew Planning, Director of Workforce Management) who build rosters and balance utilization vs cost
- **Department Head / Property GM**: Internal staff (Executive Housekeeper, Restaurant Manager, Hub Coordinator) who own daily staff assignments and intraday adjustments

## Core Features Required

### Multi-Domain Schedule Optimization (4 Domains)

The application must support **four distinct scheduling domains** that share data, constraints, and a common optimization engine:

#### 1. AI-Optimized Crew Rostering (Airlines & 24/7 Operations)
Generate optimized monthly rosters that satisfy hard regulatory constraints and soft employee preferences:
- Mixed-integer linear programming for FAA rest rules, union work rules, and certifications
- Reinforcement learning for dynamic adjustment as the operation drifts during the month
- Monte Carlo simulation for reserve capacity sized to expected disruption
- Example: *"Roster generation in 30 minutes instead of 5 days, with 12% lower paid hours"*

#### 2. Demand-Driven Housekeeping Scheduling (Hotels)
Dynamically schedule housekeepers based on real-time check-in/check-out, occupancy forecasts, and room-type cleaning standards:
- Gradient-boosting demand forecast on historical check-out patterns by guest segment
- Vehicle-routing-style assignment optimization for room sequences
- Online re-optimization as actual check-outs and early arrivals shift the picture

#### 3. Front-of-House Staffing Optimization (Restaurants & Front Desks)
Right-size service staffing based on occupancy, day of week, local events, and walk-in patterns:
- Multi-output demand forecasting per service area (front desk, restaurant, bar, pool)
- Queueing-theory wait-time prediction with cross-trained staff assignment
- Trade-off curves showing labor cost vs guest wait time at each staffing level

#### 4. Event-Driven Dynamic Reallocation
Real-time movement of staff across departments when demand surprises hit:
- Streaming statistical process control to detect demand exceeding capacity
- Constraint-based recommendation engine matches available, qualified staff
- Impact simulation for each reallocation before commit
- Example: *"Convention group arrived 3 h early — pull 2 idle housekeepers to lobby"*

### Scenario Comparison
- Versioned schedule snapshots with diff highlighting
- Side-by-side what-if scenarios with cost, service-level, and overtime deltas
- Approve-and-publish flow for the chosen scenario

## Data Entities
Core entities: Employees, Schedules, Shifts, Skills/Certifications, Properties / Routes, Demand Forecasts, Union & Regulatory Rules, Historical Performance, Live Demand Signals

## Technical Considerations
- **Mosaic AI** for demand forecasting and constraint optimization (mixed-integer programming on Spark for large instances)
- **Lakeflow** for ingestion of POS, PMS, booking, and workforce-management feeds
- **DBSQL + Photon** for high-concurrency workforce analytics and schedule reporting
- **Delta Lake** for historical demand and staffing patterns; **Databricks Apps** for the duty-manager dashboard
- Genie natural-language what-if queries for property managers

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one scheduling domain (pick crew rostering OR housekeeping OR front-of-house), one location/route, and 50–100 staff or flights**. We do not need real WFM integration, a full union-rule engine, or user authentication. This will be an **open, public demo** where anyone can load a CSV of demand and watch the optimizer build a roster, flag constraint violations, and propose reallocations in seconds.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(203, 'travel', 'Travel & Hospitality', 'realtime_operations_view', 'Real-Time Operations View',
 'Agentic AI Operations', 1, 4,
'Consolidate live operational data from PMS, POS, BMS, ACARS, workforce management, and guest feedback into a unified situational picture — the prerequisite for both human decision-making and autonomous agent action. Similar to a Bloomberg Terminal for travel & hospitality operations, fusing 8–12 fragmented systems into one pane of glass.

## Application Type
Wall-mounted + desktop dashboard that connects **Operations Directors** with a **Live-Signal Aggregator** to surface the property''s or airline''s pulse, flag exceptions before they escalate, and answer ad-hoc questions in seconds via embedded natural-language Q&A.

## Key Personas
- **Property GM / Operations Director**: Internal leadership who want the one number that says "are we okay?" and the three levers that fix it if not
- **Regional / Corporate Ops Analyst**: Internal staff who drill into a property''s or station''s performance vs the portfolio and flag resource gaps

## Core Features Required

### Live Operational Tiles (4 Views)

The application must support **four distinct live operational views**, each backed by streaming pipelines:

#### 1. Unified Property Operations Dashboard
One screen showing the property''s pulse for the duty manager:
- Occupancy, revenue pace, staffing levels, BMS energy/HVAC status, guest sentiment proxy
- Real-time exception stream with severity sort, today vs same-day-last-year comparison
- Statistical-process-control alerts when KPIs drift beyond historical bands
- Example: *"Restaurant covers running 15% below forecast — staffing imbalance flagged"*

#### 2. Network Operations Center (NOC) View
Portfolio-wide cross-property monitoring for regional ops leaders:
- Multivariate cross-property anomaly detection that surfaces the handful of properties that need attention
- Performance benchmarking adjusted for property type, size, brand, and seasonality
- Alert prioritization combining anomaly severity with business impact

#### 3. Flight Operations Real-Time View (Airlines)
Integrated picture for ops controllers and dispatchers:
- ACARS / ADS-B aircraft position, METAR / TAF / SIGMET weather, ATC flow control, crew duty, gate, and passenger-connection data
- Complex event processing detects emerging cascades (an inbound delay that will hit three downstream flights)
- Recovery-scenario simulation in real time with ranked alternatives

#### 4. Guest Journey Real-Time Tracking
Live view of every active guest from pre-arrival through post-stay:
- Identity-resolved journeys stitched across PMS, POS, mobile app, Wi-Fi, and IoT signals
- Sequence pattern mining and behavioral sentiment inference
- Next-best-action recommendation for proactive service before dissatisfaction escalates

### Conversational Intelligence
- Embedded Genie space lets any role ask "Why is DFW running 9 minutes late on average today?" and get a charted, grounded answer
- LLM-generated natural-language summaries of operational status for shift handoff
- Role-based slicing (network / property / fleet / region) with one-click link-back to tiles

## Data Entities
Core entities: Flights, Properties, Crews, Staff, Guests, Aircraft, BMS Sensors, POS Transactions, Bookings, Sentiment Events, Exception Records, Energy & Sustainability Metrics

## Technical Considerations
- **Lakeflow** real-time streaming from PMS, POS, BMS, IoT, ACARS, and booking systems
- **Delta Lake** unified operational event store with time travel for incident replay
- **Lakebase** low-latency operational state serving for the wall-mounted dashboard
- **AI/BI Dashboards** with auto-refresh for KPI tiles; **Genie** for natural-language operational queries
- **DBSQL + Photon** for high-concurrency operational analytics across hundreds of concurrent users
- **Mosaic AI** for cross-property anomaly detection and complex event processing

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **six core tiles, one drill-down depth, and a single property or airline in a single timezone**. We do not need real streaming integration, alert delivery via email/Slack/SMS, multi-region support, or user authentication. This will be an **open, public demo** where anyone can replay a Python-generated stream and watch the tiles update, exceptions flow, and the embedded AI answer ad-hoc questions.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Column 2: Diversified Revenue Growth -- 3 cards

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(204, 'travel', 'Travel & Hospitality', 'dynamic_pricing', 'Dynamic Pricing',
 'Diversified Revenue Growth', 2, 1,
'Continuously optimize prices for perishable inventory — room nights, airline seats, restaurant covers, ancillary upgrades — based on real-time demand, competitive rates, weather, events, booking velocity, and willingness-to-pay modeling. Similar to Uber''s surge-pricing algorithm, but spanning the full T&H pricing surface where every unsold seat or room night is irrecoverable revenue.

## Application Type
Back-office revenue-desk app + real-time pricing API that connects **Revenue Managers** with a **Continuous Pricing Engine** to adjust prices per shopper, per market, per minute — moving beyond rules-based RMS systems to AI-driven engines that learn from outcomes and re-price within seconds of signal arrival.

## Key Personas
- **Revenue Analyst**: Internal staff (Chief Revenue Officer, VP Revenue Management, Director of Pricing) who review forecasts, approve rule changes, and monitor realized yield vs forecast
- **Pricing Engineer**: Internal staff who own the models, manage experiments, and set guardrails against price flapping and rate-parity violations

## Core Features Required

### Continuous Pricing Surface (4 Inventory Types)

The application must support **four distinct pricing engines** that share the same demand and competitive-signal substrate:

#### 1. Real-Time Room Rate Optimization (Hotels)
Optimize room rates across room types, channels, and length-of-stay combinations:
- Causal price-elasticity estimation (instrumental variables) at the room-type × channel × LOS grain
- Reinforcement learning for sequential pricing decisions; rate-parity guardrails across direct, OTA, and metasearch
- Daily forecast with intraday refresh for high-volatility markets
- Example: *"BOS Marriott Aug 14 King: forecast 78 bookings vs pace of 65 — raise rate $18"*

#### 2. Airline Seat Revenue Optimization
Optimize seat pricing across fare classes, ancillary bundles, and channels at O&D level:
- Deep reinforcement learning for sequential fare-class allocation
- Demand unconstraining (estimating true demand from censored bookings)
- Network revenue optimization (a price change on one leg ripples through connecting itineraries)
- Discrete-choice willingness-to-pay models for fare + ancillary bundles

#### 3. Event-Driven Surge Pricing
Detect and respond to demand surges from concerts, sports, conventions, and weather-driven travel shifts:
- Anomaly detection on booking velocity for unscheduled demand surge detection
- Geographic demand spillover modeling and rate-ceiling optimization
- Reputational risk guardrails (no aggressive surge during natural disasters)
- Example: *"Taylor Swift concert detected from booking spike — surge applied 7 days out across 30 mi radius"*

#### 4. Ancillary and Upsell Pricing Optimization
Personalize pricing for upgrades, early check-in, premium Wi-Fi, seat upgrades, lounge access, and spa packages:
- Conjoint / discrete-choice willingness-to-pay per guest segment and booking context
- Contextual bandits for personalized offer selection and optimal placement timing
- Total-profit framing rather than attachment-rate alone

### Experiment Console
- A/B test pricing strategies on a controlled traffic slice with significance tracking
- Auto-rollback on revenue regression; shadow scoring of new models before promotion
- Compliance guardrails so price never varies by protected attributes

## Data Entities
Core entities: Markets, Properties / Flights, Fare Classes / Room Types, Bookings, Searches, Competitor Rates, Events, Guest Profiles, Ancillary Inventory, Pricing Rules, Experiment Cohorts

## Technical Considerations
- **Mosaic AI** for demand forecasting, price elasticity modeling, and reinforcement learning
- **Unity AI Gateway** for sub-200 ms pricing API calls with low-latency model serving
- **Lakebase** sub-millisecond price serving to booking engines and reservation systems
- **Lakeflow** real-time ingestion of booking, competitor-rate, and demand-signal data
- **Delta Lake** historical pricing and demand for model training; **Mosaic AI Feature Store** for guest context
- **Delta Sharing** for competitor and market data ingestion from third-party providers (rate-shopping feeds)

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one inventory type (pick room rates OR airline seats), one O&D or property, three fare classes / room types, and one booking curve**. We do not need live competitor scraping, real PSS/CRS integration, real payment processing, or user authentication. This will be an **open, public demo** where anyone can replay a static booking-curve CSV and watch the pricing engine adjust prices, run a shadow experiment, and explain its reasoning in real time.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(205, 'travel', 'Travel & Hospitality', 'intelligent_offers_management', 'Intelligent Offers Management',
 'Diversified Revenue Growth', 2, 2,
'Orchestrate personalized promotions, packages, loyalty perks, and ancillary offers across channels — matching the right offer to the right guest at the right moment in their journey to maximize acceptance rates while protecting margin and rate integrity. Similar to Amazon''s recommendation engine, but applied to travel ancillaries, loyalty rewards, and packaged experiences.

## Application Type
Marketing + revenue hybrid app + real-time decision API that connects **Campaign Managers and Loyalty Managers** with a **Next-Best-Offer Decisioning Engine** to combine guest lifetime value, propensity, and live context (booking stage, channel, loyalty tier) into a single offer recommendation per moment.

## Key Personas
- **Campaign / Offer Manager**: Internal staff (Chief Commercial Officer, VP Marketing, Director of Campaign Analytics) who design offer templates, set eligibility, and track realized margin
- **Loyalty Program Manager**: Internal staff (VP Loyalty and CRM) who define tier-based perks, points-pricing, and balance member engagement against program liability

## Core Features Required

### Personalized Offer Decisioning (4 Decision Lenses)

The application must support **four distinct offer decision lenses** sharing the same guest-360 substrate:

#### 1. Next-Best-Offer Decisioning Engine
Score every available offer against every guest in real time and serve the single best action:
- Multi-armed contextual bandits with Thompson sampling for offer selection
- Guest lifetime value prediction via gradient boosting on behavioral features
- Constraint optimization for budget and inventory allocation; offer-fatigue and frequency caps respected
- Closed-loop attribution from impression → click → conversion → refund

#### 2. Loyalty Program Offer Optimization
Calibrate point multipliers, redemption specials, tier accelerators, and partner offers per member lifecycle stage (acquisition, engagement, at-risk, reactivation):
- Member-lifecycle classification with offer-response modeling per segment and offer type
- Point liability forecasting integrated into the optimization (CFO-facing balance-sheet view)
- A/B framework for offer experiments with auto-promotion of winners

#### 3. Cross-Sell Package Builder
Auto-generate and price cross-sell packages combining rooms with dining, spa, activities, or experiences:
- Market-basket analysis for product affinity discovery
- Bundle pricing optimization via conjoint analysis with cannibalization detection
- Personalized package recommendation surfaced at the moment of highest purchase intent

#### 4. Pre-Arrival Engagement Sequencing
Orchestrate a personalized sequence of comms and offers from booking confirmation through day-of-arrival:
- Recurrent neural network for optimal cadence and channel preference per guest
- Offer-timing optimization (which days before arrival for which offer type)
- Message-fatigue modeling so unsubscribe rate stays under target

### Offer Composer & Attribution
- Drag-and-drop offer builder with eligibility rules, price ladders, expiry, and frequency caps
- Channel preview (web, mobile, email, on-property) before publish
- Realized-margin attribution by guest segment and offer type
- Example: *"Surface ''priority bag drop'' to a frequent flyer 24 h before departure"*

## Data Entities
Core entities: Guests, Loyalty Members, Bookings, Offers, Channels, Impressions, Conversions, Margin Records, Point Liability, Eligibility Rules, Offer Catalog

## Technical Considerations
- **Mosaic AI** for propensity, CLV prediction, NBO, and bandit-based offer selection
- **Mosaic AI Feature Store** for real-time guest context (loyalty tier, recent interactions, preferences)
- **Lakebase** sub-100 ms offer-decision API serving to booking flows and apps
- **Delta Lake** for offer history, response data, and campaign performance
- **Unity Catalog** for marketing consent and preference governance (GDPR / CCPA compliance)
- **Databricks Apps** for the offer management console; streaming attribution pipeline through Lakeflow

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **three ancillary types (bag, room upgrade, lounge or spa), one channel (web booking flow), and one brand or airline**. We do not need real payment processing, email/push channels, partner revenue-share, or user authentication. This will be an **open, public demo** where anyone can pick a sample guest and watch the platform decide which top-3 offers to surface, with explanations for why each was selected.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(206, 'travel', 'Travel & Hospitality', 'product_channel_development', 'Product & Channel Development',
 'Diversified Revenue Growth', 2, 3,
'Use data and AI to identify new revenue opportunities — new routes, property concepts, packages, menu items, distribution partnerships — and run them through a market-sizing and channel-economics analysis before committing capital. Similar to Shopify''s multichannel commerce platform, but applied to travel products distributed across direct, partner, marketplace, GDS, and NDC channels.

## Application Type
Strategy + commercial back-office app that connects **Network Planners and Product Managers** with a **Demand & Channel Intelligence Engine** to launch new products with quantified revenue projections, then distribute them consistently across direct, partner, and marketplace channels.

## Key Personas
- **Network Planner / Development Lead**: Internal staff (Chief Strategy Officer, VP Network Planning, VP Development, Director of Market Intelligence) who decide where to expand and which products to launch
- **Distribution Manager**: Internal staff (VP Distribution, Director of Channel Analytics) who onboard partners, optimize channel mix, and protect direct-booking share

## Core Features Required

### Product & Channel Intelligence (4 Decision Lenses)

The application must support **four distinct decision lenses** that share market and competitive data:

#### 1. New Route and Destination Demand Modeling
Cold-start demand modeling for routes or property locations using multi-source signals:
- Transfer learning from comparable routes/locations
- Web search trends, mobility data, demographic shifts, and economic indicators integrated as alternative data
- Monte Carlo simulation for scenario analysis and risk quantification on new-route forecasts
- Example: *"AUS–GUA route: forecast 142 daily passengers ±28 at 12 months, 18-month break-even"*

#### 2. Distribution Channel Economics Analysis
True channel economics including commissions, marketing costs, CAC, CLV by channel, and displacement:
- Multi-touch attribution and causal channel-interaction analysis
- Customer lifetime value attributed by acquisition channel
- Channel mix optimization under rate-parity and partner-commitment constraints
- Surfaces the all-in cost of an OTA booking vs a direct booking that most operators underestimate

#### 3. Competitive Intelligence and Market Positioning
Continuous monitoring of competitor pricing, capacity, products, and strategy:
- Automated competitive rate-shopping with pattern detection
- NLP analysis of competitor earnings calls and press releases
- Social sentiment comparison and market-share estimation from alternative data
- Daily competitive position score (composite index)

#### 4. Partnership and Alliance Revenue Optimization
Quantify and optimize partnership ROI (airline-hotel, loyalty coalitions, co-branded cards, DMO programs):
- Propensity-score matching for partnership incrementality measurement
- Cross-partner customer-journey analysis through Clean Rooms (privacy-preserving joint analytics)
- Optimal partnership-terms negotiation support via game-theory models

### Product Lifecycle & Distribution
- Versioned products with effective dating and audit trail
- Single product catalog rendered consistently across web, mobile, OTA, GDS, and NDC partner stacks
- A/B testing on offer variants with conversion attribution
- Retirement policies that auto-sunset products after a configured date

## Data Entities
Core entities: Products, Channels, Partners, Distribution Rules, Bookings, Market Demand Signals, Competitor Rate Feeds, Search-Trend Data, Effective-Dated Prices, Channel Performance, Partnership Terms

## Technical Considerations
- **DBSQL + Photon** for market sizing and demand analysis at scale
- **Mosaic AI** for geographic demand modeling, market-basket analysis, and incrementality measurement
- **Delta Sharing** for market and competitive data from Databricks Marketplace (weather, mobility, economic, search-trend)
- **Clean Rooms** for joint demand and partnership analytics with distribution and loyalty partners
- **Lakeflow** for integration of booking, market, demographic, and competitive data
- API-first design with versioned schemas (OpenAPI + NDC mappings); effective-dated product/price tables in Lakebase

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one product type (one-way flight or one room type), three channels (direct web, one OTA partner, one GDS), and one new-route or new-property demand forecast**. We do not need real NDC integration, real partner settlement, real payment splits, or user authentication. This will be an **open, public demo** where anyone can browse the catalog, evaluate a new route, and see channel mix update in real time.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Column 3: Consumer at the Center of Every Decision -- 3 cards

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(207, 'travel', 'Travel & Hospitality', 'ai_driven_booking', 'AI-Driven Booking',
 'Consumer at the Center of Every Decision', 3, 1,
'Create a simple **AI-driven consumer booking marketplace** similar to Airbnb but with the search-and-book experience of ChatGPT — so a traveler''s fuzzy intent ("a quiet 2-bedroom near downtown for my anniversary, under $300/night") returns a confirmed booking in 60 seconds, with the same three-tier search experience used in the Sample Booking App: standard filter search, natural-language search, and agent-based intent search.

## Application Type
Consumer-facing web + mobile + voice booking app that connects **Travelers/Guests** with **Hosts/Properties** through an **LLM Booking Agent** that handles ambiguity, integrates with availability, and completes the transaction — replicating the experience of speaking with a knowledgeable travel advisor at scale.

## Key Personas
- **Traveler/Guest**: End users who describe what they want in plain language, voice, or filters and expect the system to handle ambiguity
- **Host/Property Provider**: Property owners and operators whose inventory, pricing, and availability surface through the booking experience
- **Booking Engineer**: Internal staff (Chief Digital Officer, VP E-Commerce, Director of Digital Product) who tune agent prompts, register tools, and set safety guardrails

## Core Features Required

### Three Search Experiences (mirrors the Sample Booking App)

The application must support **three distinct search experiences** that share inventory, ranking, and personalization but differ in how the traveler expresses intent:

#### 1. Standard Search (Structured Filters)
Filter-based search with personalized ranking on top:
- Location, check-in/check-out dates, guests, price range, amenities, property type
- Personalized results ordering: collaborative filtering with implicit feedback (view, click, book)
- Contextual bandits for real-time ranking optimization across conversion × booking value × inventory steering
- Example: *"A loyalty Diamond member sees a different first page than a first-time visitor."*

#### 2. Natural Language Search (Text → Filters → Personalization)
Free-text queries parsed into structured filters and ranked by guest context:
- Example: *"quiet 2-bedroom near downtown this weekend under $200/night with parking"*
- LLM intent classification and slot-filling with session-based recommendation (recurrent models for within-session behavior)
- Combines with availability checking and personalized ranking
- Sub-second model inference as the guest refines the query

#### 3. Agent-Based Conversational Booking
Higher-level intent handled by a multi-step agent that asks clarifying questions and completes the transaction:
- Example: *"I want to stay near the Taylor Swift show next month — somewhere I can walk to"* — the agent infers the venue, the date range, and the walking radius
- Tool-calling chain: search → personalize → quote → hold → book → notify
- Multi-turn dialog with structured trip-card confirmation before any payment is taken
- Graceful fallback to the structured filter form if confidence is low
- Voice surface (phone or in-app) reuses the same tool-aware loop with verbal dollar read-back

### Direct-Booking Conversion Helpers
- **Intelligent Rate Comparison and Transparency**: total-cost view alongside OTA rates with loyalty-benefit valuation so the traveler sees the full direct-booking value
- **Booking Abandonment Recovery**: real-time detection of abandonment, classification of cause (price, comparison shopping, distraction), and contextual-bandit-selected recovery action within minutes — not 24 hours
- Stateful agent that can modify a booking ("change my Austin trip to Sunday") with full conversation replay and support-side override

## Data Entities
Core entities (matching the Sample Booking App): Users, Listings, Units/Rooms, Availability, Pricing, Fees/Taxes, Bookings, Payments, Refunds, Reviews, Wishlists, Messages, Conversations, Tool Calls, Holds, Replay Logs, Abandonment Events

## Technical Considerations
- **Mosaic AI Agent Framework** for the multi-step booking agent (search, fare-quote, hold, book, cancel as registered tools)
- **Unity AI Gateway** for low-latency model routing and cost management on high-volume inference
- **Mosaic AI Feature Store** for real-time guest features (loyalty, history, session)
- **Lakebase** for sub-millisecond availability and price serving to the booking engine
- **Delta Lake** guest history, booking patterns, and preference data
- **Unity Catalog** consent and preference governance across channels; PII redaction in conversation logs
- **Lakeflow** streaming session signals for personalization and abandonment detection

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **all three search experiences (standard / natural-language / agent), text chat only (no voice), USD only, and US listings/flights**. We do not need real payment processing, voice integration, cross-session memory, host management, property management, or user authentication. This will be an **open, public demo** where anyone can search via filters, type a natural-language query, or chat with the agent and see a confirmed (mock) booking with personalized ranking and reasoning attached — directly comparable to the Sample Booking App''s structure.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(208, 'travel', 'Travel & Hospitality', 'hyper_personalized_marketing', 'Hyper-Personalized Marketing',
 'Consumer at the Center of Every Decision', 3, 2,
'Deliver individually tailored messages, offers, and content across email, app, web, social, and on-property — driven by a real-time understanding of each guest''s preferences, journey stage, and lifetime value. Similar to Salesforce Marketing Cloud, but built on a unified guest profile that stitches identity across the fragmented T&H landscape (PMS, loyalty, booking engine, mobile app, restaurant and spa systems, multiple brands).

## Application Type
Marketing operations app that connects **Marketers** with a **Personalization Engine** built on a Unified Guest Profile, a Generative Content Studio, and a Real-Time Next-Best-Action decision service — so every traveler at every touchpoint sees the right message at the right moment.

## Key Personas
- **Marketer / CRM Lead**: Internal staff (CMO, VP CRM and Loyalty, VP Digital Marketing) who build journeys, approve AI-generated creative, and monitor campaign ROI
- **Brand Manager / Data Steward**: Internal staff who define creative guardrails and steward identity, consent, and PII governance

## Core Features Required

### Personalization Engine (4 Pillars)

The application must support **four distinct personalization pillars** sharing the same guest-360 substrate:

#### 1. Unified Guest Identity Resolution
An identity-resolved profile fused from every guest signal — across brands and channels:
- Probabilistic identity matching (gradient boosting on match features)
- Graph-based entity resolution (connected-component detection)
- Privacy-preserving matching (tokenized PII) and incremental resolution as new records arrive
- Cross-brand recognition: a guest who stays at a luxury brand and a select-service brand within the same portfolio is recognized as one person
- Example: *"Top 3 segments for guest 12345: business commuter, weekend beach, family reunion"*

#### 2. Churn Prediction and Retention Campaigns
Predict which loyalty members and repeat guests are at risk and intercept them before they defect:
- Survival analysis for time-to-next-booking; gradient boosting for churn probability
- Segmentation by churn driver (price, service issue, competitor defection)
- Reinforcement learning for optimal retention offer selection
- Triggered before silence becomes departure — early-stage disengagement is the highest-ROI intervention point

#### 3. Generative Multilingual Content Personalization
LLM- and image-gen-driven creative that respects brand guardrails and the guest''s language:
- Email subject lines, body copy, push notifications, and hero imagery in the guest''s preferred language
- Real-time content personalization (under 100 ms): website, app, and email assemble dynamically from modular components
- Brand-guideline prompt engineering for tone and visual consistency
- Human approval flow before send; one-click variant generation for A/B tests

#### 4. Multi-Touch Attribution Modeling
Allocate marketing credit across channels, campaigns, and touchpoints — not just last click:
- Shapley-value attribution (cooperative game theory) and media-mix Bayesian regression
- Incrementality testing via matched-market experiments
- Cross-device identity stitching that survives third-party-cookie deprecation
- Budget-reallocation simulator with predicted booking impact

### Journey Orchestration
- Visual journey builder with conditional branches and frequency caps
- Trigger library (booking, status change, milestone, churn-risk threshold) with arbitrary fan-out
- Live cohort dashboards with holdouts for causal-impact measurement

## Data Entities
Core entities: Guests, Identities, Consents, Profiles, Loyalty Members, Journeys, Creatives, Sends, Engagements, Conversions, Holdouts, Attribution Touchpoints

## Technical Considerations
- **Mosaic AI** for lookalike modeling, churn prediction, content personalization, and attribution
- **Mosaic AI Feature Store** for real-time guest features in campaign targeting and content decisioning
- **Lakeflow** for multi-channel engagement-data ingestion and identity resolution
- **Unity Catalog** for marketing consent, GDPR/CCPA compliance, and immutable audit trail
- **Clean Rooms** for privacy-preserving audience matching with advertising and partnership platforms
- **Delta Lake** for the unified profile substrate; **Lakebase** for low-latency NBO serving

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one channel (email), one journey ("welcome a new loyalty member" OR "intercept an at-risk Diamond member"), and three creative variants**. We do not need real ESP integration, image generation, multi-channel orchestration, or user authentication. This will be an **open, public demo** where anyone can pick a sample guest and watch the platform build their 360 view, score churn risk, generate three on-brand email variants, and pick the next best offer.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(209, 'travel', 'Travel & Hospitality', 'agentic_customer_service', 'Agentic Customer Service',
 'Consumer at the Center of Every Decision', 3, 3,
'Deploy AI agents that handle guest inquiries, complaints, and service requests autonomously — from pre-arrival questions through on-property needs to post-stay recovery — escalating to humans only when empathy, judgment, or authority thresholds are exceeded. Similar to Intercom''s Fin AI, but with multi-step agents that can check availability, process changes, issue compensation, and coordinate across PMS, CRS, and loyalty in a single interaction.

## Application Type
Consumer-facing chat + voice surface + back-office agent monitoring console that connects **Guests** with an **Agent Orchestration Layer** to resolve issues 24/7 across chat, voice, email, and in-app — delivering the rare trifecta of better, faster, and cheaper service.

## Key Personas
- **Guest**: End users who ask "where''s my bag" or "I need a refund" and expect a real answer immediately
- **Customer Care Lead**: Internal staff (VP Guest Experience, VP Contact Center Operations, Director of Digital Guest Experience) who watch the agent fleet, spot regressions, and intervene on hot escalations

## Core Features Required

### Agentic Service Capabilities (4 Agent Functions)

The application must support **four distinct agent functions** that share guest context and policy knowledge:

#### 1. Autonomous Guest Service Agent
Always-on multi-step agent that handles the full spectrum of requests across chat, voice, email, and in-app:
- Tool-calling into PMS, CRS, loyalty, and payment systems to *take action*, not just provide information
- Intent classification with slot-filling for structured request handling (room change, booking modification, amenity request, complaint)
- Retrieval-augmented generation for property-specific knowledge with citations in every answer
- Sentiment-aware tone calibration; agent knows its limits and hands off with full context preserved
- Example: *"Resolve 60% of contact-center volume autonomously while keeping CSAT flat or higher"*

#### 2. Proactive Service Recovery Agent
Detects service failures from operational signals and recovers *before* the guest complains:
- Streaming detection across housekeeping, room service, maintenance, and guest-journey events
- Guest-impact severity scoring (failure type × guest value × loyalty tier)
- Contextual-bandit recovery-action selection and calibrated compensation sizing
- Multi-channel delivery (in-app, SMS, front-desk alert) — proactive recovery yields higher post-recovery satisfaction than reactive
- Example: *"Housekeeping running 45 min late on a Diamond member''s room — issue apology + 5,000 points before check-in"*

#### 3. Voice AI for Phone Service
Natural voice handling for inbound phone — reservation inquiries, modifications, loyalty questions:
- Domain-fine-tuned speech recognition handling accents, background noise, and conversational repair
- Multi-intent extraction ("change my room *and* ask about the spa")
- Sub-2-second response latency; seamless transfer to human with context preserved
- 24/7 coverage without proportional staffing increase

#### 4. Multilingual & Post-Stay Feedback Intelligence
- **Multilingual Guest Communication**: neural machine translation with hospitality-domain fine-tuning and cultural adaptation (e.g., Japanese keigo) across chat, email, app, SMS
- **Post-Stay Feedback Intelligence**: aspect-based sentiment analysis on surveys, TripAdvisor, Google, Booking.com, social — extracts actionable topics and routes them to the team that can fix the issue
- Trend detection (statistical process control) distinguishes one bad review from an emerging quality pattern at a specific property

### Quality & Compliance Monitor
- Auto-scores every interaction on tone, accuracy, and regulatory phrases
- Flags low-scoring sessions for coaching; audit trail with timestamped citations of policy used in answers
- Human picks up escalated cases with agent''s reasoning prepopulated

## Data Entities
Core entities: Guests, Conversations, Intents, Tools, Sub-Agent Runs, Service Failures, Sentiment Events, Escalations, QA Scores, Knowledge Articles, Reviews, Survey Responses, Languages

## Technical Considerations
- **Mosaic AI Agent Framework** for multi-step service agents with PMS / CRS / loyalty / payment tool integration
- **Mosaic AI Agent Evaluation** for testing agent accuracy and escalation behavior before production deployment
- **Unity AI Gateway** for model routing and cost management on high-volume inference
- **Unity Catalog** for agent-action audit trails and PII governance with retention policies
- **Delta Lake** for interaction history, service-request logs, resolution outcomes, and review analytics
- **Databricks Apps** for the agent monitoring and escalation dashboard; RAG over policy/knowledge in Delta

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **chat channel only, three specialist sub-agents (rebooking/room-change, refund-eligibility, baggage status or housekeeping recovery), and English language**. We do not need voice integration, real human-handoff workflow, real booking-system integration, or user authentication. This will be an **open, public demo** where anyone can chat with the agent fleet, watch sub-agents pass context to each other, see proactive recovery trigger from a simulated failure, and observe sentiment-driven escalation indicators in real time.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- TRAVEL & HOSPITALITY -- CERTIFIED OUTCOME-MAP USE CASES (4 new cards)
-- =============================================================================
-- These four Aurelia Collection apps are net-new Travel cards added to the
-- outcome-map columns. They are marked is_certified = TRUE (see the UPDATE at
-- the end of this block) so they pin to the top of their columns and render a
-- "Certified" badge in the workshop flow and on the workflow steps.
-- =============================================================================

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(210, 'travel', 'Travel & Hospitality', 'customer_360_audience_builder', 'Customer 360 Audience Builder',
 'Consumer at the Center of Every Decision', 3, 4,
'Create a data-driven, intent-based audience segmentation and targeting platform for large hotel brands to build, analyze, and activate customer segments based on comprehensive guest profiles, predictive analytics, and localized external market signals. Similar to how HubSpot or Salesforce Marketing Cloud build audiences, but purpose-built for hospitality and driven by real-world market signals.

## Application Type
Enterprise B2B analytics and audience management platform that enables **Marketing Teams, Revenue Managers, and CRM Analysts** at large hotel brands to discover opportunities driven by real-world market signals, understand guest behavior patterns, and create targeted audiences for personalized marketing campaigns. The experience is *intent-driven* — users arrive with a goal (*"I want to build a campaign"*, *"Show me opportunities"*) and the platform guides them to action, rather than presenting a dashboard of disconnected tools.

## Key Personas
- **Marketing Manager** (primary): Enters via *"Build a Campaign"* intent. Builds audience segments for campaign targeting, reviews AI recommendations, saves audiences for activation. Needs intuitive, visual tools similar to Mailchimp or HubSpot — not SQL or technical interfaces.
- **Revenue Manager**: Enters via *"Find Biggest Opportunities"* intent. Identifies high-value segments, analyzes booking patterns and revenue potential, optimizes pricing strategies by segment.
- **CRM Analyst**: Enters via Insights or Visual Builder directly. Explores customer data, validates segmentation models, creates complex multi-criteria audience rules, monitors segment health metrics.

## Design Philosophy: Intent-Based Navigation
The navigation follows the campaign lifecycle, not the feature set. Users think in terms of outcomes — the UI organizes around what they want to accomplish, in the order they naturally work:

1. **Overview** — *"What''s happening? What should I pay attention to?"*
2. **Recommend** — *"What should I do about it?"*
3. **Build Audience** — *"Let me create and refine my target audience."*
4. **Insights** — *"Help me understand my customers deeper."*
5. **Experiment** — *"How do I test and validate my strategy?"*

This replaces feature-based navigation (Dashboard → Segments → Audience Builder → Next Best Action → Analysis → A/B Testing) which required users to know which tool to use rather than guiding them through a workflow.

## Core Features Required

### Overview: Intent-Based Landing
The landing page is not a dashboard. It presents three clear paths, each leading to a purpose-driven workflow:

- **Build a Campaign**: Start from an objective and let AI recommend the optimal audience, channel mix, and timing. Leads to the Recommend page.
- **Explore Market Signals**: See external signals driving revenue opportunities in your markets. Scrolls to the Market Signals feed.
- **Find Biggest Opportunities**: Discover high-value customer segments and untapped revenue from existing guest data. Leads to the Insights page.

### Localized External Market Signals
A feed of real-world external signals that create revenue opportunities, each paired with a suggested action and a direct path to build an audience:
- **Weather**: Heat waves, early snowfall, storm disruptions — driving resort/leisure demand shifts
- **Local Events**: Conferences, festivals, sporting events — driving business/leisure traveler surges in specific markets
- **Airline Routes**: New routes, added capacity, seasonal expansions — signaling emerging demand in specific cities

Each signal includes: signal type, location, and description; an opportunity explanation connecting the signal to revenue impact; estimated revenue impact; urgency level (High/Medium/Low); a plain-language suggested action; and a structured filter set mapping to real segments and locations (e.g., *Segment = Leisure Families* + *Segment = Luxury Seekers* + *Market = Miami, FL* + *Property Type = Resort*). **"Act on This"** opens the Audience Builder pre-loaded with the full filter set — multiple segments connected with OR logic; location and other filters use AND.

### Quick Metrics
Compact summary bar showing Total Customers, Active Audiences, Annual Revenue, and Avg Customer LTV — all computed from live data, not hardcoded.

### Recommend: AI-Powered Next Best Action
AI recommendation engine that suggests the optimal audience and campaign strategy to maximize revenue given constraints.
- **Input Parameters**: Budget, Timeframe (30/60/90 days), Channel Costs (email, mobile push, direct mail)
- **Top Recommendation**: target audience name and size, predicted revenue range with confidence interval, expected conversion rate, recommended channel mix chart, confidence score
- **Explainability on Hover**: hovering a recommendation reveals *why* this audience was recommended — booking-propensity thresholds, LTV context, historical channel response rates, audience-size validity, revenue-confidence basis, and full AI explanation text. The title carries a dotted underline to signal more detail is available.
- **Alternative Recommendations**: ranked next-best options with the same hover explainability
- **Action Buttons**: *"Build This Audience"* (pre-loads the builder) and *"Activate Campaign"* (prominent green button → *"Coming soon — audiences exported to Lakebase for downstream marketing system activation."*)

### Audience Builder Interface
Follows modern marketing-tool UX (Mailchimp, HubSpot, Salesforce Marketing Cloud). Four approaches, unified by a live preview panel that updates in real time. The builder accepts pre-configured filters via URL parameters (multi-filter from signals; single-segment from cards and recommendations).

#### Approach 1: Pre-Built Segments
Visual segment gallery of K-means segments as clickable cards (name, description, size, avg LTV). Clicking loads it as a filter in the Visual Builder.

#### Approach 2: Visual Audience Builder (Rule-Based)
Three-panel layout:
- **Left — Filter Library** organized by category (Booking Behavior, Value & Spend, Predictive Scores, Segments, Demographics, Location, Timing). Clicking a filter adds it to the canvas.
- **Center — Active Filters Canvas**: editable cards with operator dropdowns (>, >=, <, <=, =) and value inputs; AND/OR connector badges (clickable to toggle); per-filter remove and *Clear All*.
- **Right — Live Audience Preview** (300ms debounced): Predicted Revenue (primary), Audience Size with reach %, Avg LTV, Conversion Rate, a Quality Score gauge (0–100), Matched Segments count, and contextual Smart Suggestions (e.g., *"Consider adding ''Last Stay > 180 days'' to sharpen at-risk definition"*).

Preview logic: segment filters apply as OR (union); customer-level filters apply as selectivity ratios within matched segments; location filters apply additional geographic selectivity. More filters = smaller, more targeted audience with higher quality and conversion.

#### Approach 3: Natural Language Audience Builder
Search-style input where non-technical marketers describe their audience in plain language. The system extracts filters with per-filter confidence scores and an overall confidence badge, then *"Apply These Filters in Visual Builder"*. Keyword recognition: *"high-value"* → LTV; *"haven''t booked"*/*"lapsed"* → recency; *"at risk"* → churn risk; *"business"*/*"luxury"*/*"family"* → segment; *"loyal"* → loyalty tier; *"upgrade"* → upgrade propensity.

#### Approach 4: Audience Templates
Pre-built templates by objective — Acquisition (New Guest Acquisition); Retention (Win-Back, Loyalty Tier Advancement); Upsell (Premium Upsell); Seasonal (Summer Family Getaway, Holiday Season Push). Each shows name, color-coded objective badge, description, typical size range, expected revenue range, and filter tags.

### Save & Activate Flow
- **Save Audience**: dialog with name input and preview metrics; persists to Lakebase as a saved audience.
- **Activate Campaign**: after saving, a green button → *"Campaign activation coming soon — audiences are exported to Lakebase for downstream marketing system activation."* This is the designed integration point for downstream execution systems.

### Customer Insights
Unified tabbed view (replacing separate Segments and Analysis pages):
- **Segments Tab**: sortable gallery of K-means segments (size, avg LTV, booking frequency, churn rate, top channel) with a *"Build Audience"* button.
- **Analytics Tab**: live-data charts — Segment Composition (donut), Revenue by Segment (bar), Propensity Distribution (bar), Channel Performance (bar).

### A/B Testing Framework
Experimentation with statistical-rigor guardrails. Persistent best-practices banner: **Hypothesis First → Size Correctly → Don''t Peek → Practical Significance**.
- **Create New Test Wizard**: required Hypothesis; Test Type (audience split, channel mix, message variant, offer test); KPI selection; a Power Analysis calculator (baseline rate, minimum detectable effect, confidence, power → required sample size, runtime, 7-day minimum); variant configuration; configurable holdout group.
- **Test Cards**: 95% confidence intervals per variant; sample-progress bar; day counter; peeking warning (<7 days inflates false positives from 5% to ~30%); underpowered-result warning; winner declaration with absolute/relative lift and projected annual revenue. *"Call Winner"* enables only when sample size, ≥95% significance, and 7-day runtime are all met.
- **Action Dialogs**: Full Analysis (p-value, lift, power, CIs, business impact, recommendation); Monitoring Dashboard (days elapsed, sample progress, significance); Review & Launch (pre-launch checklist, anti-peeking education).

## Customer 360 Data Foundation
Comprehensive guest profiles with **Behavioral Metrics** (booking history, property preferences, channel behavior, spend patterns), **Predictive Scores** (LTV with confidence intervals; propensity to book in 30/60/90 days, upgrade, cross-sell; churn risk; FRM scores), and **Segmentation Models** (K-means → 6 segments: Business Travelers, Leisure Families, Luxury Seekers, Budget Conscious, Road Warriors, Occasional Guests).

## Data Entities
Core entities: Customers, Bookings, Properties, Segments, Propensity Scores, Campaigns, Audiences, Revenue Predictions, Channel Preferences, Behavioral Events, A/B Tests, Test Variants, Test Results, Market Signals, Markets/Locations

## Technical Considerations
- **Lakebase PostgreSQL** holds all application state (segments, audiences, tests, templates, revenue data); schema scoped per app instance for isolation; idempotent DDL and count-check seed patterns; Service Principal owns all objects
- **Databricks App** (full-stack) hosting the finder, recommendation, builder, insights, and experiment views; every API endpoint returns mock data when Lakebase is unavailable so the UI always renders
- **Genie Space** over the Lakebase tables for read-side natural language; **AI Agents** for write-side audience actions; **Mosaic AI** for LLM calls
- Data flow: Market Signal or AI Recommendation triggers audience intent → builder translates filters to a preview query → save persists a named, versioned audience → activate (future) exports to downstream systems
- If using the Databricks Python SDK for Lakebase OAuth credentials, pin a recent version (e.g. `databricks-sdk>=0.81`) — app runtimes pre-install an older SDK lacking the Postgres credential API

## Scope Constraints
**Keep it simple** and focus on intent-driven audience building, revenue prediction, market-signal integration, and rigorous A/B testing for a **single hotel brand with US-based properties**. In scope: intent-based navigation, localized market signals with structured filters, 6 pre-computed K-means segments, all four audience-building approaches, location-aware filtering, the revenue-prediction live preview, Next Best Action with hover explainability, audience persistence, and the A/B testing framework with guardrails. Out of scope for v1: real campaign execution/activation, live external signal APIs, multi-brand support, international properties, real-time behavioral tracking, and custom ML model training.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(211, 'travel', 'Travel & Hospitality', 'cross_sell_upsell_optimization', 'Cross Sell/Upsell Optimization',
 'Diversified Revenue Growth', 2, 4,
'Stand up a **Pre-Arrival Revenue Composer** for luxury hotel groups: a Databricks App backed by Lakebase, where a commercial / revenue manager works the perishable window between booking and check-in — finding arrivals with headroom to spend, composing the right room + dining + spa/experience bundle, and queueing each offer on the right send day. Affinity scoring is a column on a Lakebase table, not the centerpiece — the demo is the *composing workflow*, not the model.

## Intent-First Experience
The app must open with a problem prompt, not a dashboard; grids and bundle cards appear only as the resolution of that intent. Opening prompts:
- *"Who is arriving in the next 14 days with headroom to spend?"*
- *"Which of those send windows close this week?"*

The opening view must also make the value obvious to a first-time user who has not seen any deck: a one-line value statement rendered prominently (*"The pre-arrival window is perishable — compose the bundle while the guest is still planning the stay."*) and a running value metric that grows as the manager works — incremental bundle revenue queued and accepted to date.

## Application Type
Internal commercial app connecting the **Commercial / Revenue Manager** with a Genie-powered assistant to find high-intent arrivals, compose priced bundles, and queue offers — replacing the arrivals-report export and the one-size-fits-all pre-arrival email.

## Brand Persona
**Brand: Aurelia Collection** (premium, default) — a small luxury hotel group (12 properties, US + Caribbean). Perception goals: understated, anticipatory, never pushy. Offer principles the app MUST enforce:
- **Fewer, highly relevant offers** — max 3 active offers per guest per day; the engine suppresses anything below a relevance threshold rather than filling slots.
- **No spray-and-pray** — no property-wide blasts; every offer is tied to a named guest context and at least one driving signal.
- **Price with dignity** — discounts are framed as member/guest benefits (*"residents'' rate"*, *"suite welcome"*), never *"percent-off"* banners; floor prices respected.
- **Tone** — concise, warm, concrete (*"Your table at Ember is held for the evening you arrive"*), no exclamation marks, no urgency theatrics.

*Swapping personas*: for a value/EDLP operator (e.g. an economy roadside chain), invert the dials — volume and price-lead messaging are fine, offer caps loosen, tone is friendly-direct — and efficiency per offer sent becomes the headline metric.

## Key Personas
- **Commercial / Revenue Manager** (primary): Brand- or regional-level staff who open the app every morning, scan the 14-day horizon, and decide which guests get a composed bundle. Owns the demo.
- **Property General Manager** (secondary): Reviews queued offers for their hotel and flags anything off-brand.

## Core Features Required
The application must support three workflows the revenue manager runs in sequence:

### 1. Find the Arrivals With Headroom
Resolves the opening prompt: an upsell-propensity finder over bookings arriving in the next 14 days.
- Ranked by propensity and headroom (booked amount vs. comparable full-stay spend), with a send-window countdown
- One-click drill-down to guest history, booking, and category affinities
- Example: *"Elena Marsh, arriving Sat Jun 20 at Aurelia Key Biscayne, 4 nights room-only at 2,840 — top-decile spa and dining affinity, send window closes Tue Jun 16"*

### 2. Compose the Bundle
Auto-suggests 1–2 room + dining + spa/experience combinations per arrival, with suggested price.
- Each renders a **"Why this bundle"** explanation: affinity drivers, external signal(s), brand rule applied, and a cannibalization note (anything the guest buys unprompted is held, not discounted)
- Manager swaps components; price re-computes, respecting `discount_floor_pct` from `brand_settings`; approving writes a `bundles` row
- Example: *"For Elena: Oceanfront Suite upgrade + held table at Ember on arrival night + thermal suite Sunday — price 612, framed as a suite welcome"*

### 3. Queue the Offer
The execute step: commit the approved bundle into the pre-arrival comms sequence.
- One click writes a `bundle_offers` row and a `comms_queue` record with recommended `send_date` and a one-line timing reason (delivery simulated)
- Send-day logic weighs booking-to-arrival gap, signal firm-up timing, and brand cadence cap; queue tracks queued / sent / accepted
- Example: *"Offer 0114 for Elena queued — send Tue Jun 16: forecast firms up Monday, landing 4 days pre-arrival, inside her planning window"*

## External Signals
Widen the aperture beyond first-party history, scoped to each stay:
- **Weather forecast** for the stay dates — rain on an arrival weekend shifts suggestions from the catamaran toward the thermal suite
- **Local events** during the stay — a food-and-wine festival raises demand for late dining and transfers
- **Flight arrival times** where known — a 9:40pm landing favors a held late supper over an arrival-night excursion

Signals may be synthetic (*"art of the possible"*) but must visibly drive composition and send-day timing and appear by name in every explanation.

## Explainability Requirements
Every suggested bundle renders a **"Why this bundle"** explanation naming the guest context, driving signal(s), and brand rule. Example:

> "Why this bundle: Elena booked spa within a day of arrival on 3 of her last 4 stays (spa affinity 0.87). The Jun 20–22 forecast shows rain Sunday, favoring the thermal suite over the catamaran. Brand rule: her only active offer this week (cap 3 per day); 612 stays above the suite floor. Cannibalization note: she reserves the tasting menu unprompted — dining is a held table, not a discounted item."

## Data Entities (Lakebase tables, all in one schema)
- `guests` — guest_id, name, loyalty_tier, lifetime_spend, stay_count, preferences
- `bookings` — booking_id, guest_id, property_id, arrival_date, departure_date, room_type, booked_amount, flight_arrival_time (nullable)
- `products` — product_id, property_id, category (room_upgrade / dining / spa / experience), name, list_price, capacity_per_day
- `affinity_scores` — guest_id, category, score, top_drivers, scored_at (refreshed nightly; ML out of scope)
- `bundles` — bundle_id, booking_id, product_ids, suggested_price, rationale, status (draft / approved)
- `bundle_offers` — offer_id, bundle_id, guest_id, offer_price, valid_through, status (queued / sent / accepted / declined)
- `comms_queue` — comms_id, offer_id, guest_id, channel, send_date, send_day_reason, status (the execute action writes here)
- `brand_settings` — brand_id, max_offers_per_guest_per_day, discount_floor_pct, tone_profile, relevance_suppression_threshold (the persona is data)

## Technical Considerations
- **Lakebase** (Provisioned or Autoscaling) for all tables — single Postgres schema, no Lakehouse dependency
- **Databricks App** (FastAPI + React) hosting the finder, composer, and queue views
- **Genie Space** over the Lakebase tables for read-side natural language; **AI Agents** with tool-calling for write-side actions (compose, queue); **Mosaic AI** for LLM calls
- Nightly job refreshes `affinity_scores` — simple Python scoring for the demo; external signals are seeded synthetic data served through the same app layer
- If using the Databricks Python SDK for Lakebase OAuth credentials, pin a recent version (e.g. `databricks-sdk>=0.81`) — app runtimes pre-install an older SDK lacking the Postgres credential API

## Scope Constraints
**Keep it simple** and focus only on the bare minimum to support one brand (Aurelia Collection), 2–3 properties, 20–30 synthetic upcoming arrivals, and the three workflows above. We do not need real PMS/booking-engine integration, payments, real email delivery, multi-tenant auth, or affinity-model training — `affinity_scores` is pre-seeded. Internal-tooling app: single-tenant, one role, no SSO. Out of scope for v1 (phase-2): real comms delivery with open/accept tracking, in-stay and post-stay offer windows, dynamic pricing for bundle components, and loyalty-points payment/redemption flows.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(212, 'travel', 'Travel & Hospitality', 'personalized_ancillaries_offer', 'Personalized Ancillaries Offer',
 'Diversified Revenue Growth', 2, 5,
'Stand up an agentic **Ancillary Revenue Copilot** for a luxury hotel group: a Databricks App backed by Lakebase, where an Ancillary Revenue Manager sees which inventory expires worthless at end of day — spa slots, upgrades, dinner covers, late checkouts — and matches it to the right guests on property. The matching logic is a scoring function behind a Lakebase table — the demo is the *workflow*, not the engine.

## Intent-First Experience
The app must open with a problem prompt, not a dashboard; grids and charts appear only as the resolution of that intent. Opening prompts the UI leads with:
- *"Where is revenue expiring today?"* (primary — resolves into the opportunity view of Workflow 1)
- *"Which guests on property tonight should see an offer?"*

The opening view must also make the value obvious to a first-time user who has not seen any deck:
- A one-line value statement rendered prominently: *"Unsold inventory expires worthless at end of day — anything recovered above zero is net gain."*
- Value metrics resolved beside the intent: today''s revenue at risk, and a running recovered / in-play total (the dollar value of offers sent and accepted today) that grows as the manager works — the app''s delivered value, always on screen.
- A compact *"Why this matters"* note (an expander is fine): the perishable-inventory economics in 2–3 sentences with illustrative numbers (15–20 perishable units per property per day; recovered revenue carries no acquisition cost — it is pure recovery).

## Application Type
Internal revenue-operations app connecting the **Ancillary Revenue Manager** with a Genie-powered assistant to find expiring inventory, match it to in-house guests, and commit offers without leaving the screen. Replaces *"pull the spa schedule, the upgrade report, and the restaurant book, then guess."*

## Brand Persona
**Brand: Aurelia Collection** (premium, default) — a small luxury hotel group (12 properties, US + Caribbean). Perception goals: understated, anticipatory, never pushy. Offer principles the app MUST enforce:
- **Fewer, highly relevant offers** — max 3 active offers per guest per day; the engine suppresses anything below a relevance threshold rather than filling slots.
- **No spray-and-pray** — no property-wide blasts; every offer is tied to a named guest context and at least one driving signal.
- **Price with dignity** — discounts are framed as member/guest benefits (*"residents'' rate"* on a spa slot, *"suite welcome"* on an upgrade), never percent-off banners; floor prices respected.
- **Tone** — concise, warm, concrete (*"A poolside cabana is reserved for you this afternoon"*), no exclamation marks, no urgency theatrics.

*Swapping personas*: for a value/EDLP operator (e.g. an economy roadside chain), invert the dials — volume and price-lead messaging are fine, offer caps loosen, tone is friendly-direct — and efficiency per offer sent becomes the headline metric.

## Key Personas
- **Ancillary Revenue Manager** (primary): Property-level owner of non-room revenue; opens the app every morning, sees what expires today, decides which offers go out. Owns the demo.
- **Guest Experience Manager** (secondary): Reviews outgoing offers, vetoes anything off-brand, watches acceptance patterns over time.

## Core Features Required
The application must support three workflows the Ancillary Revenue Manager runs in sequence each day:

### 1. Surface Expiring Revenue
Resolves the opening intent: one opportunity view of every unit that expires worthless today, with revenue-at-risk inline.
- Sorted by revenue-at-risk weighted by time-to-expiry; grouped by inventory type with a daily recoverable total
- One-click drill-down from any unit to its details and candidate guests
- Example: *"Aurelia Key West, 10:40am: 4 spa slots (5pm–7pm, $190 each), 2 Gulf-view upgrades ($140 each), 6 dinner covers at Solana, 3 late checkouts — $1,920 expiring today."*

### 2. Match Guests & Recommend Offers
For each matched guest the manager sees the top-3 offers across all expiring inventory, each with a rendered **"Why this offer"** explanation.
- Every recommendation names the guest context, the driving external signal, and the brand rule applied
- Offers below the relevance threshold are suppressed, and the UI says so (*"third slot suppressed — relevance too low"*)
- Example: *"Suite 412, the Hale party: 5:30pm couples massage at the residents'' rate — spa on two of their last three stays, and rain forecast from 2pm."*

### 3. Execute & Track Offers
The manager approves an offer and the app commits it as a row in the `offer_decisions` table with status sent (downstream delivery is simulated).
- Each committed row records guest, unit, offer terms, the explanation string, and a timestamp
- A tracking panel shows status (sent / accepted / declined / expired), running recovered revenue, and an end-of-day recovered-vs-expired view
- Example: *"3:10pm: Hale party accepted the 5:30pm spa offer ($190 recovered). Day so far: $620 recovered of $1,920 at risk."*

## External Signals
The app widens the data aperture beyond first-party stay history. Signals may be synthetic (*"art of the possible"*) but must visibly drive recommendations and appear in explanations:
- **Weather** — a rainy afternoon raises spa and in-room dining relevance
- **Local events** — a gallery night or regatta nearby shifts late-checkout and dining demand
- **Same-day flight arrivals** into the property''s city — late arrivals match late checkout and in-room dining

## Explainability Requirements
Every recommendation renders a **"Why this offer"** explanation naming: the guest context used, the driving external signal(s), and the brand-persona rule applied. Example, rendered verbatim:

> "Why this offer: The Hale party (Suite 412, in-house through Thursday) booked spa on two of their last three stays. Rain is forecast in Key West from 2pm. Offered as the residents'' rate per Aurelia pricing rules — offer 2 of 3 for this guest today."

## Data Entities (Lakebase tables, all in one schema)
- `properties` — property_id, name, city, region, room_count, outlets (array)
- `guests` — guest_id, name, loyalty_tier, stay_history_summary, preferences (array), contact_opt_in
- `stays` — stay_id, guest_id, property_id, room_number (e.g. "Suite 412", used in explanations), room_type, check_in, check_out, party_size, on_property_now
- `inventory_units` — unit_id, property_id, unit_type (spa_slot, room_upgrade, dinner_cover, late_checkout), description, expires_at, list_price, floor_price, status
- `external_signals` — signal_id, property_id, signal_type (weather, local_event, flight_arrivals), signal_date, payload, relevance_note
- `offer_decisions` — offer_id, guest_id, unit_id, offer_price, framing (the brand-toned label, e.g. "residents'' rate"), explanation, status (sent / accepted / declined / expired), created_at; denormalize guest_name and unit_description for display convenience
- `brand_settings` — brand_id, max_offers_per_guest_per_day, discount_floor_pct (max discount depth below list; floor_price is the hard floor), tone_profile, suppression_threshold (the persona is data, not prose)

## Technical Considerations
- **Lakebase** (Provisioned or Autoscaling) for all tables — single Postgres schema; real-time inventory reads and offer-decision writes
- **Databricks App** hosting the opportunity, recommendation, and tracking views
- **Genie Space** over the same tables for read-side natural language; **AI Agents** for write-side actions (compose the offer, commit the `offer_decisions` row) via a thin API layer over Lakebase; **Mosaic AI** for LLM calls including brand-toned offer copy
- A scheduled job refreshes `external_signals` and expires unsold `inventory_units` at end of day
- If using the Databricks Python SDK for Lakebase OAuth credentials, pin a recent version (e.g. `databricks-sdk>=0.81`) — app runtimes pre-install an older SDK lacking the Postgres credential API

## Scope Constraints
**Keep it simple** and focus only on the bare minimum to support one brand (Aurelia Collection), 2–3 properties, roughly 25 synthetic in-house guests, 15–20 expiring inventory units per day, and the three workflows above. We do not need real PMS or spa-booking integration, payments, real delivery channels (delivery is simulated by the status field), multi-tenant authentication, or model training. Out of scope for v1 (phase-2): real channel delivery and guest replies, loyalty accrual/redemption mechanics, dynamic pricing of the inventory itself, cross-property offer routing, and retuning the relevance threshold from acceptance history.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(213, 'travel', 'Travel & Hospitality', 'custom_loyalty_based_offers', 'Custom Loyalty-Based Offers',
 'Diversified Revenue Growth', 2, 6,
'Stand up a **Loyalty Offer Studio** for hotel member programs: a Databricks App backed by Lakebase, where a Loyalty Program Manager reviews which Aurelia Circle members need attention, calibrates tier- and lifecycle-aware perks, multipliers, and redemption specials, and launches each with its point-liability impact priced in. The demo is the weekly calibration *workflow*, not the model — lifecycle scoring is just a column on a Lakebase table. Redemptions steer toward perishable unsold inventory: liability burn-down and revenue recovery together.

## Intent-First Experience
The app opens with a problem prompt, not a dashboard; segment grids and liability charts appear only as the resolution of that intent.
- *"Which members need attention this week?"*
- *"Where is point liability building, and which redemptions burn it down against unsold inventory?"*

The opening view must also make the value obvious to a first-time user who has not seen any deck: a one-line value statement rendered prominently (*"The best redemption delights a member and fills a night that would otherwise have gone unsold."*) and running value metrics that grow as launches go out — point liability released and unsold nights recovered to date.

## Application Type
Internal brand-level app connecting the **Loyalty Program Manager** with a Genie-powered assistant to triage segments, calibrate offers, and launch them — the CFO-facing liability number visible at every step. Replaces exporting CRM lists into spreadsheets and emailing finance about the liability line.

## Brand Persona
**Brand: Aurelia Collection** (premium, default) — a small luxury hotel group (12 properties, US + Caribbean) whose member program is **Aurelia Circle** (tiers: Member / Silver / Gold / Patron). Perception goals: understated, anticipatory, never pushy. Offer principles the app MUST enforce:
- **Fewer, highly relevant offers** — max 3 active offers per member per day; the engine suppresses anything below a relevance threshold rather than filling slots.
- **No spray-and-pray** — no program-wide blasts; every offer is tied to a named member context and at least one driving signal.
- **Price with dignity** — redemptions and multipliers are framed as member privileges (*"a Gold redemption privilege"*, *"your Patron anniversary stay"*), never percent-off banners; floor prices respected.
- **Tone** — concise, warm, concrete (*"An ocean-view night at Key West is held for your points this June"*), no exclamation marks, no urgency theatrics.

*Swapping personas*: for a value/EDLP operator (e.g. an economy roadside chain), invert the dials — volume and price-lead messaging are fine, offer caps loosen, tone is friendly-direct — and efficiency per offer sent becomes the headline metric.

## Key Personas
- **Loyalty Program Manager** (primary): Brand-level owner of Aurelia Circle; opens the app every Monday to see which segments are drifting, where liability concentrates, and what launches this week. Owns the demo.
- **CRM Analyst** (secondary): Defines lifecycle segment rules, watches response curves after each launch, tunes relevance thresholds.

## Core Features Required
The application must support three workflows the program manager runs in sequence each week:

### 1. Triage Member Segments
Resolves the opening intent: at-risk and opportunity segments, dominant driver inline.
- Segments crossed by lifecycle stage (acquisition, engagement, at-risk, reactivation) and tier; sortable by expiring points, days since last stay, liability concentration
- Drill-down to member: stay history, point balance, past offer responses
- Example: *"Gold / at-risk: 214 members, median 41,000 points expiring within 90 days, no stay in 7 months; driver: post-holiday booking lapse"*

### 2. Calibrate the Offer
The assistant drafts a calibrated offer; the manager tunes it in place.
- Genie agent proposes the perk, multiplier, or redemption special from `perk_catalog`, steering redemptions toward perishable unsold inventory
- Every draft renders **"Why this offer"** plus an inline liability-impact check — points burned, USD released, inventory recovered — re-priced live as dials move
- Example: *"For Gold / at-risk: a 30,000-point redemption special on unsold Riviera Maya suite nights, June 18–25. Projected: 6.4M points burned, 64,000 USD released, 38 unsold suite nights recovered."*

### 3. Launch and Measure
The execute step.
- Approval writes a row to `offer_launches` (segment, terms, liability projection, launch window); delivery is simulated
- Post-launch: redemptions, points burned versus projection, stays generated; the assistant answers *"How did the May reactivation special perform?"*
- Example: *"Launch L-0147 (Silver / reactivation, double points on two-night stays): 96 of 480 redeemed, 2.1M points burned against 2.6M projected, 61 room nights generated"*

## External Signals
The app widens the data aperture beyond first-party history. Signals may be synthetic — *art of the possible* — but must visibly drive recommendations and appear in explanations.
- **Local events** near member home cities — a design fair lifts propensity for Chicago-based members
- **Weather** at bookable properties — a clear-sky window makes Caribbean redemption nights genuinely more attractive
- **Competitor promotion intensity** — when nearby luxury flags promote heavily, hold tone steady; relevance over volume

## Explainability Requirements
Every recommendation renders a **"Why this offer"** explanation naming the member context, driving signal(s), brand rule, and liability impact. Example:

> "Why this offer: Eleanor Voss (Gold, at-risk) has 52,000 points expiring 30 September and favors Aurelia Key West in shoulder season. Driving signals: clear weather at Key West June 19–24 and 11 unsold ocean-view nights. Brand rule: a Gold redemption privilege, one of at most three active offers. Liability impact: burns 35,000 points, releasing an estimated 350 USD while recovering an unsold night."

## Data Entities (Lakebase tables, all in one schema)
- `members` — member_id, name, tier_id, home_city, join_date, last_stay_date
- `tiers` — tier_id, name (Member / Silver / Gold / Patron), qualifying_nights, base_point_multiplier
- `point_balances` — member_id, points_available, points_expiring_90d, next_expiry_date, as_of_date
- `lifecycle_segments` — segment_id, member_id, stage (acquisition / engagement / at_risk / reactivation), dominant_driver, score, scored_at (refreshed by a scheduled job; model out of scope)
- `perk_catalog` — perk_id, name, tier_floor, point_cost, cash_cost_estimate_usd, inventory_linked, property_id (set for perishable-inventory perks)
- `offer_launches` — launch_id, segment_id, offer_type (perk / multiplier / redemption_special), terms, projected_points_burned, projected_liability_released_usd, launch_window, status, created_at
- `liability_snapshots` — snapshot_date, tier_id, points_outstanding, liability_usd, points_expiring_90d, burn_rate_30d
- `brand_settings` — brand_id, max_offers_per_member_per_day, discount_floor_pct, tone_profile, relevance_threshold (persona dials as data, not prose)

## Technical Considerations
- **Lakebase** (Provisioned or Autoscaling) for all tables — single Postgres schema, no Lakehouse dependency
- **Databricks App** hosting the studio UI and launch workflow
- **Genie Space** over the Lakebase tables for read-side natural language; an **AI Agent** for write-side launch actions; **Mosaic AI** for any LLM calls inside the agent
- A nightly job refreshes segments, snapshots, and synthetic signal tables
- If using the Databricks Python SDK for Lakebase OAuth credentials, pin a recent version (e.g. `databricks-sdk>=0.81`) — app runtimes pre-install an older SDK lacking the Postgres credential API

## Scope Constraints
**Keep it simple** and focus only on the bare minimum to support one brand (Aurelia Collection), 2–3 properties, 60–80 synthetic Aurelia Circle members across the four tiers, and the three workflows above. We do not need real comms integration, payments, multi-tenant auth, or model training. Liability math is simple arithmetic over pre-populated synthetic data; single-tenant, one role, no SSO. Out of scope (phase-2): real email/push delivery (ESP/CDP), tier upgrade/downgrade automation, partner earn/burn (airline, card transfers), financial-grade liability accounting (breakage actuarials, audit trail), and multi-brand persona switching at runtime.',
 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- TRAVEL & HOSPITALITY -- MARK CERTIFIED USE CASES
-- =============================================================================
-- The four Aurelia cards above plus the existing Autonomous Disruption Response
-- (#200) are the certified set. Certified use cases pin to the top of their
-- outcome-map column and render a "Certified" badge in the workshop flow and on
-- the workflow steps.
-- =============================================================================

UPDATE ${catalog}.${schema}.usecase_descriptions
SET is_certified = TRUE
WHERE industry = 'travel'
  AND use_case IN (
    'autonomous_disruption_response',
    'customer_360_audience_builder',
    'cross_sell_upsell_optimization',
    'personalized_ancillaries_offer',
    'custom_loyalty_based_offers'
  );

-- =============================================================================
-- SET path_type FOR SKILL ENTRIES
-- =============================================================================
-- All rows default to path_type='use_case' via column DEFAULT.
-- Skill entries are explicitly marked here.
-- =============================================================================

UPDATE ${catalog}.${schema}.usecase_descriptions
SET path_type = 'skill'
WHERE use_case = 'build_skill';
