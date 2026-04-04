Generate a complete **Agent Skill package** for **Booking App**, following the agentskills.io SKILL.md standard.

## Use Case Specification
Create a simple **consumer marketplace/booking application** similar to Airbnb.

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
**Keep it simple** and focus only on the bare minimum required to support the core search and booking features for **US listings with USD currency**. We do not need user registration, login, user management, host management, property management, or any additional functionality. This will be an **open, public site** where anyone can search for a listing and make a booking.

## Skill Strategy (from previous step)
{skill_strategy}

## Target Assets
{gold_table_target}

## Requirements

Using the **Skill Identity** and **Skill Artifacts** sections from the use case specification, plus the detailed strategy from the previous step, generate a complete Agent Skill package.

### File 1: `<skill-name>/SKILL.md`

The primary skill file following the agentskills.io standard with:
- **Name**: from the Skill Identity section
- **Description**: One-line summary of what the skill does
- **Triggers**: from the Skill Identity section — when should this skill activate
- **Instructions**: Numbered step-by-step instructions the AI agent should follow, derived from the strategy
- **References**: List any reference files
- **Assets**: List any asset files (configs, templates)

### File 2: `<skill-name>/references/<reference-doc>.md`

A reference document containing:
- Validation or execution patterns (SQL, code, etc.) from the strategy
- Example outputs showing pass/fail or expected results
- Parameterized patterns that work with any target asset name

### File 3: `<skill-name>/assets/<config-file>.yaml`

A YAML configuration file defining:
- All measures/rules with their keys, value formats, and defaults
- Success/certification criteria
- Scheduling or automation defaults
- Asset filter patterns (which tables/objects to include/exclude)

## Output Format
Generate all files with clear file path headers. Use proper markdown for SKILL.md, standard markdown for the reference doc, and valid YAML for the config file. Derive all file names, folder names, and content from the use case specification.