## Step 1: Explore Existing Skills in Your Template Repository

Now that you have cloned the workshop template repository (from Step 2), let's explore the existing Agent Skills that ship with it and identify the gap your new skill will fill.

### Your Use Case: Booking App
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

### Navigate to the Skills Directory

Open your cloned repository and explore these two key skills:

```
data_product_accelerator/skills/common/naming-tagging-standards/SKILL.md
data_product_accelerator/skills/admin/create-agent-skill/SKILL.md
```

### What to Look For

**In `naming-tagging-standards/SKILL.md`:**
- How tags are defined (naming conventions, owner, domain)
- The SET TAGS SQL patterns used
- What governance tags are currently covered
- What capabilities are **missing** that your use case requires

**In `create-agent-skill/SKILL.md`:**
- The standard folder structure for new skills (SKILL.md, assets/, references/)
- How instructions are organized as numbered steps
- How references and assets are declared
- The agentskills.io specification patterns

### Identify the Gap

Review the **Measures / Rules** and **Extends** sections from your use case description above. The existing skills provide a foundation, but they do **not** address the specific capabilities your new skill needs.

### Your Target Assets

{gold_table_target}

### Deliverables

After exploring, you should understand:
- [ ] How existing skills are structured (SKILL.md + references/ + assets/)
- [ ] What the existing skills already cover
- [ ] What specific gap your new skill (Booking App) will fill
- [ ] Which target assets (tables, schemas) you will work with