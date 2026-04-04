Generate a prompt that I can copy into my AI coding assistant (Cursor/Copilot) to create a simple Product Requirements Document (PRD).

The generated prompt MUST include these instructions at the very beginning:

```
## IMPORTANT - READ FIRST
Your ONLY task is to create a PRD document. Do NOT:
- Generate any code or scripts
- Create any implementation files
- Start building the application
- Define table structures, schemas, or database designs
- Create table names or data models
- Define API endpoints, routes, or API specifications
- Include implementation-specific logic or technical details
- Do anything other than creating the PRD

You MUST:
- Create ONLY the PRD document
- Save it to: docs/design_prd.md
- STOP after saving the PRD - do nothing else
```

After those instructions, the prompt should ask for a simple, focused PRD for a Sample application focused on Booking App.

## Use Case Context to Include
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

## Application Context to Include
- **Industry**: Sample
- **Use Case**: Booking App
- Use a neutral, professional product name and generic terminology
- Web first, but include mobile considerations if applicable

## PRD Focus Guidelines
**Keep it simple** - Focus on providing enough details to generate a clear, readable PRD without over-engineering.

**Important Constraints:**
- Do NOT include table definitions, table names, or database schema designs - these will come in later steps
- Do NOT include API definitions, endpoints, or implementation-specific logic
- Only focus on **High Value workflows**
- Document **Happy Path only** - skip edge cases and error handling details for now
- Prioritize clarity over completeness

## PRD Structure to Request
The generated prompt should ask for a PRD with these sections:

1. **Summary** - Product vision, problem statement, target personas (2-3 max), goals + non-goals
2. **Scope** - MVP scope only, clear out of scope items
3. **User Journeys** - High-value end-to-end flows (Happy Path only) for primary personas
4. **Functional Requirements** - Key requirements with simple acceptance criteria
5. **Non-Functional Requirements** - Basic performance, security, accessibility notes
6. **High-Level Data Entities** - Entity names and relationships only (NO table definitions or schemas)
7. **Release Plan** - Simple milestones from MVP to GA

The prompt MUST end with:
```
Save this PRD to: docs/design_prd.md
STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks.
```