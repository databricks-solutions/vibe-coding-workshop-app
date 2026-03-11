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
1, TRUE, current_timestamp(), current_timestamp(), current_user());

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
