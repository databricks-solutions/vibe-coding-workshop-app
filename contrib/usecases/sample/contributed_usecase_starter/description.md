Build a **field service scheduling app** that matches technicians to customer service requests, plans their day, and keeps customers informed.

## Application Type
Operations app used by a **dispatch team** in the office and **field technicians** on mobile devices.

## Key Personas
- **Dispatcher**: Sees every open request, assigns technicians, and fixes the plan when the day changes
- **Field Technician**: Sees today's route, job details, parts needed, and records the outcome of each visit
- **Customer**: Books a visit, gets an arrival window, and receives updates

## Core Features Required

### Request Intake
- Customers request a visit with an address, a problem description and preferred time windows
- Each request gets a priority (emergency, high, standard) and a required skill (e.g. HVAC, electrical, plumbing)

### Smart Scheduling
- Suggest the best technician for each request based on skill, location, availability and workload
- Build each technician's daily route to minimize driving time
- Let dispatchers drag and drop to override any suggestion

### Day-of Changes
- When a job runs long or an emergency arrives, re-plan affected routes and show what changed
- Notify customers automatically when their arrival window moves

### Assistant for Dispatchers
- A chat assistant that answers questions like *"Who can take an urgent electrical job near the airport this afternoon?"* using live schedule data

### Visit Outcomes
- Technicians mark jobs complete, record parts used, and add notes and a customer signature
- Dashboards show first-time fix rate, on-time arrival rate and jobs per technician per day

## Data Entities
Customers, Sites, Service Requests, Technicians, Skills, Shifts, Assignments, Routes, Parts, Visit Outcomes, Notifications

## Technical Considerations
- Web app for dispatchers, mobile-friendly views for technicians
- Map view of technicians and jobs
- Store operational data in Lakebase and analytics in Unity Catalog tables
- Use an LLM for the dispatcher assistant

## Scope Constraints
**Keep it simple.** One region, one company, US addresses, English only. No user management, payments or inventory purchasing. Generate realistic sample data for about 20 technicians and 200 service requests.
