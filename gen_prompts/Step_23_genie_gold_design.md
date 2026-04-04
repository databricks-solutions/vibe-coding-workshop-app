I have enriched silver layer metadata at @data_product_accelerator/context/booking_app_Metadata.csv and a metadata analysis at @docs/genie_plan.md.

The business requirements are documented in @docs/design_prd.md.

Please design the Gold layer using @data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md

This skill will orchestrate the following end-to-end design workflow:

- **Parse the metadata CSV** — read the enriched metadata file (includes table comments, column comments, constraints, and tags), classify each table as a dimension, fact, or bridge, and use constraint info to map foreign key relationships
- **Cross-reference with PRD** — align the Gold design with business requirements, user personas, and use case workflows documented in the PRD
- **Cross-reference with Genie plan** — use the genie_plan.md analysis for table relevance assessments and recommended Genie Space structure
- **Design the dimensional model** — identify dimensions (with SCD Type 1/2 decisions), fact tables (with explicit grain definitions), and measures, then assign tables to business domains
- **Create ERD diagrams** — generate Mermaid Entity-Relationship Diagrams organized by table count (master ERD always, plus domain and summary ERDs for larger schemas)
- **Generate YAML schema files** — produce one YAML file per Gold table with column definitions, PK/FK constraints, table properties, lineage metadata, and dual-purpose descriptions (human + LLM readable)
- **Document column-level lineage** — trace every Gold column back through Silver with transformation type (DIRECT_COPY, AGGREGATION, DERIVATION, etc.) in both CSV and Markdown formats
- **Create business documentation** — write a Business Onboarding Guide with domain context, real-world scenarios, and role-based getting-started guides
- **Map source tables** — produce a Source Table Mapping CSV documenting which source tables are included, excluded, or planned with rationale for each
- **Validate design consistency** — cross-check YAML schemas, ERD diagrams, and lineage CSV to ensure all columns, relationships, and constraints are consistent

The orchestrator skill will automatically load its worker skills for merge patterns, deduplication, documentation standards, Mermaid ERDs, schema validation, grain validation, and YAML-driven setup.

IMPORTANT: Use the EXISTING catalog `jaiwa_vibe_coding_workshop_catalog` -- do NOT create a new catalog. Create the Gold schema `jaiwant_j_booking_app_gold` and all Gold tables inside this catalog.

NOTE: Before creating the schema, check if `jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_gold` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.