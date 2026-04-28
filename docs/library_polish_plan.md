# Library Polish + Travel & Hospitality Outcome Map — Plan

**Status:** Draft for review
**Owner:** Workshop App
**Last updated:** 2026-04-28
**Reference:** Outcome Map slide (Travel) — three themed columns: Agentic AI Operations / Diversified Revenue Growth / Consumer at the Center of Every Decision.

---

## Table of Contents
1. [Goal](#1-goal)
2. [Outcome Map → Use Case Mapping](#2-outcome-map--use-case-mapping)
3. [Use Case Specifications (the 10 prompt templates)](#3-use-case-specifications)
4. [UI / UX Design Spec — the Outcome Map Grid](#4-ui--ux-design-spec--the-outcome-map-grid)
5. [Schema Change (Lakebase)](#5-schema-change-lakebase)
6. [Seed Data Changes](#6-seed-data-changes)
7. [Backend Changes](#7-backend-changes)
8. [Frontend Changes](#8-frontend-changes)
9. [Out of Scope / Non-Goals](#9-out-of-scope--non-goals)
10. [Validation Steps](#10-validation-steps)
11. [Execution Todos](#11-execution-todos)
12. [Open Questions for Reviewer](#12-open-questions-for-reviewer)

---

## 1. Goal

Cleanly polish the *Define Your Intent → Library* experience and seed Travel & Hospitality with 10 outcome-map-aligned use cases that each have a strong, comprehensive Booking-App-style spec.

Concretely:

1. Rename the Sample industry chip from `sample [for enablement]` → **Sample**.
2. Render the two industries as a **tab strip** at the top of *Choose from Library* (`Sample | Travel & Hospitality`), with **Sample pre-selected** and the **Booking App** card auto-selected underneath it.
3. Inside the Travel & Hospitality tab, render a **3-column themed Outcome Map grid** mirroring the slide:
   - Agentic AI Operations (4 cards)
   - Diversified Revenue Growth (3 cards)
   - Consumer at the Center of Every Decision (3 cards)
4. Author 10 new Travel & Hospitality use cases — each with a complete Booking-App-style prompt template (~50–80 lines): **Application Type → Personas → Core Features → Data Entities → Technical Considerations → Scope Constraints**. Leaf items from the slide become Core Features.
5. Drive the layout from data (new `category` / `category_order` columns) — not hardcoded in React.
6. Make the Travel grid feel **delightful** — staggered entrance, theme-coloured glow, BorderBeam selection, hovered feature pills cascading in, glass-morph card surfaces.

---

## 2. Outcome Map → Use Case Mapping

Three columns. Each parent card carries the leaf items as Core Features.

### Column 1 — Agentic AI Operations · `category_order = 1`

| # | Use Case | Slug | Core Features (leaf items) |
|---|---|---|---|
| 1 | Autonomous Disruption Response | `autonomous_disruption_response` | Automated rebooking & accommodation · Proactive Weather Notifications · Delay/Cancellation auto-resolution · Automated voucher/compensation |
| 2 | Predictive Maintenance | `predictive_maintenance` | AOG Prevention · Equipment Maintenance Optimization · Expedited Maintenance Optimization |
| 3 | Smarter Scheduling | `smarter_scheduling` | Gate Assignment Optimization · Flight Schedule Optimization · Workforce Optimization · Window Optimization |
| 4 | Real-Time Operations View | `realtime_operations_view` | End-to-End Supply Chain Visibility · Unified Operations Dashboard · Real-Time Availability Insights · New Product Enablement |

### Column 2 — Diversified Revenue Growth · `category_order = 2`

| # | Use Case | Slug | Core Features |
|---|---|---|---|
| 5 | Dynamic Pricing | `dynamic_pricing` *(rewriting `config_id 28`)* | AI-Driven Revenue Management · Demand-Based Pricing · Open Pricing |
| 6 | Intelligent Offers Management | `intelligent_offers_management` | Personalized Ancillaries · Loyalty-Based Offer Customization · Cross-Sell/Upsell Optimization |
| 7 | Product & Channel Development | `product_channel_development` | Omnichannel Booking Experience · Partnership & Marketplace Integration · Direct Booking Optimization |

### Column 3 — Consumer at the Center of Every Decision · `category_order = 3`

| # | Use Case | Slug | Core Features |
|---|---|---|---|
| 8 | AI-Driven Booking | `ai_driven_booking` | Conversational Booking · Intent Booking & Discovery · Voice-Activated Booking |
| 9 | Hyper-Personalized Marketing | `hyper_personalized_marketing` | Customer 360 · Generative Content Creation · Next Best Offer |
| 10 | Agentic Customer Service | `agentic_customer_service` | 24/7 AI-Powered Assistant · Multi-Agent Issue Resolution · Sentiment Analysis & Escalation · Behavioral Targeting |

---

## 3. Use Case Specifications

Each spec below is the exact `prompt_template` text that will land in the `usecase_descriptions.prompt_template` column. The shape mirrors the existing **Booking App** sample row (`config_id 1`) so the generated apps stay consistent and tractable. Each spec is ~55–60 lines and follows this skeleton:

> 1. **Opening line:** `Create a simple **<APP TYPE>** similar to <RECOGNIZABLE REFERENCE>.`
> 2. **`## Application Type`** — one sentence with `connects **<Persona A>** with **<Persona B>** to <verbs>`.
> 3. **`## Key Personas`** — exactly two personas as `**Name**: verb-led one-liner`.
> 4. **`## Core Features Required`** — one main `### Group (N <Things>)` with `#### 1.`, `#### 2.`, … numbered sub-features (each = a leaf item from the slide), each with a description paragraph + 3–5 bullets and an *italic example* where natural; plus one flat `### Supporting Group` with a short bullet list.
> 5. **`## Data Entities`** — single line: `Core entities: A, B, C, …` (no trailing period).
> 6. **`## Technical Considerations`** — 4 short bullets.
> 7. **`## Scope Constraints`** — three-sentence prose: *"**Keep it simple** and focus only on the bare minimum required to support… We do not need… This will be an **open, public demo** where…"*.

Markdown emphasis is preserved as in the seed file (`**bold**`, `*italics*`).

---

### 3.1 Autonomous Disruption Response

```markdown
Create a simple **autonomous travel disruption response platform** similar to Airbnb's automated re-accommodation flow, applied to travelers whose flights cancel, delay, or get re-routed by weather.

## Application Type
Operations + traveler-facing hybrid app that connects **Travelers** with an **AI Recovery Agent** to detect, predict, and resolve disruptions (delays, cancellations, weather, equipment) without human intervention.

## Key Personas
- **Traveler**: End users who receive proactive notifications and accept or modify recovery options on their device
- **Operations Controller**: Internal staff who monitor fleet-wide disruptions, tune agent guardrails, and intervene on high-risk cases

## Core Features Required

### Disruption Recovery Workflow (4 Recovery Capabilities)

The application must support **four distinct recovery experiences**:

#### 1. Automated Rebooking & Accommodation
Cancelled or heavily-delayed itineraries are detected and the traveler is offered ranked recovery options:
- Alternate same-airline flights, partner-airline flights, ground transport, or hotel rooms
- Ranked by total travel time, fare-class continuity, and loyalty tier
- One-tap accept that reissues tickets and pushes new boarding passes
- Side-by-side comparison of the top 3 options

#### 2. Proactive Weather Notifications
Pre-disruption alerts that move travelers before the flight cancels:
- Example: *"We're moving you to the 9:40 AM before your 11:15 cancels"*
- Correlates weather, ATC, and equipment feeds with affected itineraries
- Confidence score and reason shown alongside each notification
- Channels: in-app push and email

#### 3. Delay/Cancellation Auto-Resolution
Policy-driven agent loop that closes the recovery without human touch:
- Rebook → reissue ticket → notify traveler → repath checked baggage
- Trigger compensation eligibility check with reasoning logged for audit
- Human-in-the-loop override available for high-risk or VIP cases

#### 4. Automated Voucher / Compensation
Calculates entitlements and issues compensation directly to the traveler:
- Regulatory rules (EU261, DOT) plus airline goodwill policy
- Issues vouchers, refunds, or miles to the traveler's wallet
- Audit log of every decision with rule citations

### Operations War-Room
- Live map of disruptions and agent actions across the fleet
- Exception queue with severity sort and override controls
- Audit trail of every agent decision

## Data Entities
Core entities: Travelers, Itineraries, Flights, Aircraft, Crews, Weather Events, Disruption Records, Recovery Plans, Compensation Ledger, Notifications, Audit Trail

## Technical Considerations
- Streaming ingest of OPS, weather, and ATC feeds (Kafka or DLT)
- Multi-agent recovery loop with human-in-the-loop guardrails
- Idempotent ticket-reissue calls to PSS / GDS
- Per-region compensation rule engine (EU261, DOT, etc.)

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core recovery features for **a single airline, US flights, and USD compensation only**. We do not need real PSS integration, real payment processing, hotel or ground-transport booking, or user authentication. This will be an **open, public demo** where anyone can replay simulated disruption scenarios and watch the agent rebook, notify, and compensate affected travelers.
```

---

### 3.2 Predictive Maintenance

```markdown
Create a simple **predictive maintenance intelligence platform** similar to Tesla's over-the-air diagnostic and service-prediction system, applied to commercial aircraft fleets.

## Application Type
Back-office MRO operations app that connects **Maintenance Controllers** with a **Predictive Health Engine** to forecast component failures, optimize shop visits, and prevent Aircraft-on-Ground (AOG) events before they happen.

## Key Personas
- **Maintenance Controller**: Internal staff who watch the fleet, route mechanics, and defer or clear MEL items based on predicted health
- **Reliability Engineer**: Internal staff who tune models, investigate emerging failure patterns, and own the MSG-3 reliability program

## Core Features Required

### Health & Maintenance Forecasting (3 Optimization Modes)

The application must support **three distinct maintenance forecasting modes**:

#### 1. AOG Prevention
Real-time component health scoring identifies which aircraft are likely to ground in the next 72 hours:
- Example: *"Tail N123AB has 0.78 risk-of-AOG-in-72h driven by APU EGT margin trend"*
- Combines ACARS sensor telemetry, pilot reports, and recent work-order history
- Ranks aircraft by predicted risk with recommended interventions (defer, swap, schedule overnight check)
- Surfaces the top 3 contributing signals so the engineer can validate

#### 2. Equipment Maintenance Optimization
Optimal time-to-maintain models for high-value rotables (engines, APUs, landing gear):
- When to remove a component for shop visit vs run-on-wing for one more cycle
- Cost-benefit projections including parts, labor, and reliability impact
- Side-by-side comparison of "remove now" vs "defer 30 days" scenarios

#### 3. Expedited Maintenance Optimization
For unplanned defects, the platform produces a shortest-path repair plan:
- Locates the nearest available part across the network
- Matches mechanic skill to defect type
- Coordinates gate or hangar slot timing with the flight schedule
- Auto-notifies affected stations of the repair plan

### Reliability Trend Detection
- SPC charts that surface emerging fleet-wide reliability issues
- Clustering of similar defects across tails and stations
- One-click drill-down from trend to underlying work orders

## Data Entities
Core entities: Aircraft, Engines, Components, Sensors, ACARS Messages, Pilot Reports, Work Orders, Parts Inventory, Mechanics, Stations, MEL Items, Maintenance History

## Technical Considerations
- Streaming sensor telemetry via DLT at 1–10 second resolution per tail
- ML failure-prediction models served via Model Serving with shadow scoring
- Unity Catalog lineage from raw telemetry through engineering features to predictions
- Constraint solver for shortest-path repair planning

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core forecasting features for **a single fleet type (e.g. A320 family) with three component classes (engine, APU, brakes) and 5–10 simulated tails**. We do not need real-time ACARS integration, real parts-inventory integration, native mobile apps, or user authentication. This will be an **open, public demo** where anyone can replay a CSV of telemetry and watch the platform predict, prioritize, and plan maintenance for the simulated fleet.
```

---

### 3.3 Smarter Scheduling

```markdown
Create a simple **AI-coordinated scheduling platform** similar to Uber's driver-dispatch and capacity-balancing system, but applied to airline gates, schedules, crews, and maintenance windows.

## Application Type
Planning + operations app that connects **Network Planners** with a **Multi-Objective Optimizer** to align gates, flight times, crew assignments, and maintenance windows in a single coordinated decision surface.

## Key Personas
- **Network Planner**: Internal staff who build seasonal schedules, evaluate new routes, and balance frequency vs profitability
- **Hub Coordinator**: Internal staff who own gate assignments, turn times, and connection feasibility at a hub

## Core Features Required

### Multi-Objective Schedule Optimization (4 Optimization Targets)

The application must support **four distinct optimization targets** that share data and constraints:

#### 1. Gate Assignment Optimization
The solver allocates flights to gates each day considering multiple factors:
- Aircraft type, passenger connection flows, walking distances, and towing cost
- Real-time re-allocation during IROPS (irregular operations)
- Conflict detection and gate-swap recommendations
- Example: *"Swap A12 → B7 at 14:30 to save 200 connecting walk-minutes"*

#### 2. Flight Schedule Optimization
Departure-time tuning across markets that:
- Maximizes connecting-bank revenue at the hub
- Respects slot constraints at slot-controlled airports
- Minimizes crew and aircraft idle time
- Compares "Schedule A vs B" with revenue, OTP, and connection-loss deltas

#### 3. Workforce Optimization
Crew-pairing optimizer that:
- Respects union contractual rules and fatigue thresholds
- Honors base preferences and seniority-fair bid awards
- Surfaces utilization vs contractual-limit dashboards

#### 4. Window Optimization
Pairs the schedule with required maintenance touches so:
- Heavy checks land at the right base, at the right time
- Required parts are pre-staged at the hangar before the tail arrives
- Out-of-service windows fit between scheduled flights

### Scenario Comparison
- Versioned schedule snapshots with diff highlighting
- Side-by-side what-if scenarios with revenue, OTP, crew cost, and connection-loss deltas
- Approve-and-publish flow for the chosen scenario

## Data Entities
Core entities: Flights, Gates, Aircraft, Crews, Stations, Slots, Maintenance Events, Connection Itineraries, Revenue Accounting, Union Rules

## Technical Considerations
- Mixed-Integer Programming (Pyomo or OR-Tools) on Spark for large instances
- Pre-computed connection-loss matrix per O&D
- Genie space for natural-language what-if questions
- Versioned schedule snapshots stored in Lakebase

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core gate-assignment optimizer for **one hub airport, one fleet type, and 50–100 daily flights**. We do not need real PSS integration, full implementations of the schedule / workforce / window optimizers, a real union-rule engine, or user authentication. This will be an **open, public demo** where anyone can load a CSV of flights and watch the optimizer assign gates, flag conflicts, and propose swaps in seconds.
```

---

### 3.4 Real-Time Operations View

```markdown
Create a simple **real-time airline operations command center** similar to a Bloomberg Terminal for an airline's operations team, fusing flights, crews, weather, baggage, supply chain, and customer experience into one screen.

## Application Type
Wall-mounted plus desktop dashboard that connects **Operations Directors** with a **Live-Signal Aggregator** to surface the airline's pulse, flag exceptions, and answer ad-hoc questions in seconds.

## Key Personas
- **Operations Director**: Internal leadership who want the one number that says "are we okay?" and the three levers that fix it if not
- **Station Manager**: Internal staff who drill into a station's performance vs the network and flag resource gaps

## Core Features Required

### Operations Intelligence Tiles (4 Real-Time Views)

The application must support **four distinct live operational views**:

#### 1. End-to-End Supply Chain Visibility
Live position of high-value rotables, ULDs, fuel inventory, and catering carts:
- Imbalance alerts when stations are over- or under-stocked
- Auto-rebalancing recommendations with cost projections
- Drill-down to specific component or station inventory

#### 2. Unified Operations Dashboard
One screen showing the airline's pulse:
- OTP, completion factor, baggage performance, crew on-time, customer NPS proxy
- Real-time exception stream with severity sort
- Today vs same-day-last-year comparison

#### 3. Real-Time Availability Insights
Live seat, cargo, and cabin-class availability across the network:
- Example: *"DEN-LAX next 7 days at 95% load — surge demand for ski week"*
- Flags markets with surge demand or empty capacity
- Recommended actions for the revenue desk

#### 4. New Product Enablement
A/B-experimentation surface for ops-relevant launches:
- Launch a new ancillary, route, or service tier and see live adoption
- Financial impact projection in the same view
- Toggle holdouts and view causal-impact estimates

### Conversational Intelligence
- Embedded Genie space lets any role ask "Why is DFW running 9 minutes late on average today?"
- Returns charted answers grounded in the operational tables
- Role-based slicing (network / station / fleet / region) with link-back to dashboard tiles

## Data Entities
Core entities: Flights, Stations, Crews, Aircraft, Supply-Chain Items, Bookings, Customer Sentiment Events, Experiments, Exception Records

## Technical Considerations
- Streaming aggregations into a Gold serving layer (DLT + materialized views)
- Lakeview dashboards with auto-refresh
- Genie AI/BI for ad-hoc Q&A
- Role-based slicing across network, station, fleet, and region

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **six core tiles, one drill-down depth, and a single airline in a single timezone**. We do not need real streaming integration, alert delivery via email or Slack or SMS, multi-region support, or user authentication. This will be an **open, public demo** where anyone can replay a Python-generated stream and watch the tiles update, exceptions flow, and the embedded AI answer ad-hoc questions.
```

---

### 3.5 Dynamic Pricing

```markdown
Create a simple **AI-driven dynamic pricing engine** similar to Uber's surge-pricing algorithm, but applied to airline fares, ancillaries, and promotional offers.

## Application Type
Back-office revenue-desk app plus real-time pricing API that connects **Revenue Analysts** with a **Continuous Pricing Engine** to adjust fares per shopper, per market, per minute based on demand, competition, and inventory signals.

## Key Personas
- **Revenue Analyst**: Internal staff who review demand forecasts, approve pricing rule changes, and monitor realized yield vs forecast
- **Pricing Engineer**: Internal staff who own the models, manage experiments, and set guardrails against price flapping

## Core Features Required

### Continuous Pricing Engine (3 Pricing Modes)

The application must support **three distinct pricing modes**:

#### 1. AI-Driven Revenue Management
Demand forecasting per O&D × fare class × DCP (days-before-departure):
- Example: *"BOS-LHR Y class 21 days out: forecast 78 bookings, current pace 65"*
- Bid-price optimization that improves on classic EMSR-b on real bookings
- Confidence intervals and per-feature attribution shown alongside each forecast
- Daily forecast refresh with intraday adjustments for high-volatility markets

#### 2. Demand-Based Pricing
Real-time price adjustment using signals beyond the booking curve:
- Booking-curve deviation vs forecast (pace ahead or behind)
- Competitor fare changes detected via the shop feed
- Event-driven demand spikes (concerts, sports, conferences)
- Re-prices within 60 seconds of signal arrival

#### 3. Open Pricing
Continuous price space — every seat priced individually based on shopper context:
- Willingness-to-pay model per traveler segment
- Elasticity-aware adjustments rather than discrete fare buckets
- Guardrails against price flapping and price-discrimination violations

### Experiment Console
- A/B test pricing strategies on a controlled traffic slice
- Significance tracking and auto-rollback on revenue regression
- Shadow scoring of new models against the live model before promotion

## Data Entities
Core entities: Markets, Flights, Fare Classes, Bookings, Searches, Competitor Fares, Events, Customer Profiles, Pricing Rules, Experiment Cohorts

## Technical Considerations
- Sub-200 ms pricing API on Model Serving with feature-store lookup
- Streaming demand signals through the search → cart → book funnel
- ML model versioning with shadow scoring before promotion
- Compliance guardrails so price never varies by protected attributes

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support the core pricing modes for **one O&D market, three fare classes, and one booking curve**. We do not need live competitor scraping, real PSS integration, real payment processing, or user authentication. This will be an **open, public demo** where anyone can replay a static booking-curve CSV and watch the pricing engine adjust prices, run a shadow experiment, and explain its reasoning in real time.
```

---

### 3.6 Intelligent Offers Management

```markdown
Create a simple **intelligent offers management platform** similar to Amazon's "frequently bought together" recommendation engine, but applied to travel ancillaries, loyalty perks, and upgrades.

## Application Type
Marketing + revenue hybrid app that connects **Offer Managers** with a **Real-Time Offer Decision API** to surface the right ancillary, loyalty perk, or upsell at the right moment for every traveler.

## Key Personas
- **Offer Manager**: Internal staff who design offer templates, set eligibility rules, and track conversion and realized margin
- **Loyalty Manager**: Internal staff who define tier-based perks and points-pricing for redemptions

## Core Features Required

### Personalized Offer Decisioning (3 Personalization Lenses)

The application must support **three distinct personalization lenses**:

#### 1. Personalized Ancillaries
For each shopper, every ancillary (bag, seat, meal, lounge, fast-track) is scored:
- Likelihood-to-buy × margin per ancillary type
- Top 3 surfaced in-flow during the booking funnel
- Per-channel guardrails so mobile shows fewer options than email
- Example: *"Surface 'priority bag drop' to a frequent flyer 24 h before departure"*

#### 2. Loyalty-Based Offer Customization
Tier-aware offers that match the member's status:
- Gold members see complimentary upgrade probability + paid upgrade fallback
- Silver members see paid upgrade with points discount
- Non-members see standard paid upsell
- Points-pricing tuned to keep redemption value within target band

#### 3. Cross-Sell / Upsell Optimization
Bandit-driven decisions on when to push attaches:
- Fare upgrade, hotel attach, car attach, or do-nothing
- Per-channel and per-frequency-cap guardrails
- Closed-loop attribution from impression to purchase to refund

### Offer Composer & Attribution
- Drag-and-drop offer builder with eligibility rules, price ladders, and expiry
- Channel preview (web, mobile, email) for each offer before publish
- Realized-margin attribution by traveler segment and offer type

## Data Entities
Core entities: Travelers, Loyalty Members, Bookings, Offers, Channels, Impressions, Conversions, Margin Records, Eligibility Rules

## Technical Considerations
- Real-time offer-decision API under 100 ms on Model Serving
- Multi-armed bandit with Thompson sampling for offer selection
- Feature store with traveler-360 features
- Streaming attribution pipeline from impression to conversion

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **three ancillary types (bag, seat upgrade, lounge), one channel (web booking flow), and one airline**. We do not need real payment processing, email or push channels, partner revenue-share, or user authentication. This will be an **open, public demo** where anyone can search a flight and watch the platform decide which top-3 offers to surface for a sample traveler segment.
```

---

### 3.7 Product & Channel Development

```markdown
Create a simple **product and channel development platform** similar to Shopify's multichannel commerce platform, but applied to travel products distributed across direct, partner, and marketplace channels.

## Application Type
B2B + commercial back-office app that connects **Product Managers** with **Channel Partners** to launch new travel products (routes, fares, experiences) and distribute them consistently across direct, partner, and marketplace channels.

## Key Personas
- **Product Manager**: Internal staff who define products, prices, eligibility, and effective dates
- **Channel Manager**: Internal staff who onboard new partners, set distribution policies, and monitor channel mix

## Core Features Required

### Distribution Platform (3 Channel Strategies)

The application must support **three distinct distribution strategies**:

#### 1. Omnichannel Booking Experience
A single product catalog rendered consistently across every channel:
- Web, mobile app, partner OTAs, GDS, NDC partner stacks
- Same prices, same policies, same imagery on every surface
- Effective-dating so a price change in the catalog propagates everywhere
- Channel-specific layout templates without forking the catalog

#### 2. Partnership & Marketplace Integration
Self-serve partner onboarding pipeline:
- API key issuance and sandbox provisioning
- Certification checklist with automated test cases
- Production cutover with traffic ramp and rollback controls
- Example: *"OTA partner XYZ is 7 of 10 certifications passed and ready for staging traffic"*

#### 3. Direct Booking Optimization
Conversion-rate analytics for direct channel vs partner cost-of-distribution:
- Member-only fares and loyalty bonuses to win share back to direct
- Cost-per-acquisition comparison by channel
- Recommended channel-mix shifts with revenue impact projection

### Product Lifecycle
- Versioned products with effective dating and audit trail
- A/B testing on offer variants with conversion attribution
- Retirement policies that auto-sunset products after a configured date

## Data Entities
Core entities: Products, Channels, Partners, Distribution Rules, Bookings, API Keys, Certification Tests, Channel Performance, Effective-Dated Prices

## Technical Considerations
- API-first design with versioned schemas (OpenAPI plus NDC mappings)
- Effective-dated tables in Lakebase for product and price history
- Partner sandbox isolated by tenancy
- Streaming channel-performance aggregations

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one product type (one-way flight + bag), three channels (direct web, one OTA partner, one GDS), and one partner onboarding flow**. We do not need real NDC integration, real partner settlement, real payment splits, or user authentication. This will be an **open, public demo** where anyone can browse the catalog, walk through partner certification, and see channel mix update in real time.
```

---

### 3.8 AI-Driven Booking

```markdown
Create a simple **AI-driven booking experience** similar to ChatGPT's natural-language interface, but applied to travel search, hold, and book actions.

## Application Type
Consumer-facing web + mobile + voice app that connects **Travelers** with an **LLM Booking Agent** to take a fuzzy intent and return a confirmed booking in 60 seconds rather than 60 minutes of filtering.

## Key Personas
- **Traveler**: End users who describe what they want in plain language and expect the system to handle ambiguity
- **Booking Engineer**: Internal staff who tune agent prompts, register tools, and set safety guardrails

## Core Features Required

### Conversational Booking Experiences (3 Interaction Modes)

The application must support **three distinct interaction modes**:

#### 1. Conversational Booking
Multi-turn chat that handles ambiguity and asks clarifying questions:
- Example: *"Cheapest 1-stop flight to my brother's wedding in Austin in May"*
- Structured trip card shown for confirmation before any payment is taken
- Tool-aware reasoning: search → fare-quote → hold → book → notify
- Graceful fallback to a structured form if confidence is low

#### 2. Intent Booking & Discovery
Higher-level intent that does not specify a destination:
- Example: *"I want a beach somewhere warm next weekend under $600"*
- Agent fans out across destinations, filters by dates and budget
- Ranks results by traveler past behavior and preference signals
- Returns a curated 3–5 trip card list rather than 100 raw results

#### 3. Voice-Activated Booking
Phone-call or in-app voice that mirrors the chat agent:
- Verbal confirmations with explicit dollar-amount read-back
- SMS fallback for visual confirmation of itinerary and price
- Same tool-aware reasoning loop as the chat surface

### Confirmation, Recovery & Audit
- Stateful agent that can modify a booking ("change my Austin flight to Sunday")
- Full conversation log with tool calls and reasoning for replay
- Support-side override panel to correct mistakes the agent made

## Data Entities
Core entities: Travelers, Conversations, Tool Calls, Searches, Holds, Bookings, Payment Tokens, Replay Logs

## Technical Considerations
- Agentic framework (LangGraph or Mosaic AI Agent) on Foundation Model API
- Tool registry with strongly-typed schemas for search, fare-quote, hold, book, cancel
- Real-time streaming responses for conversational latency
- PII redaction enforced in conversation logs

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **text chat (no voice), one airline, USD only, and US domestic flights**. We do not need real payment processing, voice integration, cross-session memory, or user authentication. This will be an **open, public demo** where anyone can chat with the agent, watch tool calls stream, and see a confirmed (mock) booking with reasoning attached.
```

---

### 3.9 Hyper-Personalized Marketing

```markdown
Create a simple **hyper-personalized marketing platform** similar to Salesforce Marketing Cloud, with a Customer 360 view, generative content studio, and real-time next-best-offer decisioning, applied to travel.

## Application Type
Marketing operations app that connects **Marketers** with a **Personalization Engine** to build a real-time Customer 360, generate on-brand creative, and serve the next best action to every traveler at every touchpoint.

## Key Personas
- **Marketer**: Internal staff who build journeys, approve AI-generated creative, and monitor campaign ROI
- **Brand Manager**: Internal staff who define creative guardrails (tone, colors, imagery rules) and approve content before send

## Core Features Required

### Personalization Engine (3 Personalization Pillars)

The application must support **three distinct personalization pillars**:

#### 1. Customer 360
An identity-resolved profile fused from every traveler signal:
- Booking, loyalty, web, app, search, and service interactions stitched to a single ID
- Consent-aware privacy controls that gate which features unlock
- Lifetime value, churn risk, and segment membership precomputed
- Example: *"Top 3 segments for traveler 12345: business commuter, weekend beach, family reunion"*

#### 2. Generative Content Creation
LLM- and image-gen-driven creative that respects brand guardrails:
- Email subject lines, body copy, push notifications, and hero imagery
- Brand-guideline prompt engineering enforces tone and visual consistency
- Human approval flow before any send
- Variant generation for A/B tests in a single click

#### 3. Next Best Offer
Real-time decisioning service for any traveler in any channel:
- Returns the single best action (fare offer, loyalty nudge, content piece, do-nothing)
- Bandit-based exploration with frequency caps and cool-down windows
- Closed-loop measurement with holdouts for causal-impact estimation

### Journey Orchestration
- Visual journey builder with conditional branches and frequency caps
- Trigger library (booking, status change, milestone) with arbitrary fan-out
- Live monitoring of journey performance with cohort-level dashboards

## Data Entities
Core entities: Travelers, Identities, Consents, Profiles, Journeys, Creatives, Sends, Engagements, Conversions, Holdouts

## Technical Considerations
- Identity resolution on Lakehouse (Splink or rules-based)
- Foundation Model API for copy and image generation with brand-guideline prompts
- Bandit-based NBO decisioning with Thompson sampling
- Consent ledger in Lakebase with immutable audit trail

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **one channel (email), one journey ("welcome a new loyalty member"), and three creative variants**. We do not need real ESP integration, image generation, multi-channel orchestration, or user authentication. This will be an **open, public demo** where anyone can pick a sample traveler and watch the platform build their 360 view, generate three on-brand email variants, and pick the next best offer.
```

---

### 3.10 Agentic Customer Service

```markdown
Create a simple **agentic customer service platform** similar to Intercom's Fin AI, with a swarm of specialized agents, sentiment-aware escalation, and proactive issue prevention, applied to travel.

## Application Type
Consumer-facing chat surface plus back-office agent-monitoring console that connects **Travelers** with an **Agent Orchestration Layer** to resolve issues 24/7 across chat, voice, and email — with humans in the loop only when needed.

## Key Personas
- **Traveler**: End users who ask "where's my bag" or "I need a refund" and expect a real answer immediately
- **Customer Care Lead**: Internal staff who watch the agent fleet, spot regressions, and intervene on hot escalations

## Core Features Required

### Agentic Service Capabilities (4 Agent Functions)

The application must support **four distinct agent functions**:

#### 1. 24/7 AI-Powered Assistant
Always-on first-touch agent that authenticates and triages every contact:
- Authenticates the traveler via PNR + last name or loyalty number
- Classifies intent (rebooking, refund, baggage, status, generic)
- Resolves directly or routes to a specialist sub-agent
- Channels: in-app chat, web chat, future voice and email

#### 2. Multi-Agent Issue Resolution
Specialist sub-agents coordinated by a router agent with shared context:
- Rebooking agent for schedule changes and cancellations
- Refund-eligibility agent for fare-rule and entitlement checks
- Lost-baggage agent for tracing and reimbursement workflows
- Schedule-change agent for proactive itinerary adjustments

#### 3. Sentiment Analysis & Escalation
Real-time sentiment and intent scoring on the live conversation:
- Example: *"Sentiment dropped to -0.7; auto-escalate to human with full context attached"*
- Auto-routes angry, vulnerable, or VIP travelers to humans
- Human picks up the case with the agent's reasoning prepopulated

#### 4. Behavioral Targeting
Predicts traveler issues *before* they contact the airline:
- Mishandled-bag prediction triggers a proactive update before complaint
- Connection-risk model triggers proactive rebooking offer
- Reduces inbound contact volume by deflecting predictable issues

### Quality & Compliance Monitor
- Auto-scores every interaction on tone, accuracy, and regulatory phrases
- Flags low-scoring sessions for coaching
- Audit trail with timestamped citations of policy used in answers

## Data Entities
Core entities: Travelers, Conversations, Intents, Tools, Sub-Agent Runs, Sentiment Events, Escalations, QA Scores, Knowledge Articles

## Technical Considerations
- Multi-agent framework (Mosaic AI Agent + LangGraph) on Foundation Model API
- RAG over policy + knowledge base with citation in every answer
- Streaming sentiment classifier on conversation tokens
- Recorded transcripts encrypted at rest with retention policies

## Scope Constraints
**Keep it simple** and focus only on the bare minimum required to support **chat channel only, three specialist sub-agents (rebooking, baggage status, refund-eligibility check), and one language (English)**. We do not need voice integration, real human-handoff workflow, real booking-system integration, or user authentication. This will be an **open, public demo** where anyone can chat with the agent fleet, watch sub-agents pass context to each other, and see sentiment-driven escalation indicators in real time.
```

---

## 4. UI / UX Design Spec — the Outcome Map Grid

The Travel grid is the wow moment of this release. It mirrors the slide's three coloured columns but turns each box into a glassy, animated, clickable card with a Booking-App-style spec ready to stream on click. Below is the full design — palette, layout, anatomy, animations, and interaction choreography — so the build is unambiguous.

### 4.1 Reference & layout sketch

The visual reference is the customer's outcome-map slide (saved at `assets/outcome-map.png`). Three full-width coloured header bands; cards stacked vertically below each band. Our adaptation keeps that structure but adds depth, motion, and a clean tab strip above.

```
┌─ 1 INDUSTRY ─────────────────────────────────────────────────────────────┐
│   [ Sample ]   Travel & Hospitality   ← active underline slides between  │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Agentic AI Ops · 4   │ │ Revenue Growth · 3   │ │ Consumer Center · 3  │
│ ▰▰▰▰▰▰▰▰▰▰  (cyan)  │ │ ▰▰▰▰▰▰▰▰▰▰  (emerald)│ │ ▰▰▰▰▰▰▰▰▰▰  (amber)  │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ ╭──────────────────╮ │ │ ╭──────────────────╮ │ │ ╭──────────────────╮ │
│ │ Card             │ │ │ │ Card             │ │ │ │ Card             │ │
│ │ Card             │ │ │ │ Card             │ │ │ │ Card             │ │
│ │ Card             │ │ │ │ Card             │ │ │ │ Card             │ │
│ │ Card             │ │ │ ╰──────────────────╯ │ │ ╰──────────────────╯ │
│ ╰──────────────────╯ │ │                      │ │                      │
│  ↑ subtle vertical   │ │  ↑ same theme tint   │ │  ↑ same theme tint   │
│  cyan-tint backdrop  │ │  emerald backdrop    │ │  amber backdrop      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### 4.2 Theme palette (slide → Tailwind tokens, theme-aware)

The slide's teal / green / orange map cleanly to Tailwind's `cyan` / `emerald` / `amber` families, which both light and dark modes honour. We use solid theme colour for the column **header band**, a 5–10 % tint for the **column backdrop**, and a 30 % tint for **card edges and glow**.

| Col | Slide tone | Header band | Column backdrop | Card top edge | Hover ring | Selected glow | Icon mark |
|---|---|---|---|---|---|---|---|
| 1 | Dark teal | `bg-gradient-to-r from-cyan-700 to-cyan-600` | `bg-cyan-500/5` (vertical fade) | `border-t-2 border-cyan-500/40` | `ring-cyan-500/40` | `shadow-cyan-500/30` | `text-cyan-100` on white-on-band, `text-cyan-600 dark:text-cyan-300` in card |
| 2 | Green | `bg-gradient-to-r from-emerald-700 to-emerald-600` | `bg-emerald-500/5` | `border-t-2 border-emerald-500/40` | `ring-emerald-500/40` | `shadow-emerald-500/30` | `text-emerald-100` / `text-emerald-600 dark:text-emerald-300` |
| 3 | Orange | `bg-gradient-to-r from-amber-700 to-amber-600` | `bg-amber-500/5` | `border-t-2 border-amber-500/40` | `ring-amber-500/40` | `shadow-amber-500/30` | `text-amber-100` / `text-amber-600 dark:text-amber-300` |

A single `THEMES` map in `outcomeMapTheme.ts` keeps this DRY:

```ts
export const THEMES = {
  1: { // Agentic AI Operations
    headerBand: 'bg-gradient-to-r from-cyan-700 to-cyan-600',
    columnBackdrop: 'bg-gradient-to-b from-cyan-500/8 via-cyan-500/3 to-transparent',
    cardEdge: 'border-t-2 border-cyan-500/40',
    cardHoverRing: 'ring-cyan-500/40 shadow-cyan-500/20',
    cardSelectedRing: 'ring-2 ring-cyan-500/60 shadow-cyan-500/30',
    iconBg: 'bg-cyan-500/10',
    iconAccent: 'text-cyan-600 dark:text-cyan-300',
    pillBg: 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
    countChip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    headerIcon: 'Activity',
  },
  2: { /* emerald analog */ },
  3: { /* amber analog */ },
} as const;
```

### 4.3 Card icons (lucide-react, already in deps)

Icon mapping by `use_case` slug, kept in `outcomeMapTheme.ts` so it doesn't pollute the database row. Fallback `HelpCircle`.

| Card | Icon | Why |
|---|---|---|
| Autonomous Disruption Response | `ShieldAlert` | protective, alert-aware |
| Predictive Maintenance | `Wrench` | tooling, repair |
| Smarter Scheduling | `CalendarClock` | time + scheduling |
| Real-Time Operations View | `Radar` | live ops sweep |
| Dynamic Pricing | `TrendingUp` | revenue / pricing |
| Intelligent Offers Management | `Gift` | offers / packages |
| Product & Channel Development | `Network` | distribution graph |
| AI-Driven Booking | `MessagesSquare` | conversational |
| Hyper-Personalized Marketing | `Sparkles` | gen-AI marketing |
| Agentic Customer Service | `Bot` | agent fleet |

### 4.4 Layout zones

```
PromptGenerator  ──>  IndustryTabs               (§8.2)
                  └─> when industry='travel'
                       └─> OutcomeMapGrid        (§4.1 grid)
                            ├─> ColumnHeaderBand × 3  (§4.5)
                            └─> OutcomeMapCard × 10   (§4.6, themed by category_order)

PromptGenerator  └─> when industry='sample'
                       └─> UseCaseCardGrid       (existing — Sample stays on the simple grid)
```

Each column is a `<section>` with the gradient backdrop. Inside it: a sticky `ColumnHeaderBand` and a `<div>` of stacked `OutcomeMapCard`s with `gap-3`.

### 4.5 Column header band

The header is the slide-style coloured band — bold, full-width, white text, theme icon, animated count chip.

```
┌────────────────────────────────────────────────────────┐
│ ⊛  Agentic AI Operations          ┌──────────────┐    │
│                                   │ 4 use cases  │←tick│  ← count chip ticks 0→4 on first paint
│                                   └──────────────┘    │
└────────────────────────────────────────────────────────┘
   ▲ shimmer sweep on first paint (theme-shimmer animation)
```

Implementation:

- Background: theme `headerBand` gradient (e.g. `bg-gradient-to-r from-cyan-700 to-cyan-600`).
- Left: 18 px theme `headerIcon` in white at 90 % opacity, with 1 cycle of `animate-pulse-glow` on mount.
- Title: `text-white font-semibold text-ui-base` (15 px), tight letter-spacing.
- Right: rounded-full chip with semi-transparent white bg (`bg-white/15 backdrop-blur-sm`) showing `N use cases`. Number animates from `0 → N` over 700 ms via `count-up` keyframe (CSS counter trick or React `requestAnimationFrame`).
- Above the band: a 1 px diagonal **shimmer sweep** that runs once at first paint (`theme-shimmer` keyframe — see §4.9) — gives a "this just appeared" feel.

### 4.6 Card anatomy & visual treatment

A glass-morph card with a coloured top edge, internal layout zones, and reactive surface.

```
┌───────────────────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │  ← 2px theme-tinted top edge
│                                                       │
│ ╭──╮                              ┌──────────────┐    │
│ │⊛│  ← theme icon in tinted disc │ 4 features ↗ │    │  ← count chip in theme tint
│ ╰──╯                              └──────────────┘    │
│                                                       │
│ Autonomous Disruption Response                        │  ← title (text-ui-base, semibold)
│ Resolve traveler disruptions in 2 min, not 4 hours.   │  ← value-prop (muted, line-clamp-2)
│                                                       │
│ ◯ Rebooking   ◯ Weather   ◯ Auto-resolve   ◯ Voucher │  ← leaf-item pills (cascade on hover)
└───────────────────────────────────────────────────────┘
   ↑ glass surface: bg-card/80 backdrop-blur-sm + soft shadow
```

Surface details:

- `bg-card/80 backdrop-blur-sm` (glass-morph)
- `rounded-xl` (12 px) — slightly more than current `UseCaseCardGrid` (10 px) so the column sections breathe
- 2 px theme-tinted top edge (`border-t-2 border-{theme}-500/40`)
- Soft shadow: `shadow-sm` idle → `shadow-lg` + theme-tinted `shadow-{theme}-500/20` on hover
- Inner padding `p-4`, `min-h-[8rem]` so cards in the same column align vertically

Top row:

- **Icon disc**: `w-9 h-9 rounded-lg bg-{theme}-500/10 grid place-items-center` with the lucide icon at `w-5 h-5 text-{theme}-600 dark:text-{theme}-300`. On hover the disc scales to `1.05` and the icon rotates `+4deg` for liveliness.
- **Count chip**: `4 features ↗` in theme tint (`bg-{theme}-500/15 text-{theme}-700 dark:text-{theme}-300 px-2 py-0.5 rounded-full`). Count animates from `0` to `N` on first paint.

Body:

- **Title**: `text-ui-base font-semibold text-foreground` (15 px). One line.
- **Value prop**: `text-ui-sm text-muted-foreground line-clamp-2` (13 px). Derived from the spec's opening line by truncating after the first comma or period (≤ 90 chars), so no DB change needed.

Pill row (leaf items):

- Each pill: `text-ui-2xs px-2 py-0.5 rounded-full bg-{theme}-500/8 border border-{theme}-500/20 text-{theme}-700 dark:text-{theme}-300`
- 3–4 pills per card, drawn from the leaf items in §3
- **Hidden by default** (`opacity-0 translate-y-1`); revealed on **hover** or **selected** with staggered `cascade-in` animation (40 ms per pill)

### 4.7 Interaction states

Five canonical states. Selected dominates: when a card is selected, all sibling cards (across all 3 columns) dim and shrink slightly — the selected card holds the user's attention.

| State | Visual treatment |
|---|---|
| **Idle** | `bg-card/80`, theme top edge, icon disc tinted, pills hidden, `shadow-sm` |
| **Focus-visible** (keyboard) | `ring-2 ring-primary/40` (default focus ring) — distinct from theme ring so keyboard users don't confuse it with theme accent |
| **Hover** | `-translate-y-1`, theme `ring-1 ring-{theme}-500/40`, theme `shadow-lg shadow-{theme}-500/20`, icon disc scales `1.05` and rotates `+4deg`, pills cascade in (40 ms stagger), **magnetic radial gradient** appears behind the card following the cursor (CSS variables `--mx`, `--my` updated on `mousemove`) |
| **Selected** | `BorderBeam` wraps the card (existing `border-beam-wrapper` CSS), theme `ring-2 ring-{theme}-500/60`, theme `shadow-xl shadow-{theme}-500/30`, scale `1.02`, pills permanently visible, icon disc has theme `bg-{theme}-500/20` (deeper tint) |
| **Sibling-of-selected** | `opacity-50 scale-[0.96]` and pills hidden — selected card is unmistakable |
| **Disabled** | `cursor-default`, no hover transforms, `opacity-60` — used while the prompt is streaming |

### 4.8 Tab transition choreography

Switching from **Sample → Travel** (or back) is intentionally cinematic — it telegraphs that something different is loading.

Sequence (~600 ms total):

1. **0–120 ms** — Outgoing grid: cards `opacity 1 → 0` and `translate-x: 0 → -8px` (slide-out-fade-left).
2. **120–180 ms** — Incoming column **headers** appear left-to-right with 60 ms stagger: column 1 → 2 → 3, each with `slide-up-fade` over 200 ms.
3. **180–600 ms** — Incoming **cards** appear column-by-column, top-to-bottom, with 60 ms stagger per card. Each uses `slide-up-fade` over 220 ms.
4. **At 600 ms** — Theme-shimmer sweep runs once across all three header bands simultaneously to "tag" the new content.

Switching back to Sample is the reverse without theme-shimmer (Sample doesn't have themed bands).

### 4.9 Animations & micro-interactions

Reuses **existing** keyframes in [src/index.css](../src/index.css) and adds **three new** keyframes (~25 lines of CSS total).

Existing (no work):

| Element | Animation |
|---|---|
| Tab strip on first paint | `animate-slide-up-fade` |
| Column header icon pulse on mount | `animate-pulse-glow` (one cycle) |
| Cards entrance staggered | `animate-slide-up-fade` with `style={{ animationDelay: \`${idx * 60}ms\` }}` |
| Selected check icon | `animate-scale-in` |
| Selected card highlight | `border-beam-wrapper` (extracted from `BorderBeamButton.tsx` into a reusable wrapper) |

New (added to `index.css`):

```css
/* Pill cascade — used on hover and on selected */
@keyframes cascade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-cascade-in {
  animation: cascade-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Header band shimmer sweep — runs once on mount */
@keyframes theme-shimmer {
  0%   { transform: translateX(-100%); opacity: 0; }
  40%  { opacity: 0.45; }
  100% { transform: translateX(100%); opacity: 0; }
}
.animate-theme-shimmer {
  animation: theme-shimmer 1100ms ease-out 200ms both;
}

/* Count-up — animates the use-case count chip from 0 to N */
@keyframes count-up-fade {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
.animate-count-up-fade {
  animation: count-up-fade 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

Magnetic hover gradient (no keyframe — pure inline style):

```tsx
// On the card root:
const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

// Card class:
// before:absolute before:inset-0 before:rounded-xl before:opacity-0
// before:bg-[radial-gradient(circle_at_var(--mx)_var(--my),_var(--theme-glow)_0%,_transparent_60%)]
// hover:before:opacity-100 before:transition-opacity before:duration-300
```

`--theme-glow` is a CSS variable set per column (`hsl(189 92% 60% / 0.15)` for cyan, etc.), so each column's cards glow in their own colour.

`prefers-reduced-motion: reduce` — all of the above are wrapped in a media query that disables transforms and animations (the existing keyframes already do this; the three new ones inherit the same rule).

### 4.10 Empty / loading states

- **Loading skeleton** — render the final layout (3 columns, 4 / 3 / 3 cards) with skeleton placeholders. Each skeleton card has the theme top edge + a generic shimmer (`animate-pulse` already present). Headers render with theme bands but no count chip until data arrives. Layout shape doesn't shift on load.
- **No category data** — `OutcomeMapGrid` returns `null` when no card carries a `category`; `PromptGenerator` then renders the existing `UseCaseCardGrid`. Sample stays on the simple grid permanently.
- **Streaming the description** — once a card is selected and the spec begins streaming, the **other 9 cards** receive `disabled` state to prevent re-clicks; the selected card retains the BorderBeam.

### 4.11 Component structure

```
src/components/
├── IndustryTabs.tsx           ← refactor of IndustryChips (§8.2)
├── OutcomeMapGrid.tsx         ← NEW — 3-column container, owns transition choreography
├── OutcomeMapColumn.tsx       ← NEW — one column: header band + stacked cards
├── OutcomeMapCard.tsx         ← NEW — single card: anatomy, hover/selected states, magnetic gradient
├── ColumnHeaderBand.tsx       ← NEW — themed band with pulsing icon and count chip
└── outcomeMapTheme.ts         ← NEW — THEMES map + ICON_BY_SLUG map + value-prop deriver
```

Splitting card → column → grid keeps each file small (~80–150 lines) and lets us unit-test card rendering, theme application, and column grouping independently.

### 4.12 Accessibility

- Tab strip is a real `role="tablist"` with arrow-key navigation between Sample / Travel and `aria-selected` on the active tab.
- Column header is `<h3>` so screen readers announce structure.
- Cards are `<button>` with `aria-pressed={isSelected}` and an `aria-label` combining title + theme + leaf count: `"Autonomous Disruption Response, Agentic AI Operations, 4 features"`.
- Theme colour is **never** the only signal — title + theme name in `aria-label` and a small visible text label under the icon.
- `prefers-reduced-motion: reduce` disables transforms, the magnetic gradient, the theme-shimmer, and all custom keyframes — content still renders, just static.
- Pills are decorative (not focusable); the surrounding card is the click target.

### 4.13 Responsive behaviour

| Breakpoint | Layout |
|---|---|
| `lg` and above (≥ 1024 px) | 3 columns side-by-side, full grid |
| `md` (768–1023 px) | 2 columns; column 3 wraps below |
| `sm` (< 768 px) | 1 column; theme headers become collapsible accordions (column 1 open by default; columns 2 and 3 collapsed). Each accordion uses theme-band styling so it still feels like the slide. |

### 4.14 Sample tab (no theming)

Sample remains intentionally simple — there are only two cards (`Booking App`, `Build a Skill`) and no outcome-map theming. The Sample tab renders the existing `UseCaseCardGrid` unchanged, with the Booking App card preselected and highlighted (per §8.1). This keeps the *story arc* clean: **Sample** = simple, fast, single-card focus; **Travel** = themed, immersive, multi-column outcome map.

---

## 5. Schema Change (Lakebase)

Add three optional columns to `usecase_descriptions` so the 3-column theme layout is fully data-driven:

| Column | Type | Purpose |
|---|---|---|
| `category` | `VARCHAR(100) NULL` | e.g. `"Agentic AI Operations"`. NULL for Sample/legacy rows. |
| `category_order` | `INTEGER NULL` | Column position 1, 2, 3 within the industry. |
| `display_order` | `INTEGER NULL` | Card order inside a column. |

### Files

- **DDL inline change** — [db/lakebase/ddl/01_usecase_descriptions.sql](../db/lakebase/ddl/01_usecase_descriptions.sql) — add the columns to the `CREATE TABLE` so fresh installs include them from day one.
- **New migration** — [db/lakebase/ddl/09_add_category_columns.sql](../db/lakebase/ddl/09_add_category_columns.sql) — idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Picked up automatically by [scripts/setup-lakebase.sh](../scripts/setup-lakebase.sh) which globs `db/lakebase/ddl/*.sql` in alphabetical order (`get_ddl_files()` line ~423). No script change required.
- **New index** in the same migration:

```sql
CREATE INDEX IF NOT EXISTS idx_usecase_industry_category
  ON ${schema}.usecase_descriptions(industry, category, category_order, display_order)
  WHERE is_active = TRUE;
```

---

## 6. Seed Data Changes — [db/lakebase/dml_seed/01_seed_usecase_descriptions.sql](../db/lakebase/dml_seed/01_seed_usecase_descriptions.sql)

### 6.1 Deactivate prior Travel cohorts

| Cohort | config_ids | Current `is_active` | Action |
|---|---|---|---|
| Original Travel set | 23–28 (`travel_customer_data`, `customer_insights_activation`, `travel_employee_360`, `travel_agentic_workforce`, `call_center_ops`, `dynamic_pricing`) | `FALSE` | Replace `dynamic_pricing` (28) with the new outcome-map content; delete the other 5 INSERTs (or leave with `is_active=FALSE`). |
| Airline deep-dive set | 100–111 | **`TRUE`** | Flip all 12 to `is_active=FALSE` so they don't pollute the new 10-card grid. Rows stay in the file as preserved content. |

### 6.2 Insert the 10 new Travel rows

All 10 rows share this shape (`prompt_template` content from §3):

```sql
INSERT INTO ${catalog}.${schema}.usecase_descriptions
(industry, industry_label, use_case, use_case_label,
 category, category_order, display_order,
 prompt_template, version, is_active,
 inserted_at, updated_at, created_by)
VALUES
('travel', 'Travel & Hospitality', '<slug>', '<Title>',
 '<Category Title>', <1|2|3>, <1..4>,
 $$<Booking-App-style markdown spec from §3>$$,
 1, TRUE, current_timestamp(), current_timestamp(), current_user());
```

Pin the 10 new rows to **`config_id 200–209`** (no conflict with existing 1, 3–28, 29, 100–111). Matching the explicit-id seed style of every other row in the file. The post-seed sequence reset in [scripts/setup-lakebase.sh](../scripts/setup-lakebase.sh) (line ~643) keeps inserts working on `--recreate`.

### 6.3 Sample untouched

Sample's Booking App row (`config_id 1`) and Skill row (`config_id 29`) stay as-is — `category` is left `NULL`. Sample falls back to the existing `UseCaseCardGrid`.

---

## 7. Backend Changes

### 7.1 [src/backend/api/routes.py](../src/backend/api/routes.py)

| Location | Change |
|---|---|
| `label_overrides` (~line 698) | `{"sample": "Sample"}` |
| YAML-fallback default industry list (~line 837) | `{"value": "sample", "label": "Sample"}` |
| `format_industry_name` map (~line 852) | `"sample": "Sample"` |
| `_refresh_lakebase_cache()` SELECT (~line 145) | Add `category, category_order, display_order` |
| `get_latest_prompt_configs()` SELECT (~line 2790) | Same three columns |
| `get_prompt_config_by_version()` SELECT (~line 2878) | Same three columns |
| `get_use_cases_map()` (~line 741) | Surface `category`, `category_order`, `display_order` per dict |
| `PromptConfigResponse` (~line 593) | Optional `category`, `category_order`, `display_order` |
| `PromptConfigCreate` (~line 583) | Same additions |

`get_use_cases_map` patch sketch:

```python
use_cases_map[industry].append({
    "value": use_case,
    "label": row.get("use_case_label", use_case.title()),
    "path_type": _derive_path_type(row),
    "category": row.get("category"),
    "category_order": row.get("category_order"),
    "display_order": row.get("display_order"),
})
```

### 7.2 [src/backend/prompts_config.yaml](../src/backend/prompts_config.yaml)

- `industries` row for `sample` → `label: "Sample"` (lines 19–20).
- Replace the `travel:` block (lines 89–103) with the 10 new entries (label-only fallback parity):

```yaml
travel:
  - value: ""
    label: "Select a use case..."
  - value: "autonomous_disruption_response"
    label: "Autonomous Disruption Response"
    category: "Agentic AI Operations"
    category_order: 1
    display_order: 1
  # ... 9 more, in the order from §2
```

---

## 8. Frontend Changes

### 8.1 Default selection — [src/components/PromptGenerator.tsx](../src/components/PromptGenerator.tsx)

After `useCases` loads, default to Sample/Booking when no session is restored. Add a small effect after the data-load `useEffect` (~line 252):

```tsx
useEffect(() => {
  if (initialIndustry || initialUseCase) return;       // session restore wins
  if (hasStarted) return;
  if (!Object.keys(useCases).length) return;
  const sampleHasBooking = (useCases['sample'] || []).some(u => u.value === 'booking');
  if (sampleHasBooking) {
    setSelectedIndustry('sample');
    setSelectedUsecase('booking');
  }
}, [useCases, initialIndustry, initialUseCase, hasStarted]);
```

### 8.2 Industry tab strip — refactor [src/components/IndustryChips.tsx](../src/components/IndustryChips.tsx)

Same `SelectOption[]` input. Render as a horizontal tablist with active underline. Keep the "1 INDUSTRY" header above. **Refactor in place** to minimise churn (no new imports across the codebase) — the file becomes a tab strip but exports `IndustryChips` as before. We can add an alias `export { IndustryChips as IndustryTabs }` if the new name is preferred for clarity.

### 8.3 New components

```
src/components/
├── OutcomeMapGrid.tsx         ← 3-column container, theme/order grouping logic
├── OutcomeMapCard.tsx         ← single card with theme + animations
└── outcomeMapTheme.ts         ← THEMES map (§4.2) + ICON_BY_SLUG map (§4.3)
```

`OutcomeMapGrid` props:

```ts
interface OutcomeMapGridProps {
  useCases: SelectOption[];   // each carries optional category, category_order, display_order
  selectedUseCase: string;
  onSelect: (useCase: string) => void;
  disabled?: boolean;
}
```

If no item carries a `category`, the component returns `null` — the parent renders the existing `UseCaseCardGrid` instead.

### 8.4 Wire-up — [src/components/PromptGenerator.tsx](../src/components/PromptGenerator.tsx) ~line 522

```tsx
{selectedIndustry === 'travel' && availableUsecases.some(uc => uc.category) ? (
  <OutcomeMapGrid
    useCases={availableUsecases}
    selectedUseCase={selectedUsecase}
    onSelect={handleUsecaseChange}
    disabled={hasStarted}
  />
) : (
  <UseCaseCardGrid
    useCases={availableUsecases}
    selectedUseCase={selectedUsecase}
    onSelect={handleUsecaseChange}
    disabled={hasStarted}
  />
)}
```

### 8.5 Type extension — [src/api/client.ts](../src/api/client.ts) line ~10

```ts
export interface SelectOption {
  value: string;
  label: string;
  path_type?: 'use_case' | 'skill';
  category?: string;
  category_order?: number;
  display_order?: number;
}
```

### 8.6 New CSS keyframes — [src/index.css](../src/index.css)

Append the **three** new keyframes from §4.9 (full source there). Total ~25 lines of CSS:

- `cascade-in` — pill cascade reveal on hover and selected
- `theme-shimmer` — header band shimmer sweep on first paint and on tab switch
- `count-up-fade` — count chip pop-in for the "N use cases" badge

All three respect `prefers-reduced-motion: reduce` (the existing keyframes already do via the `@media` rule wrapping animations in [src/index.css](../src/index.css)).

---

## 9. Out of Scope / Non-Goals

- **No leaf-level use cases.** The 34 leaf items live as Core Features bullets in their parent's spec — not as their own cards.
- **No Skill flow changes.** *Build a Skill* path is untouched.
- **No new industries.** Retail and CPG remain hidden.
- **No replacement of removed legacy cards.** Customer Data Management, Employee 360, Agentic Workforce, Call Center Operations, and Customer Insights & Activation rows stay in seed but `is_active=FALSE`.
- **No retention of the 12 airline deep-dive rows.** Flipped to `is_active=FALSE`. Confirm in review (Open Question #1).
- **No migration of admin-edited Travel content.** If anyone has hand-edited a Travel row in production via the admin UI, those rows persist (different `version`); they simply don't render in the new grid unless they have a `category`.

---

## 10. Validation Steps

After execution:

1. **Default load** — Refresh the app: Library opens with **Sample** tab active, **Booking App** card highlighted, prompt template streams on click of *Get Started*.
2. **Tab swap** — Click **Travel & Hospitality**: 3-column themed grid renders with exactly 10 cards in the right slots (4 / 3 / 3) and theme-coloured headers.
3. **Card animations** — Cards stagger in; hover lifts + reveals feature chips; selected card shows BorderBeam.
4. **Card selection** — Click any Travel card: streams a Booking-App-style description ending with *Scope Constraints*.
5. **Reduced motion** — With `prefers-reduced-motion`, animations are disabled but layout is intact.
6. **Mobile** — Resize to mobile: column 1 visible by default, column 2 and 3 collapsed under accordions.
7. **No regressions** — Custom-use-case flow ("Create Your Own") and Skill flow remain functional.
8. **Data-driven contract** — `GET /api/use-cases/travel` returns rows with `category` and `category_order`. `GET /api/use-cases/sample` returns rows where `category` is `null`.
9. **Migration safety** — On an existing deployment, `bash scripts/setup-lakebase.sh` (no `--recreate`) runs cleanly: `09_add_category_columns.sql` is idempotent.
10. **YAML fallback** — With Lakebase disabled, the app boots showing `Sample` industry and the 10 Travel use cases (label-only).

---

## 11. Execution Todos

| # | ID | Task |
|---|---|---|
| 1 | `ddl-category` | Add `category`, `category_order`, `display_order` columns inline in `01_usecase_descriptions.sql` and via new `09_add_category_columns.sql` (with the new index). |
| 2 | `seed-travel` | Rewrite Travel & Hospitality seed: deactivate the 6 old rows (23–28) and the 12 airline deep-dive rows (100–111); insert 10 new rows with category fields and the full §3 prompt templates. |
| 3 | `backend-labels` | Update `label_overrides` (`sample` → `Sample`), YAML-fallback strings, and `format_industry_name` map in `routes.py` + `prompts_config.yaml`. |
| 4 | `backend-category` | Surface `category`, `category_order`, `display_order` in `get_use_cases_map()`, `_refresh_lakebase_cache`, `get_prompt_config_by_version`, `get_latest_prompt_configs` SELECTs, and the `PromptConfigResponse` / `PromptConfigCreate` Pydantic models. |
| 5 | `yaml-travel` | Rename `sample` label and replace the `travel` use-case list in `prompts_config.yaml` with the 10 new entries. |
| 6 | `client-types` | Extend `SelectOption` in `src/api/client.ts` with optional `category`, `category_order`, `display_order`. |
| 7 | `industry-tabs` | Convert `IndustryChips` into a horizontal tab strip (refactor in place); wire into `PromptGenerator`. |
| 8 | `default-selection` | In `PromptGenerator`, default `selectedIndustry='sample'` and `selectedUsecase='booking'` when no session-restored selection exists. |
| 9 | `outcome-map-grid` | Add `OutcomeMapGrid.tsx`, `OutcomeMapColumn.tsx`, `OutcomeMapCard.tsx`, `ColumnHeaderBand.tsx`, `outcomeMapTheme.ts`, and the three new keyframes (`cascade-in`, `theme-shimmer`, `count-up-fade`); wire into `PromptGenerator` for the Travel industry; keep `UseCaseCardGrid` fallback for Sample. Implement glass-morph cards, theme-tinted top edges, magnetic radial-gradient hover, BorderBeam selected state, sibling dim/scale, and the cinematic Sample↔Travel tab transition (§4.8). |
| 10 | `validate` | Run the app, verify default selection, tab switching, 3-column travel grid, end-to-end use case selection → streaming description, mobile responsive, reduced-motion, and YAML/DB fallback parity. |

---

## 12. Open Questions for Reviewer

1. **Airline deep-dive rows (100–111).** Plan flips all 12 to `is_active=FALSE`. Acceptable, or do you want to (a) keep one or two active, or (b) move them to a separate hidden segmentation for later use?
2. **Industry component naming.** Plan refactors `IndustryChips.tsx` in place (export name preserved). Acceptable, or rename file to `IndustryTabs.tsx` and update imports?
3. **Theme palette.** Plan uses Tailwind `cyan` / `emerald` / `amber` to match the slide's teal / green / orange while staying theme-aware. Acceptable, or should we introduce custom design tokens that match the slide hex codes exactly?
4. **Card value-prop line.** Plan derives the 1-line value-prop from the spec's opening line (no extra DB column). Acceptable, or do we add a dedicated `tagline VARCHAR(200) NULL` column (a small additional DDL change)?
5. **Sample tab solo behaviour.** Plan always renders the tab strip, even when only Sample is available. Acceptable, or fall back to no tabs in that case?
