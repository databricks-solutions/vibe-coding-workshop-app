# Lakebase Database Setup

This directory contains all DDL and DML SQL files for the Vibe Coding Workshop Lakebase database.

> **Note**: For full automated deployment including tables, use:
> ```bash
> ./scripts/deploy.sh --target user
> ```

## Directory Structure

```
db/lakebase/
├── README.md              # This file
├── ddl/                   # Table definitions (DDL)
│   ├── 01_usecase_descriptions.sql
│   ├── 02_section_input_prompts.sql
│   ├── 03_sessions.sql
│   ├── 04_workshop_parameters.sql
│   ├── 05_saved_usecase_descriptions.sql
│   └── 06_apply_tags.sql
└── dml_seed/              # Initial seed data (DML)
    ├── 01_seed_usecase_descriptions.sql
    ├── 02_seed_section_input_prompts.sql
    ├── 03_seed_workshop_parameters.sql
    └── 03_seed_workshop_parameters.sql.template
```

## SQL File Format

All SQL files use **PostgreSQL-compatible syntax** with `${schema}` placeholder that gets replaced at runtime. Spark SQL syntax elements are transformed automatically:

| Spark SQL | PostgreSQL |
|-----------|------------|
| `${catalog}.${schema}.table` | `schema.table` |
| `current_timestamp()` | `CURRENT_TIMESTAMP` |
| `current_user()` | `CURRENT_USER` |

## Usage

### Setup Script

The main setup script is located at `scripts/setup-lakebase.sh`. It:
1. Reads DDL files from `db/lakebase/ddl/`
2. Reads DML seed files from `db/lakebase/dml_seed/`
3. Transforms Spark SQL syntax to PostgreSQL
4. Executes the statements against Lakebase

### Commands

```bash
# Create tables (if not exist) and seed data
./scripts/setup-lakebase.sh

# Drop and recreate all tables with fresh seed data
./scripts/setup-lakebase.sh --recreate

# Drop all tables
./scripts/setup-lakebase.sh --drop

# Check table status
./scripts/setup-lakebase.sh --status
```

## Tables

### 1. usecase_descriptions
Stores versioned use case descriptions for industries.

| Column | Type | Description |
|--------|------|-------------|
| config_id | SERIAL | Primary key |
| industry | VARCHAR(100) | Industry identifier |
| industry_label | VARCHAR(255) | Display label for industry |
| use_case | VARCHAR(100) | Use case identifier |
| use_case_label | VARCHAR(255) | Display label for use case |
| prompt_template | TEXT | Full use case description text |
| version | INTEGER | Version number |
| is_active | BOOLEAN | Whether this version is active |

### 2. section_input_prompts
Stores versioned input prompts for each workflow step.

| Column | Type | Description |
|--------|------|-------------|
| input_id | SERIAL | Primary key |
| section_tag | VARCHAR(100) | Unique identifier for the step |
| section_title | VARCHAR(255) | Display title |
| section_description | TEXT | Brief description |
| input_template | TEXT | Prompt template with variables |
| system_prompt | TEXT | System prompt for LLM |
| order_number | INTEGER | Display order |
| how_to_apply | TEXT | Instructions for users |
| expected_output | TEXT | Expected deliverables |
| version | INTEGER | Version number |
| is_active | BOOLEAN | Whether this version is active |

### 3. sessions
Stores user sessions with workflow progress.

| Column | Type | Description |
|--------|------|-------------|
| session_id | VARCHAR(36) | Primary key (UUID) |
| created_by | VARCHAR(255) | User who created the session |
| session_name | VARCHAR(100) | Optional name |
| session_description | VARCHAR(500) | Optional description |
| industry / use_case | VARCHAR(100) | Selected industry/use case |
| industry_label / use_case_label | VARCHAR(255) | Display labels |
| feedback_rating | VARCHAR(20) | User feedback rating |
| feedback_comment | TEXT | User feedback comment |
| chapter_feedback | JSONB | Per-chapter feedback. Default: '{}' |
| step_1_prompt | TEXT | Generated prompt for step 1 |
| step_prompts | JSONB | Generated prompts for steps 2-31 (keys: "2" to "31"). Default: '{}' |
| prerequisites_completed | BOOLEAN | Whether prerequisites are done |
| current_step | INTEGER | Current step number (1-31) |
| workshop_level | VARCHAR(20) | Workshop level (app, app-database, end-to-end, accelerator, etc.) |
| completed_steps | TEXT | JSON array of completed step numbers |
| skipped_steps | TEXT | JSON array of skipped step numbers. Default: '[]' |
| session_parameters | JSONB | Per-session parameter overrides. Default: '{}' |

### 4. saved_usecase_descriptions
Community library of user-generated use case descriptions from the Build Your Use Case feature. All users can view and edit.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| created_by | VARCHAR(255) | Original creator email |
| display_name | VARCHAR(255) | Display name |
| updated_by | VARCHAR(255) | Last editor email |
| industry | VARCHAR(255) | Industry identifier |
| use_case_name | VARCHAR(255) | Use case name |
| description | TEXT | Full use case description |
| version | INTEGER | Version number. Default: 1 |
| is_active | BOOLEAN | Whether this entry is active. Default: true |

### 5. workshop_parameters
Stores configurable key-value parameters that are available to all workflow steps and prompts.
These parameters can be configured via the UI (Configuration → Workshop Parameters tab).

| Column | Type | Description |
|--------|------|-------------|
| param_id | SERIAL | Primary key |
| param_key | VARCHAR(100) | Unique key used in templates (e.g., `workspace_url`) |
| param_label | VARCHAR(255) | Display label shown in UI |
| param_value | TEXT | Current parameter value |
| param_description | TEXT | Description of what this parameter is for |
| param_type | VARCHAR(50) | Type hint for UI: text, url, select, number |
| display_order | INTEGER | Order in which parameter appears in UI |
| is_required | BOOLEAN | Whether the parameter is required |
| is_active | BOOLEAN | Whether this parameter is active |

**Default Parameters** (values are generated from `user-config.yaml` during install):
- `workspace_url` - Databricks workspace URL
- `default_warehouse` - Default SQL Warehouse name
- `lakebase_instance_name` - Lakebase project/instance name (used in Steps 6 and 7)
- `lakebase_host_name` - Lakebase PostgreSQL endpoint DNS

## Adding New Use Cases

1. Add a new INSERT statement to `dml_seed/01_seed_usecase_descriptions.sql`
2. Follow the existing format with all required fields
3. Run `./scripts/setup-lakebase.sh --recreate` to apply

## Modifying Section Prompts

1. Edit `dml_seed/02_seed_section_input_prompts.sql`
2. Update the relevant INSERT statement
3. Run `./scripts/setup-lakebase.sh --recreate` to apply

## Variables in Templates

Input templates support these variables (replaced at generation time):

### Built-in Variables
| Variable | Source | Used In |
|----------|--------|---------|
| `{industry_name}` | Selected industry label | All steps |
| `{use_case_title}` | Selected use case label | All steps |
| `{use_case_description}` | From usecase_descriptions table | Steps 1-5 |
| `{prd_document}` | Output from Step 3 | Steps 4, 6, 10, 13, 14 |
| `{table_metadata}` | Output from Step 10 | Steps 11, 12, 13 |
| `{silver_layer_output}` | Output from Step 13 | Step 14 |
| `{gold_layer_output}` | Output from Step 11 | Steps 12, 14 |
| `{gold_layer_design}` | Output from Step 11 | Steps 12, 13, 14 |

### Workshop Parameters (Configurable via UI)
These parameters are stored in the `workshop_parameters` table and can be edited in the Configuration → Workshop Parameters tab:

| Variable | Description |
|----------|-------------|
| `{workspace_url}` | Databricks workspace URL (from `user-config.yaml`) |
| `{default_warehouse}` | Default SQL Warehouse name |
| `{lakebase_instance_name}` | Lakebase project/instance name |
| `{lakebase_host_name}` | Lakebase PostgreSQL endpoint DNS |

To add new workshop parameters:
1. Insert a new row in `workshop_parameters` table
2. Use `{param_key}` syntax in templates to reference it
3. The value will be substituted when prompts are generated

## Important: Running Generated Prompts

**For Steps 3 onwards**, the generated prompts are designed to be run in the **Template Repository** that users clone as part of the Prerequisites (Step 0). These prompts assume:

1. The user has cloned the Template Repository
2. A coding assistant (Cursor, Copilot, or Claude) is enabled in that codebase
3. The prompts reference files and rules (`@context/prompts/`, `@.cursor/rules/`) that exist in the template repository

The "How to Apply" instructions for each step include this prerequisite note.
