Save the uploaded schema metadata CSV and validate it for the Design-First Pipeline.

This will:

- **Save the CSV file** to `data_product_accelerator/context/booking_app_Schema.csv`
- **Validate metadata quality** — check for missing comments, incorrect data types, and sequencing issues
- **Enrich if needed** — fill missing fields, normalize types, and add recommended columns
- **Print verification summary** — confirm table count, column count, and any fixes applied

Copy and paste this prompt to the AI:

```
Save the following CSV content to: data_product_accelerator/context/booking_app_Schema.csv

--- CSV CONTENT START ---
{csv_content}
--- CSV CONTENT END ---

After saving the file, validate and enrich the metadata:

1. Validate structure:
   - Verify required columns: table_name, column_name, data_type, ordinal_position, is_nullable, comment
   - Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
   - Remove empty or duplicate rows

2. Enrich metadata:
   - Fill empty comment fields with descriptions inferred from column_name and table_name
   - Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
   - Add table_catalog and table_schema columns if missing (default: wanderbricks)

3. Print verification summary:
   - Total tables found
   - Total column definitions
   - File path where CSV was saved
   - List of fixes applied (if any)

Downstream Compatibility Note:
This CSV drives the entire Design-First Pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Bronze Creation (Step 12) — uses schema to create Delta tables
- Silver DQ (Step 13) — uses schema for data quality expectations
- Gold Implementation (Step 14) — uses YAML schemas derived from this CSV
Missing comments, incorrect types, or invalid rows will cascade into errors downstream.
```