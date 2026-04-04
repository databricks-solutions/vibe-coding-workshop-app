I have a customer schema at @data_product_accelerator/context/booking_app_Schema.csv.

Please design the Gold layer using @data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md

This skill will orchestrate the following end-to-end design workflow:

- **Parse the schema CSV** — read the source schema file, classify each table as a dimension, fact, or bridge, and infer foreign key relationships from column names and comments
- **Design the dimensional model** — identify dimensions (with SCD Type 1/2 decisions), fact tables (with explicit grain definitions), and measures, then assign tables to business domains
- **Create ERD diagrams** — generate Mermaid Entity-Relationship Diagrams organized by table count (master ERD always, plus domain and summary ERDs for larger schemas)
- **Generate YAML schema files** — produce one YAML file per Gold table with column definitions, PK/FK constraints, table properties, lineage metadata, and dual-purpose descriptions (human + LLM readable)
- **Document column-level lineage** — trace every Gold column back through Silver to Bronze with transformation type (DIRECT_COPY, AGGREGATION, DERIVATION, etc.) in both CSV and Markdown formats
- **Create business documentation** — write a Business Onboarding Guide with domain context, real-world scenarios, and role-based getting-started guides
- **Map source tables** — produce a Source Table Mapping CSV documenting which source tables are included, excluded, or planned with rationale for each
- **Validate design consistency** — cross-check YAML schemas, ERD diagrams, and lineage CSV to ensure all columns, relationships, and constraints are consistent

The orchestrator skill will automatically load its worker skills for merge patterns, deduplication, documentation standards, Mermaid ERDs, schema validation, grain validation, and YAML-driven setup.