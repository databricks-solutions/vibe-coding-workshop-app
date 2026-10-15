-- =============================================================================
-- SEED: CPG, Retail and Travel outcome maps (PostgreSQL/Lakebase)
-- =============================================================================
-- Full build specs for CPG and Retail laid out in Travel's column order
-- (Operations, Revenue, Customer, Workforce), plus Travel's Workforce column.
-- Rows go in as version 2 only when no v2+ exists, so v1 stays in History and
-- admin edits are never overwritten. Hidden airline rows only get a column
-- where they are still uncategorized. Safe to re-run on every deploy.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

SELECT setval(pg_get_serial_sequence('${schema}.usecase_descriptions', 'config_id'), COALESCE((SELECT MAX(config_id) FROM ${schema}.usecase_descriptions), 0) + 1, false);

-- CPG
INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'cpg_demand_inventory', 'Demand Sensing & Inventory', 'Agentic Supply Chain', 1, 1,
'Sense demand at the retailer and shopper level and turn it into production, deployment and inventory decisions across plants and distribution centers, so a CPG manufacturer ships what will actually sell, with less working capital tied up in the wrong stock.

## Application Type
Planning workbench that connects **Demand Planners** with a **Demand Sensing Engine** that blends shipments, retailer point-of-sale, promotions and external signals into a short-term forecast, then recommends inventory moves the planner can accept, edit or reject.

## Key Personas
- **Demand Planner**: Owns the weekly forecast by SKU and customer; reviews forecast changes, overrides with context and signs off the consensus number
- **Supply & Inventory Manager**: Sets safety stock and deployment across DCs; acts on recommended transfers and production changes

## Core Features Required

### Sense, Plan and Position (3 Scenarios)

#### 1. POS-Driven Demand Sensing
Daily retailer point-of-sale and inventory feeds refine the shipment forecast for the next 1-6 weeks:
- Blend shipments, retailer POS, store inventory, promotions and weather into a SKU x customer x week forecast
- Highlight the largest forecast changes vs last week with the drivers behind each change
- Accuracy tracking (WMAPE, bias) by brand, customer and planner

#### 2. Promotion Lift Planning
Planned trade promotions are translated into incremental volume before the event:
- Baseline vs promoted volume with historical lift by mechanic (TPR, display, feature)
- Cannibalization and pantry-loading effects on adjacent SKUs and post-event weeks
- Alert when promotional volume exceeds available supply

#### 3. Inventory Positioning
Recommend where inventory should sit to protect service at the lowest cost:
- Days of supply and projected stockout date by SKU and DC
- Recommended DC-to-DC transfers and production pull-ins with cost and service impact
- Safety stock recommendations from demand and lead-time variability
- Excess and obsolescence risk list with suggested actions (promote, donate, rework)

### Planner Workbench
- Exception-first queue: biggest forecast swings, projected stockouts and excess stock
- Accept, edit or reject each recommendation with a reason code
- Consensus forecast view comparing statistical, sales and final numbers

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which SKUs will run out at Walmart in the next three weeks?"*
- *"How accurate was our forecast for the snacks category last month, by customer?"*
- *"What is driving the forecast increase for the 12-pack this week?"*
- *"How much excess inventory do we have older than 90 days, by DC?"*

## Data Entities
Core entities: SKUs, Customers (retail accounts), Plants, Distribution Centers, Shipments, Retailer POS, Store Inventory, Promotions, Forecasts, Forecast Overrides, Inventory Positions, Transfer Recommendations

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one CPG manufacturer, 3 retail customers, 2 DCs, about 50 SKUs and the three scenarios**, using generated synthetic data. We do not need real ERP or APS integration, production scheduling, transportation planning or user authentication. This will be an **open, public demo** where anyone can change a promotion or a demand signal and watch the forecast, stockout risk and recommended transfers update.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'cpg_demand_inventory' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'cpg_supply_chain_risk', 'Supplier & Plant Risk Radar', 'Agentic Supply Chain', 1, 2,
'Watch every ingredient, packaging supplier, co-manufacturer and plant for early signs of disruption, and quantify which finished goods and retail customers would be hit, so a CPG supply team mitigates before the shelf goes empty.

## Application Type
Risk control tower that connects **Supply Risk Managers** with a **Risk Scoring Engine** that maps the bill of materials from raw material to retail order and scores the impact of each emerging event.

## Key Personas
- **Supply Risk Manager**: Monitors the risk feed, triages events and launches mitigation playbooks
- **Plant / Procurement Lead**: Confirms supplier status, qualifies alternates and approves expedites or reformulations

## Core Features Required

### Detect, Quantify and Mitigate (3 Scenarios)

#### 1. Supplier Early Warning
Score every supplier and co-manufacturer on delivery, quality and external risk signals:
- On-time-in-full, lead-time drift and quality rejects trended by supplier
- External signals (weather, port congestion, news) mapped to supplier sites
- Single-source and high-concentration ingredients flagged

#### 2. Revenue-at-Risk Impact
Trace a disrupted input through the bill of materials to finished goods and customer orders:
- Affected SKUs, open orders and retail customers for any supplier or plant event
- Days of cover for each affected material and finished good
- Revenue and service-level at risk ranked by customer priority

#### 3. Mitigation Playbooks
Compare and launch responses with cost and service trade-offs:
- Options: alternate supplier, expedite, reallocate inventory, substitute SKU or allocate to priority customers
- Side-by-side cost, service and margin impact per option
- Action log with owner, due date and status

### Risk Control Tower
- Map of suppliers, plants and DCs colored by risk score
- Event feed with impact estimate and recommended playbook
- Weekly risk register export for leadership

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which finished goods depend on a single-source ingredient?"*
- *"How much revenue is at risk if our corrugate supplier in Ohio is down for two weeks?"*
- *"Which suppliers have the worst on-time delivery this quarter?"*
- *"Which retail customers would be hit first by the current plant outage?"*

## Data Entities
Core entities: Suppliers, Supplier Sites, Materials, Bills of Material, Plants, Co-Manufacturers, Purchase Orders, Quality Inspections, Risk Events, Finished Goods, Customer Orders, Mitigation Actions

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one manufacturer, about 30 suppliers, 3 plants, 40 finished goods and the three scenarios**, using generated synthetic data. We do not need real supplier portals, live news feeds, procurement execution or user authentication. This will be an **open, public demo** where anyone can trigger a simulated supplier or plant event and see the revenue at risk and mitigation options.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'cpg_supply_chain_risk' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'cpg_supplier_collaboration', 'Co-Manufacturer Collaboration', 'Agentic Supply Chain', 1, 3,
'Give suppliers and co-manufacturers one shared view of forecasts, commitments and exceptions, so both sides plan from the same numbers and resolve issues in hours instead of email chains.

## Application Type
Two-sided collaboration portal that connects the **CPG Supply Planner** with **Supplier and Co-Man Partners**, sharing a governed slice of forecast and order data and tracking every commitment and exception to closure.

## Key Personas
- **Supply Planner**: Publishes forecasts and purchase plans, reviews partner commitments and escalates gaps
- **Supplier / Co-Man Account Manager**: External partner who confirms capacity, flags constraints and responds to exceptions

## Core Features Required

### Share, Commit and Resolve (3 Scenarios)

#### 1. Shared Forecast and Capacity Commit
Partners see the rolling forecast for their materials and commit capacity week by week:
- 13-week rolling forecast by material shared with each partner (only their rows)
- Partner commits or flags shortfalls per week, with reason
- Gap view: forecast vs committed capacity

#### 2. Exception Management
Late, short or quality-held deliveries are raised and resolved in one thread:
- Exception types: late, short, quality hold, spec change
- Owner, due date and status with escalation after SLA
- Impact on finished-goods production shown to both sides

#### 3. Partner Scorecard
Shared KPIs so both sides act on the same version of reality:
- On-time-in-full, commit accuracy, lead time and quality by partner
- Trend vs target with quarterly business review summary

### Partner Portal
- Role-based views: internal planner sees all partners, each partner sees only their data
- Inbox of open commitments and exceptions
- Comment threads attached to each exception

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which co-manufacturers have not confirmed capacity for next month?"*
- *"What is our commit accuracy by supplier this quarter?"*
- *"Show open quality holds older than five days"*

## Data Entities
Core entities: Partners, Partner Users, Materials, Forecast Shares, Capacity Commitments, Purchase Orders, Deliveries, Exceptions, Comments, Scorecards

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one manufacturer, 5 partners, 30 materials and the three scenarios**, using generated synthetic data. We do not need EDI integration, real supplier onboarding, invoicing or user authentication beyond a persona switcher. This will be an **open, public demo** where anyone can switch between the planner and a partner persona and resolve a delivery exception end to end.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'cpg_supplier_collaboration' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'revenue_growth_mgmt', 'Revenue Growth Management', 'Profitable Revenue Growth', 2, 1,
'Optimize price, promotion and trade investment by retailer and SKU so every trade dollar earns incremental profit, not just volume.

## Application Type
Revenue growth workbench that connects **RGM Analysts** with an **Elasticity and Promotion Engine** to evaluate past events, simulate the next price or promotion plan, and track trade spend ROI.

## Key Personas
- **RGM Analyst**: Builds price and promotion scenarios, reviews post-event results and recommends the trade plan
- **Key Account Manager**: Negotiates the plan with the retailer and needs a defensible, customer-specific business case

## Core Features Required

### Price, Promote and Invest (3 Scenarios)

#### 1. Post-Event Promotion Analysis
Every completed promotion is scored for incremental volume, profit and ROI:
- Baseline vs actual volume, incremental units and incremental gross profit
- ROI by mechanic, depth, retailer and week
- Leaderboard of best and worst events with drivers

#### 2. Price Elasticity and Scenarios
Simulate list or shelf price changes before taking them:
- Own and cross-price elasticity by SKU and retailer
- Scenario: change price, see volume, revenue, margin and share impact
- Guardrails for price gaps vs competitors and private label

#### 3. Trade Spend Optimizer
Reallocate the trade budget toward the highest-return events:
- Current plan vs optimized plan within the same budget
- Constraints: retailer minimums, calendar, supply limits
- Exportable customer business case for the key account meeting

### RGM Workbench
- Promotion calendar by retailer with predicted ROI on each event
- Scenario compare (plan A vs plan B)
- Approval flow for plan changes

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which promotions lost money at Kroger last quarter?"*
- *"What happens to volume and margin if we raise the price of the family size by 5 percent?"*
- *"What is our trade spend ROI by retailer this year?"*
- *"Which mechanic works best for the beverage category?"*

## Data Entities
Core entities: SKUs, Retailers, Price Points, Promotions, Promotion Mechanics, Trade Spend, Retailer POS, Baselines, Elasticities, Scenarios, Trade Plans

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one manufacturer, 3 retailers, 40 SKUs, two years of weekly data and the three scenarios**, using generated synthetic data. We do not need real TPM system integration, deduction management, contract management or user authentication. This will be an **open, public demo** where anyone can build a promotion plan, compare it to an optimized plan and see the incremental profit difference.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'revenue_growth_mgmt' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'portfolio_innovation', 'Portfolio & Innovation Lab', 'Profitable Revenue Growth', 2, 2,
'Decide which products to grow, refresh, retire or launch by combining SKU performance with market trends and consumer signals, so R&D and commercial investment goes to the bets most likely to grow.

## Application Type
Portfolio lab that connects **Brand and Innovation Managers** with a **Portfolio Scoring Engine** that ranks every SKU and concept on growth, margin, incrementality and complexity cost.

## Key Personas
- **Brand Manager**: Owns a brand P&L and decides which SKUs to support, refresh or cut
- **Innovation Lead**: Runs the stage-gate pipeline and needs evidence for each go / no-go

## Core Features Required

### Prune, Shape and Launch (3 Scenarios)

#### 1. SKU Rationalization
Find the long tail that adds complexity without incremental sales:
- Velocity, margin, distribution and incrementality score per SKU
- Transferable demand estimate if a SKU is delisted
- Complexity cost (changeovers, packaging variants) by SKU

#### 2. Pack and Price Architecture
Check that sizes and price points ladder cleanly:
- Price per unit ladder across pack sizes and channels
- Gaps and overlaps vs competitors
- What-if: add or remove a pack size

#### 3. Innovation Pipeline Scoring
Score concepts with trend and consumer signals before investing:
- Trend signals from search, social and category growth
- Concept test scores and forecasted year-one volume
- Stage-gate board with go / hold / kill recommendation

### Portfolio Lab
- Portfolio matrix (growth vs margin) with bubble size by revenue
- Pipeline board by stage
- One-page brief per SKU or concept

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which SKUs are in the bottom 10 percent of velocity but take more than 5 percent of changeovers?"*
- *"How much demand would transfer if we delisted the 24-ounce variety?"*
- *"Which flavor trends are growing fastest in our category?"*

## Data Entities
Core entities: SKUs, Brands, Categories, Pack Sizes, Price Points, Sales, Distribution, Complexity Costs, Trend Signals, Concepts, Stage Gates

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one manufacturer, 2 brands, about 60 SKUs, 10 pipeline concepts and the three scenarios**, using generated synthetic data. We do not need real syndicated data feeds, PLM integration, consumer research tooling or user authentication. This will be an **open, public demo** where anyone can flag SKUs to delist, see the transferable demand and margin impact, and score a new concept.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'portfolio_innovation' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'retailer_insights', 'Retailer Insights', 'Know the Shopper and the Shelf', 3, 1,
'Show every account team where they are winning or losing at each retailer, across assortment, price, promotion, on-shelf availability and execution, so joint business planning starts from facts.

## Application Type
Account analytics app that connects **Key Account Managers** with a **Retailer Performance Engine** built on retailer point-of-sale and store data, surfacing the biggest gaps and opportunities by store, region and category.

## Key Personas
- **Key Account Manager**: Owns the retailer relationship and the joint business plan
- **Category Manager (CPG side)**: Builds category stories and assortment recommendations for the retailer

## Core Features Required

### Diagnose, Prioritize and Plan (3 Scenarios)

#### 1. Growth Gap Diagnosis
Decompose performance vs plan into its drivers:
- Sales vs plan and vs last year, split into distribution, velocity, price and promotion
- Share vs category by region and store cluster
- Top 10 gaps with estimated value

#### 2. On-Shelf Availability
Find stores where product is out or phantom-in-stock:
- Zero-sales days and inventory-but-no-sales detection by store and SKU
- Lost sales estimate and store list for field follow-up

#### 3. Joint Business Plan Builder
Turn the gaps into a plan the retailer will sign:
- Opportunities sized by value with owner and timing
- Category story slide-ready summary
- Plan vs actual tracking through the year

### Account Cockpit
- Retailer scorecard with drill-down to store and SKU
- Opportunity list sorted by value
- Exportable JBP summary

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Where are we losing share at Target this quarter, and why?"*
- *"Which stores have had zero sales of our top SKU for more than three days?"*
- *"How are we tracking against the joint business plan with Walmart?"*
- *"Which new items have the weakest distribution after 12 weeks?"*

## Data Entities
Core entities: Retailers, Stores, Store Clusters, SKUs, Retailer POS, Store Inventory, Plans, Promotions, Distribution Points, Opportunities

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one manufacturer, 2 retailers, 200 stores, 40 SKUs and the three scenarios**, using generated synthetic data. We do not need real retailer data-sharing connections, syndicated data, CRM integration or user authentication. This will be an **open, public demo** where anyone can pick a retailer, find the biggest growth gap and turn it into a joint business plan line.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'retailer_insights' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'shopper_insights', 'Shopper Insights', 'Know the Shopper and the Shelf', 3, 2,
'Understand who buys, why and how their behavior shifts across channels by combining retailer loyalty data, panel data and digital engagement, so brands target the right shoppers with the right message.

## Application Type
Shopper analytics app that connects **Shopper Insights Managers** with a **Segmentation Engine** that builds shopper segments, missions and switching patterns from loyalty and panel data.

## Key Personas
- **Shopper Insights Manager**: Builds segments and mission profiles and shares findings with brand and sales teams
- **Brand Marketer**: Uses segments to brief campaigns and retailer media buys

## Core Features Required

### Segment, Understand and Activate (3 Scenarios)

#### 1. Shopper Segmentation
Group shoppers by value, frequency and behavior:
- Segments built from loyalty transactions (heavy, lapsed, new, switchers)
- Segment profile: size, spend, basket, channel mix

#### 2. Switching and Loyalty
See where shoppers come from and go to:
- Brand switching matrix vs competitors and private label
- Repeat rate and loyalty curve for new items

#### 3. Mission and Occasion Analysis
Understand why shoppers buy:
- Basket missions (stock-up, top-up, meal, impulse)
- Category adjacency and cross-category affinity
- Activation brief per segment for campaigns or retail media

### Shopper Explorer
- Segment builder with live size estimate
- Switching and repeat charts
- One-click activation brief

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Who are our lapsed shoppers and where did they go?"*
- *"What is the repeat rate for the new protein bar after eight weeks?"*
- *"Which categories do our heavy buyers also shop?"*

## Data Entities
Core entities: Shoppers (pseudonymous), Loyalty Transactions, Baskets, Segments, Missions, Brands, Competitor Brands, Panel Data, Activation Briefs

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one brand portfolio, one retailer loyalty dataset of about 50k pseudonymous shoppers and the three scenarios**, using generated synthetic data. We do not need real panel or loyalty feeds, identity resolution, media activation or user authentication. This will be an **open, public demo** where anyone can build a segment, see its switching behavior and generate an activation brief.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'shopper_insights' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'brand_insights', 'Brand Insights', 'Know the Shopper and the Shelf', 3, 3,
'Measure brand health and marketing impact by tying campaign exposure, engagement and sentiment to sales, so brand teams know what is moving the brand and invest with confidence.

## Application Type
Brand health app that connects **Brand Managers** with a **Marketing Impact Engine** combining media spend, social sentiment, search interest and sales into one weekly brand pulse.

## Key Personas
- **Brand Manager**: Owns brand health and the marketing budget
- **Insights Analyst**: Builds the weekly brand pulse and answers ad-hoc questions

## Core Features Required

### Listen, Measure and Learn (3 Scenarios)

#### 1. Brand Health Pulse
One weekly view of awareness, consideration and sentiment:
- Sentiment and share of voice from social and reviews
- Search interest vs competitors
- Alerts on sudden sentiment drops with sample posts

#### 2. Campaign Impact
Link campaigns to sales lift:
- Spend and impressions by channel vs sales by week
- Simple lift estimate per campaign vs control regions

#### 3. Creative and Message Learning
Find which messages resonate:
- Engagement by creative and message theme
- Top and bottom creatives with themes extracted by ai_query

### Brand Pulse
- Weekly scorecard per brand
- Campaign timeline overlaid on sales
- Creative leaderboard

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Why did sentiment for our flagship brand drop last week?"*
- *"Which campaign drove the most incremental sales this quarter?"*
- *"How does our share of voice compare to the top competitor?"*

## Data Entities
Core entities: Brands, Campaigns, Creatives, Media Spend, Impressions, Social Posts, Reviews, Search Trends, Sales, Sentiment Scores

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **two brands, 6 campaigns, one year of weekly data and the three scenarios**, using generated synthetic data. We do not need real social listening APIs, media buying, full marketing mix modeling or user authentication. This will be an **open, public demo** where anyone can explore a sentiment drop, see the posts behind it and compare campaign lift.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'brand_insights' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'cpg_agentic_workforce', 'Field Sales Copilot', 'Agentic Workforce and Talent', 4, 1,
'Give every CPG field rep and account manager an AI copilot that summarizes account performance, drafts account plans and answers policy and product questions, so they spend time selling instead of building reports.

## Application Type
Mobile-friendly copilot that connects **Field Sales Reps** with a **Sales Assistant Agent** grounded in governed account data, product specs and trade policies, with every suggestion traceable to its source.

## Key Personas
- **Field Sales Rep**: Visits stores and buyers; needs a briefing before each visit and quick answers on the go
- **Sales Manager**: Coaches the team and reviews account plans before they go to the retailer

## Core Features Required

### Brief, Plan and Answer (3 Scenarios)

#### 1. Pre-Visit Briefing
One-tap summary before every store or buyer meeting:
- Recent sales, distribution gaps and out-of-stocks for the account
- Open promotions and compliance issues
- Three suggested talking points

#### 2. Account Plan Drafting
The agent drafts a quarterly account plan for the rep to edit:
- Opportunities pulled from performance data
- Draft plan with actions, owners and targets
- Manager review and approval

#### 3. Policy and Product Q&A
Instant, cited answers on products and trade policy:
- Vector Search over product specs, pricing policy and promotion guidelines
- Answers cite the source document
- Unanswered questions logged for the sales ops team

### Copilot App
- Today view with scheduled visits and briefings
- Chat with the copilot
- Plan editor with approval status

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which of my accounts have the biggest out-of-stock problem this week?"*
- *"How is my territory tracking against target?"*
- *"Which promotions start in my accounts next week?"*

## Data Entities
Core entities: Reps, Territories, Accounts, Stores, Visits, Sales, Out-of-Stocks, Promotions, Product Specs, Policies, Account Plans

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one sales team of 10 reps, 50 accounts, a small policy library and the three scenarios**, using generated synthetic data. We do not need real CRM or SFA integration, offline mobile sync, voice input or user authentication. This will be an **open, public demo** where anyone can open a rep''s day, read a briefing, ask a policy question and draft an account plan.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'cpg_agentic_workforce' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'cpg', 'CPG', 'cpg_employee_360', 'Field Team Performance 360', 'Agentic Workforce and Talent', 4, 2,
'Unify headcount, coverage, activity and results for sales, merchandising and supply teams, so leaders see where capacity, coaching and training will move results most.

## Application Type
People performance app that connects **Sales and Operations Leaders** with a **Workforce Insights Engine** joining HR, activity and sales data into one governed view by role, region and team.

## Key Personas
- **Regional Sales Director**: Owns coverage and results for a region and decides where to add or move people
- **HR Business Partner**: Supports hiring, training and retention for the commercial teams

## Core Features Required

### Cover, Coach and Develop (3 Scenarios)

#### 1. Coverage and Capacity
Check that the right people cover the right accounts:
- Store coverage, visit frequency and workload by rep
- Over- and under-covered territories with revenue at stake

#### 2. Performance Drivers
See what top performers do differently:
- Results vs activity metrics (visits, compliance, distribution wins)
- Peer comparison by role and region

#### 3. Training and Retention
Target development where it matters:
- Training completion vs performance
- Attrition risk flags for high performers
- Suggested coaching actions per manager

### Team Cockpit
- Team scorecard by region
- Rep profile with activity, results and training
- Coaching action list

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which territories are under-covered relative to their revenue?"*
- *"What do our top 10 percent of reps do differently?"*
- *"Which high performers are at risk of leaving?"*

## Data Entities
Core entities: Employees, Roles, Regions, Territories, Accounts, Visits, Activities, Sales Results, Trainings, Attrition Signals

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one commercial organization of about 80 people, 3 regions and the three scenarios**, using generated synthetic data. We do not need real HRIS integration, compensation data, performance review workflows or user authentication. This will be an **open, public demo** where anyone can find an under-covered territory, compare reps and generate coaching actions.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'cpg' AND use_case = 'cpg_employee_360' AND version >= 2);

-- Retail
INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'demand_inventory', 'Store & DC Replenishment', 'Agentic Store and Supply Chain', 1, 1,
'Forecast demand by store and item and turn it into replenishment, allocation and safety-stock decisions across stores and distribution centers, so shelves stay full without piling up markdown risk in the back room.

## Application Type
Replenishment workbench that connects **Inventory Analysts** with a **Store Forecasting Engine** that blends sales, promotions, seasonality and local events into store-item forecasts and recommended orders.

## Key Personas
- **Inventory Analyst**: Reviews forecast exceptions and recommended orders for a department across all stores
- **Store Manager**: Sees what is arriving, flags local events and confirms counts for problem items

## Core Features Required

### Forecast, Replenish and Allocate (3 Scenarios)

#### 1. Store-Item Forecasting
Daily forecasts at store x item level with local drivers:
- Sales, promotions, holidays, weather and local events as drivers
- Forecast exceptions: largest changes and lowest-confidence items
- Accuracy by department, store cluster and season

#### 2. Automated Replenishment
Recommended orders from forecast, on-hand and lead time:
- Order quantity per store-item with projected days of supply
- Safety stock from demand and lead-time variability
- Analyst approves, edits or bulk-accepts recommendations

#### 3. DC Allocation
Allocate scarce inventory to the stores where it sells best:
- Allocation plan by store for constrained items
- Expected sell-through and lost sales by option
- Transfer suggestions between stores for slow movers

### Replenishment Workbench
- Exception queue sorted by revenue at risk
- Store-item detail with forecast, on-hand and orders
- Bulk approval with reason codes

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which stores will run out of sunscreen before the weekend?"*
- *"How accurate were our forecasts for the holiday promotion?"*
- *"Which items have more than 60 days of supply in the Northeast?"*
- *"Where should we send the 2,000 units arriving at the DC on Monday?"*

## Data Entities
Core entities: Stores, Store Clusters, Items, Departments, Distribution Centers, Sales, On-Hand Inventory, Promotions, Events, Forecasts, Orders, Allocations, Transfers

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 20 stores, 1 DC, about 100 items and the three scenarios**, using generated synthetic data. We do not need real merchandising or WMS integration, vendor ordering, transportation planning or user authentication. This will be an **open, public demo** where anyone can change a promotion or local event and see the forecast, orders and allocation update.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'demand_inventory' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'supply_chain_risk', 'Inbound Supply Risk Monitor', 'Agentic Store and Supply Chain', 1, 2,
'Track every inbound purchase order from vendor to DC and flag the shipments that will arrive late or short, so merchants and planners can react before it becomes an empty shelf or a missed promotion.

## Application Type
Inbound control tower that connects **Supply Chain Planners** with a **Late-Shipment Prediction Engine** that scores every open PO and container for delay risk and shows the store and promotion impact.

## Key Personas
- **Supply Chain Planner**: Owns inbound flow for a set of categories and decides on expedites and substitutions
- **Merchant / Buyer**: Needs to know which promotions and launches are at risk and approve alternatives

## Core Features Required

### Track, Predict and Respond (3 Scenarios)

#### 1. Inbound Visibility
One view of every open PO and container:
- PO status from order to receipt with milestones
- Port congestion and carrier performance overlays
- Vendor lead-time variability trend

#### 2. Late and Short Prediction
Score each shipment for delay risk:
- Delay probability and expected arrival per PO
- Promotions, launches and stores affected by each late PO
- Revenue at risk ranked by urgency

#### 3. Response Playbooks
Choose and track the response:
- Options: expedite, substitute item, reallocate from other stores, shift promotion
- Cost vs revenue protected for each option
- Action log with owner and status

### Inbound Control Tower
- Map and list of in-transit shipments by risk
- Promotion risk calendar
- Daily exceptions digest

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which POs for next month''s back-to-school promotion are at risk?"*
- *"Which vendors have the most late shipments this quarter?"*
- *"How much revenue is at risk from containers stuck at Long Beach?"*

## Data Entities
Core entities: Vendors, Purchase Orders, PO Lines, Shipments, Containers, Carriers, Ports, DCs, Items, Promotions, Risk Scores, Response Actions

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 25 vendors, about 300 open POs, 1 DC and the three scenarios**, using generated synthetic data. We do not need real carrier or port APIs, vendor portals, customs data or user authentication. This will be an **open, public demo** where anyone can advance the simulated clock, watch shipments slip and pick a response for an at-risk promotion.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'supply_chain_risk' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'supplier_collaboration', 'Vendor Collaboration Portal', 'Agentic Store and Supply Chain', 1, 3,
'Share sell-through, inventory and forecasts with vendors through one governed portal and manage exceptions together, so fill rates go up and both sides stop arguing about whose numbers are right.

## Application Type
Vendor portal that connects the **Retail Replenishment Team** with **Vendor Account Teams**, sharing each vendor''s slice of sales, inventory and forecast data and tracking fill-rate exceptions to closure.

## Key Personas
- **Replenishment Manager**: Owns vendor performance and publishes forecasts and order plans
- **Vendor Account Rep**: External user who sees their own items'' sell-through and responds to exceptions

## Core Features Required

### Share, Align and Improve (3 Scenarios)

#### 1. Shared Sell-Through and Forecast
Vendors see store sales, inventory and the forward forecast for their items:
- Weekly sell-through and weeks of supply by item and region
- 13-week order forecast shared with each vendor
- Vendor confirms supply or flags constraints

#### 2. Fill-Rate Exceptions
Short and late shipments are raised and resolved in one place:
- Exception with reason, owner and due date
- Chargeback and compliance tracking

#### 3. Vendor Scorecard
Shared KPIs reviewed in quarterly business reviews:
- Fill rate, on-time, lead time and in-stock by vendor
- Trend vs target and peer vendors

### Vendor Portal
- Persona switcher: retailer view of all vendors, vendor view of their data only
- Exception inbox with comments
- Scorecard export

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which vendors are below a 95 percent fill rate this month?"*
- *"What is the in-stock rate for vendor X''s items in the West region?"*
- *"Which open exceptions are past due?"*

## Data Entities
Core entities: Vendors, Vendor Users, Items, Stores, Sales, Inventory, Forecast Shares, Purchase Orders, Exceptions, Chargebacks, Scorecards

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 5 vendors, 80 items and the three scenarios**, using generated synthetic data. We do not need EDI, real vendor onboarding, invoicing, chargeback billing or user authentication beyond a persona switcher. This will be an **open, public demo** where anyone can switch between retailer and vendor personas and resolve a fill-rate exception.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'supplier_collaboration' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'commerce_media', 'Retail Media Network', 'Monetize the Customer Relationship', 2, 1,
'Turn the retailer''s site, app, email and in-store screens into a media business, giving brands privacy-safe audiences and closed-loop measurement built on first-party data.

## Application Type
Retail media platform that connects **Retail Media Sales Managers** with **Brand Advertisers**, offering audience building, campaign setup and sales-based measurement from the retailer''s first-party data.

## Key Personas
- **Retail Media Sales Manager**: Sells campaigns to brands and builds audiences and proposals
- **Brand Advertiser**: External user who reviews audience size, approves campaigns and reads results

## Core Features Required

### Build, Activate and Measure (3 Scenarios)

#### 1. Privacy-Safe Audience Builder
Build audiences from purchase behavior without exposing individuals:
- Audiences like category buyers, lapsed brand buyers, competitor buyers
- Live reach estimate with minimum-size thresholds
- Clean-room style aggregate outputs only

#### 2. Campaign Setup and Pacing
Plan placements and track delivery:
- Placements across site, app, email and in-store screens
- Budget pacing and delivery vs plan

#### 3. Closed-Loop Measurement
Tie ad exposure to sales:
- Exposed vs control sales lift and ROAS
- New-to-brand buyers and halo effects
- Advertiser-ready results summary

### Media Console
- Proposal builder for sales managers
- Advertiser view of campaigns and results
- Network revenue dashboard

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"How many shoppers bought a competitor''s coffee but not ours in the last 90 days?"*
- *"What was the ROAS of the spring snacks campaign?"*
- *"Which advertisers are underspending their committed budget?"*
- *"How much retail media revenue did we book this quarter?"*

## Data Entities
Core entities: Advertisers, Brands, Audiences, Placements, Campaigns, Impressions, Clicks, Transactions (pseudonymous), Lift Results, Invoices

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 5 advertisers, 8 campaigns, 50k pseudonymous shoppers and the three scenarios**, using generated synthetic data. We do not need a real ad server, real-time bidding, identity resolution, billing or user authentication. This will be an **open, public demo** where anyone can build an audience, launch a simulated campaign and read the sales-based lift report.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'commerce_media' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'maximize_roi', 'Profit & Markdown Optimizer', 'Monetize the Customer Relationship', 2, 2,
'Find where the retailer is leaving money on the table, from markdowns and promotions to pricing and assortment, and recommend the actions with the highest return.

## Application Type
Profit optimization app that connects **Merchandising and Finance Teams** with a **Margin Engine** that measures promotion and markdown effectiveness and recommends price, markdown and assortment moves.

## Key Personas
- **Merchandise Planner**: Owns a category''s sales and margin plan and decides markdown timing and depth
- **Finance Business Partner**: Validates the financial impact and tracks profit improvement

## Core Features Required

### Measure, Optimize and Track (3 Scenarios)

#### 1. Markdown Optimization
Clear seasonal inventory at the highest margin:
- Sell-through forecast at current price
- Recommended markdown timing and depth by item and store cluster
- Margin vs clearance trade-off chart

#### 2. Promotion Effectiveness
Measure the true profit of each promotion:
- Incremental sales and margin after cannibalization and halo
- Best and worst promotions by category

#### 3. Profit Leak Finder
Surface the biggest margin leaks:
- Shrink, excess markdown, price errors and low-margin items ranked by impact
- Recommended action and owner for each leak
- Tracker of realized savings

### Margin Cockpit
- Category margin bridge (plan vs actual)
- Markdown recommendations queue
- Savings tracker

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which promotions lost margin last quarter after cannibalization?"*
- *"What markdown should we take on swimwear this week?"*
- *"Where is shrink highest by store and category?"*

## Data Entities
Core entities: Items, Categories, Stores, Prices, Markdowns, Promotions, Sales, Inventory, Shrink, Margin Plans, Recommendations, Savings

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 2 categories, 20 stores, one season of data and the three scenarios**, using generated synthetic data. We do not need real pricing system integration, price execution, financial planning tools or user authentication. This will be an **open, public demo** where anyone can pick a category, accept markdown recommendations and see the projected margin improvement.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'maximize_roi' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'customer_data_management', 'Customer 360 & Identity', 'Know and Engage Every Customer', 3, 1,
'Unify customer data from POS, ecommerce, loyalty, app and service into one governed Customer 360 with resolved identities and consent, so every team builds on the same trusted customer view.

## Application Type
Customer data hub that connects **Customer Data Managers** with an **Identity Resolution Engine** that matches records across channels, builds golden profiles and enforces consent for every downstream use.

## Key Personas
- **Customer Data Manager**: Owns identity rules, data quality and consent
- **Marketing / CX Analyst**: Uses profiles and attributes to build audiences and analyses

## Core Features Required

### Unify, Govern and Serve (3 Scenarios)

#### 1. Identity Resolution
Match customers across channels into one profile:
- Deterministic and fuzzy matching on email, phone, loyalty ID and address
- Match confidence and merge review queue
- Household grouping

#### 2. Golden Profile and Attributes
Standard attributes everyone can trust:
- Lifetime value, recency, frequency, preferred channel and store
- Data quality scores per attribute

#### 3. Consent and Privacy
Use data only where the customer allowed it:
- Consent by purpose and channel
- Delete and access requests tracked end to end
- Unity Catalog row filters and masks on sensitive fields

### Customer Hub
- Profile viewer with source records and match history
- Data quality dashboard
- Consent and request log

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"How many customers shop both online and in store?"*
- *"What share of profiles have marketing consent by channel?"*
- *"Which data sources have the lowest match rate?"*

## Data Entities
Core entities: Customers, Source Records, Identities, Households, Profiles, Attributes, Consents, Privacy Requests, Data Quality Scores

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 4 source systems, about 100k synthetic customer records and the three scenarios**, using generated synthetic data. We do not need real CDP integration, live channel activation, a consent management platform or user authentication. This will be an **open, public demo** where anyone can watch duplicate records merge into a golden profile and check consent before building an audience.',
2, TRUE, TRUE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'customer_data_management' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'engage_convert', 'Engage & Convert Customers', 'Know and Engage Every Customer', 3, 2,
'Personalize every touchpoint, from recommendations and search to offers and messages, using behavioral and purchase signals, so more visits turn into baskets and more baskets grow.

## Application Type
Personalization app that connects **Digital Merchandisers** with a **Recommendation and Next-Best-Offer Engine**, plus a shopper-facing demo storefront that shows the personalized experience.

## Key Personas
- **Digital Merchandiser**: Configures recommendation strategies and offers and reads test results
- **Shopper**: Browses the demo storefront and receives personalized recommendations and offers

## Core Features Required

### Recommend, Offer and Test (3 Scenarios)

#### 1. Personalized Recommendations
Recommend products from browsing and purchase history:
- Similar items, frequently bought together and for-you rails
- Explanation of why each item was recommended

#### 2. Next Best Offer
Choose the right offer for each shopper:
- Offer eligibility and expected uplift per shopper
- Margin guardrails and frequency caps

#### 3. Test and Learn
Prove what works:
- A/B tests on strategies and offers
- Conversion, basket size and margin per variant
- Winner promotion with one click

### Merchandiser Console and Demo Storefront
- Strategy settings and offer library
- Storefront that changes per selected shopper persona
- Experiment results

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which recommendation rail drives the most add-to-carts?"*
- *"What was the conversion lift from the personalized offer test?"*
- *"Which segments respond best to free-shipping offers?"*

## Data Entities
Core entities: Shoppers, Sessions, Product Views, Carts, Orders, Products, Recommendations, Offers, Experiments, Variants

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer site, about 500 products, 5 shopper personas and the three scenarios**, using generated synthetic data. We do not need a real ecommerce platform, real-time event streaming at scale, payment or user authentication. This will be an **open, public demo** where anyone can switch shopper personas, see the storefront personalize and compare test variants.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'engage_convert' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'marketing_growth', 'Drive Marketing Growth', 'Know and Engage Every Customer', 3, 3,
'Connect customer, campaign and conversion data to decide who to target, which journey to send and where to spend, so growth comes from smarter decisions rather than more spend.

## Application Type
Marketing performance app that connects **Growth Marketers** with a **Propensity and Measurement Engine** for audience scoring, journey analysis and closed-loop campaign measurement.

## Key Personas
- **Growth Marketer**: Plans acquisition and retention campaigns and owns the channel budget
- **Marketing Analyst**: Builds propensity audiences and measures incrementality

## Core Features Required

### Target, Orchestrate and Measure (3 Scenarios)

#### 1. Propensity Audiences
Score customers for purchase, churn and category entry:
- Propensity scores with top drivers
- Audience export with size and expected response

#### 2. Journey Analysis
See which paths lead to conversion:
- Common journeys from first touch to purchase
- Drop-off points by channel

#### 3. Closed-Loop Measurement
Tie spend to outcomes:
- Holdout-based incrementality per campaign
- Cost per incremental customer by channel
- Budget shift recommendations

### Growth Cockpit
- Campaign performance board
- Audience builder
- Budget recommendation panel

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which customers are most likely to churn next month?"*
- *"What is our cost per incremental customer by channel?"*
- *"Where do most journeys drop off before purchase?"*

## Data Entities
Core entities: Customers, Campaigns, Channels, Touchpoints, Journeys, Conversions, Propensity Scores, Holdouts, Budgets

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **MLflow** to track, evaluate and version the scoring models
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 6 campaigns across 4 channels, 50k synthetic customers and the three scenarios**, using generated synthetic data. We do not need real marketing automation integration, live activation, multi-touch attribution vendors or user authentication. This will be an **open, public demo** where anyone can build a churn audience, see its expected response and compare campaign incrementality.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'marketing_growth' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'agentic_workforce', 'Store Associate Copilot', 'Empowered Store Teams', 4, 1,
'Put an AI copilot in every store associate''s hand that answers product and policy questions, explains inventory exceptions and suggests the next best task, so stores run consistently and customers get faster help.

## Application Type
Mobile-first copilot that connects **Store Associates** with a **Store Assistant Agent** grounded in store inventory, task lists and the policy library, with managers able to see and steer what the agent recommends.

## Key Personas
- **Store Associate**: Helps customers and works tasks on the floor; needs fast answers and clear priorities
- **Store Manager**: Assigns tasks, handles escalations and reviews store execution

## Core Features Required

### Answer, Prioritize and Resolve (3 Scenarios)

#### 1. Product and Policy Answers
Instant, cited answers on the floor:
- Returns, price-match and warranty policies via Vector Search
- Product availability in this and nearby stores
- Answers cite the policy section

#### 2. Inventory Exception Help
Explain and fix stock problems:
- Why an item shows in stock but is not on the shelf
- Suggested actions: count, check backroom, mark damaged

#### 3. Next Best Task
Prioritize the day:
- Task list ranked by revenue and customer impact
- Escalation of customer issues to the manager
- Daily execution summary for the manager

### Copilot App
- Chat with quick actions
- Task list
- Manager view of store execution

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which tasks are overdue in store 214 today?"*
- *"Which stores have the most inventory exceptions this week?"*
- *"What are associates asking the copilot most often?"*

## Data Entities
Core entities: Stores, Associates, Tasks, Items, Inventory, Exceptions, Policies, Questions, Escalations

## Technical Considerations
- **Mosaic AI Agent Framework** for tool-calling agents that draft actions and wait for human approval before anything is sent or changed
- **Vector Search** over policies, contracts and playbooks so agent answers cite their sources
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **Lakebase** for low-latency app state: approvals, overrides, notes and action history
- **AI Gateway** for model routing, guardrails, PII redaction and usage tracking
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one retailer, 3 stores, a small policy library and the three scenarios**, using generated synthetic data. We do not need real task management or POS integration, voice, offline mode or user authentication. This will be an **open, public demo** where anyone can ask a policy question, resolve an inventory exception and see the task list reprioritize.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'agentic_workforce' AND version >= 2);

INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'retail', 'Retail', 'employee_360', 'Store Labor & Performance 360', 'Empowered Store Teams', 4, 2,
'Bring scheduling, traffic, sales, training and turnover data together by store, so leaders staff to demand, coach where it counts and keep their best people.

## Application Type
Labor and performance app that connects **District Managers** with a **Store Labor Engine** that compares scheduled hours to forecast traffic and links staffing, training and turnover to store results.

## Key Personas
- **District Manager**: Oversees 10-15 stores and balances labor budget with service
- **Store Manager**: Builds schedules and coaches the team

## Core Features Required

### Staff, Coach and Retain (3 Scenarios)

#### 1. Labor vs Demand
Staff to traffic, not habit:
- Scheduled hours vs forecast traffic by hour and day
- Under- and over-staffed periods with sales impact

#### 2. Store Performance Drivers
Link people metrics to results:
- Conversion, basket and service scores vs staffing and tenure
- Peer store comparison

#### 3. Turnover and Training
Keep and grow the best people:
- Turnover by store, role and tenure
- Training completion vs performance
- Retention risk flags and suggested manager actions

### District Cockpit
- Store scorecards
- Hour-by-hour staffing heatmap
- Retention risk list

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which stores were understaffed during peak hours last weekend?"*
- *"How does associate tenure relate to conversion rate?"*
- *"Which stores have the highest turnover this quarter?"*

## Data Entities
Core entities: Stores, Districts, Employees, Roles, Schedules, Shifts, Traffic Counts, Sales, Trainings, Terminations, Service Scores

## Technical Considerations
- **Delta Lake** bronze/silver/gold tables as the single source of truth
- **ai_forecast()** and **ai_query()** SQL functions for forecasts, scenario projections and narrative summaries without a separate ML platform
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one district of 12 stores, about 300 employees and the three scenarios**, using generated synthetic data. We do not need real workforce management or HRIS integration, schedule publishing, payroll or user authentication. This will be an **open, public demo** where anyone can spot an understaffed peak, compare stores and see which people metrics drive conversion.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'retail' AND use_case = 'employee_360' AND version >= 2);

-- Travel & Hospitality: Workforce column
INSERT INTO ${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label, category, category_order, display_order,
 prompt_template, version, is_active, is_certified, path_type, source, created_by)
SELECT 'travel', 'Travel & Hospitality', 'airline_crew_workforce', 'Crew & Workforce 360', 'Empowered Frontline Teams', 4, 1,
'Optimize crew and frontline workforce utilization while protecting safety and quality of life, by bringing scheduling, fatigue, training and engagement data into one view, in an industry facing structural pilot, technician and hotel staff shortages.

## Application Type
Workforce intelligence app that connects **Crew and Workforce Planners** with a **Fatigue and Utilization Engine** that scores schedules for fatigue risk, tracks qualifications and predicts attrition by base and role.

## Key Personas
- **Crew / Workforce Planner**: Builds and adjusts rosters within contractual and fatigue limits
- **Director of Crew Experience**: Owns retention, engagement and quality of life for crew and frontline staff

## Core Features Required

### Schedule, Protect and Retain (3 Scenarios)

#### 1. Utilization and Fatigue Risk
Use crews fully without crossing fatigue or contract limits:
- Block, duty and credit hours by base, fleet and seniority vs contractual limits
- Fatigue score per pairing from duty length, time zones and circadian disruption
- Alerts for pairings above the fatigue threshold with safer alternatives

#### 2. Training and Qualification Currency
Never lose a crew member to an expired qualification:
- Type rating, recurrent training and line-check due dates
- Simulator slot recommendations before currency lapses
- Qualification gaps by base vs planned flying

#### 3. Attrition and Quality of Life
Keep experienced crew:
- Preference satisfaction, commute and days-off metrics by crew member
- Attrition risk score with top drivers
- Suggested retention actions for at-risk groups

### Workforce Cockpit
- Base-level utilization and fatigue heatmap
- Qualification expiry calendar
- Retention risk list with drivers

## Ask It in Genie
Leaders explore the same data conversationally through a Genie space embedded in the app:
- *"Which pairings next week exceed our fatigue threshold?"*
- *"How many first officers at the Denver base lose currency in the next 60 days?"*
- *"Which bases have the highest crew attrition risk and why?"*
- *"How does preference satisfaction compare between junior and senior crew?"*

## Data Entities
Core entities: Crew Members, Bases, Fleets, Qualifications, Pairings, Rosters, Duty Periods, Fatigue Scores, Training Events, Bids, Engagement Surveys, Attrition Signals

## Technical Considerations
- **Lakeflow** declarative pipelines to ingest and refresh the source feeds on a schedule
- **MLflow** to track, evaluate and version the scoring models
- **Genie Conversation API** embedded in the app so leaders ask questions in plain English over curated, governed tables, with trusted SQL answers pinned for the most common questions
- **AI/BI dashboards** embedded in the app for the KPI cockpit view, filtered to the signed-in persona
- **Unity Catalog metric views** so every KPI (margin, fill rate, attrition...) has exactly one governed definition shared by Genie, dashboards and the app
- **Databricks Apps** for the front end; **Unity Catalog** for permissions, lineage and audit

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one airline, 2 bases, about 300 crew members, one month of rosters and the three scenarios**, using generated synthetic data. We do not need real crew management system integration, roster optimization solvers, union rule engines or user authentication. This will be an **open, public demo** where anyone can load a month of rosters, find fatigue hotspots and expiring qualifications, and see attrition drivers.',
2, TRUE, FALSE, 'use_case', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM ${schema}.usecase_descriptions WHERE industry = 'travel' AND use_case = 'airline_crew_workforce' AND version >= 2);

-- Travel & Hospitality: columns for hidden airline rows
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 10
WHERE industry = 'travel' AND use_case = 'airline_airport_ops' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 11
WHERE industry = 'travel' AND use_case = 'airline_cargo_ops' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 12
WHERE industry = 'travel' AND use_case = 'airline_flight_ops' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 13
WHERE industry = 'travel' AND use_case = 'airline_mro_control_tower' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 14
WHERE industry = 'travel' AND use_case = 'airline_safety_management' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Agentic AI Operations', category_order = 1, display_order = 15
WHERE industry = 'travel' AND use_case = 'airline_sustainability_esg' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Diversified Revenue Growth', category_order = 2, display_order = 10
WHERE industry = 'travel' AND use_case = 'airline_revenue_management' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Diversified Revenue Growth', category_order = 2, display_order = 11
WHERE industry = 'travel' AND use_case = 'airline_finance_cost' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Diversified Revenue Growth', category_order = 2, display_order = 12
WHERE industry = 'travel' AND use_case = 'airline_network_planning' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Consumer at the Center of Every Decision', category_order = 3, display_order = 10
WHERE industry = 'travel' AND use_case = 'airline_customer_360' AND category IS NULL;
UPDATE ${schema}.usecase_descriptions SET category = 'Consumer at the Center of Every Decision', category_order = 3, display_order = 11
WHERE industry = 'travel' AND use_case = 'airline_loyalty_rewards' AND category IS NULL;

-- One-line descriptions shown under each industry tab (only if still empty)
UPDATE ${schema}.usecase_collections SET description = 'Consumer goods plays: agentic supply chain, revenue growth, shopper and shelf insight, and field teams.'
WHERE collection_id = 'cpg' AND (description IS NULL OR description = '');
UPDATE ${schema}.usecase_collections SET description = 'Retailer plays: store and DC supply chain, retail media and margin, customer engagement, and store teams.'
WHERE collection_id = 'retail' AND (description IS NULL OR description = '');
UPDATE ${schema}.usecase_collections SET description = 'Airline and hospitality plays: agentic operations, diversified revenue, the guest at the center, and frontline teams.'
WHERE collection_id = 'travel' AND (description IS NULL OR description = '');
