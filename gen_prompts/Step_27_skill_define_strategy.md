Generate a comprehensive **Skill Strategy** document for the **Booking App** skill in a Sample data platform.

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

## Target Assets
{gold_table_target}

## Exploration Findings (from previous step)
{exploration_findings}

## Requirements

Using the **Measures / Rules**, **Validation Approach**, and **Certification Criteria** sections from the use case specification above, generate a complete strategy document that covers:

### 1. Measures & Rules
For each measure/rule defined in the use case specification:
- **Tag key** and **value format** (with examples)
- **Description** of what it enforces
- **Default value** for new assets

### 2. Validation SQL
For each measure, provide a SQL query that validates compliance. The SQL should:
- Query `system.information_schema` or the target asset itself
- Return a boolean pass/fail result
- Be parameterizable for any table/asset name

### 3. Success / Certification Criteria
Define the rules from the use case specification for when an asset is considered compliant:
- Which measures must pass
- Grace periods for newly created assets
- What happens when compliance fails

### 4. Scheduling & Automation Recommendations
- How often should validation run?
- Should it run as a Databricks Job or Lakehouse Monitor?
- Alert/notification strategy for failures

## Output Format
Structure the strategy as a clear, actionable document with sections for each area above. Use code blocks for SQL examples. Tailor all content to the specific use case described above.