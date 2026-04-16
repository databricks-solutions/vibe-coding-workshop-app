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

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(23, 'travel', 'Travel & Hospitality', 'travel_customer_data', 'Customer Data Management', 
'Unify **guest and traveler profiles** across booking, loyalty, property systems, digital interactions, and service history to create a governed customer record.

This enables:
- **Consistent personalization** across every touchpoint
- **Continuity of service** regardless of channel
- **Privacy controls** and preference management

With a trusted profile foundation, teams can improve **experience quality** while maintaining operational consistency.

**Know your guests—and make them feel known.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(24, 'travel', 'Travel & Hospitality', 'customer_insights_activation', 'Customer Insights & Activation', 
'Analyze **traveler behavior** to identify trends and deliver experiences that increase loyalty and conversions.

Key capabilities:
- **Next-best-offer** recommendations
- **Churn risk** identification and prevention
- **Personalized journey orchestration** across touchpoints

The focus is on turning insight into action across *pre-trip, in-stay/in-trip, and post-trip* moments.

This drives **more direct bookings**, stronger loyalty engagement, and better lifetime value through *relevant, timely activation*.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(25, 'travel', 'Travel & Hospitality', 'travel_employee_360', 'Employee 360', 
'Track **employee performance and engagement** across properties, operations, and service teams by integrating scheduling, training, service metrics, and operational KPIs.

This supports:
- **Staffing decisions** and schedule optimization
- **Coaching** and skill development
- **Service quality improvement** across locations

The outcome is *more consistent delivery* and better workforce outcomes through **data-driven operational management**.

**Happy employees, happy guests.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(26, 'travel', 'Travel & Hospitality', 'travel_agentic_workforce', 'Agentic Workforce', 
'Empower employees to make **informed decisions faster** using AI agents for:
- *Knowledge retrieval* from policies and procedures
- *Workflow guidance* for complex processes
- *Summarization* of guest history and preferences
- *Exception handling* for disruptions and special requests

This reduces **time-to-resolution** and improves service consistency.

Agents are most valuable when they combine governed data with clear workflows—helping staff *act quickly* while maintaining **control and brand standards**.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(27, 'travel', 'Travel & Hospitality', 'call_center_ops', 'Call Center Operations', 
'Provide **real-time insights** to help agents resolve issues faster with:
- *Intelligent routing* to the right agent
- *Agent assist* with suggested responses
- *Knowledge search* for instant answers
- *Automated summaries* after each contact

This improves **first-contact resolution** and reduces handle time and cost.

Operationally, it turns the contact center into a **learning system**—capturing intent and outcomes to continuously improve policies, self-service, and *customer experience*.', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.usecase_descriptions 
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(28, 'travel', 'Travel & Hospitality', 'dynamic_pricing', 'Dynamic Pricing & Promotion', 
'Adjust **prices and promotions** based on demand signals, inventory/capacity, seasonality, and market conditions to *maximize revenue* and respond quickly to change.

This use case blends:
- **Forecasting** to predict demand patterns
- **Experimentation** to determine what drives incremental value
- **Optimization** to find the right price point

The outcome is stronger revenue performance through *smarter rate/offer decisions*, improved load/occupancy management, and **more targeted promotions**.

**Capture every revenue opportunity.**', 
1, FALSE, current_timestamp(), current_timestamp(), current_user());

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
