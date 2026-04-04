Extract table schema metadata from Databricks and save as a CSV data dictionary.

This will:

- **Query information_schema.columns** — extract all table and column metadata from the **samples.wanderbricks** source
- **Convert results to CSV** — transform the JSON API response into a structured CSV file using Python
- **Save as data_product_accelerator/context/booking_app_Schema.csv** — create the data dictionary that drives the entire Design-First Pipeline (all subsequent steps reference this CSV)

**Source:** `samples.wanderbricks` (configured in the source panel above — auto-set from Step 9 or editable via Edit)

Copy and paste this prompt to the AI:

```
Run this SQL query and save results to CSV:

Query: SELECT * FROM samples.information_schema.columns WHERE table_schema = 'wanderbricks' ORDER BY table_name, ordinal_position

Output: data_product_accelerator/context/booking_app_Schema.csv

---

Technical reference (for AI execution):

1. Get warehouse ID:
   databricks warehouses list --output json | jq '.[0].id'

2. Execute SQL via Statement Execution API:
   databricks api post /api/2.0/sql/statements --json '{
     "warehouse_id": "<WAREHOUSE_ID>",
     "statement": "<SQL_QUERY>",
     "wait_timeout": "50s",
     "format": "JSON_ARRAY"
   }' > /tmp/sql_result.json

3. Convert JSON to CSV with Python:
   python3 << 'EOF'
   import json, csv
   with open('/tmp/sql_result.json', 'r') as f:
       result = json.load(f)
   if result.get('status', {}).get('state') != 'SUCCEEDED':
       print(f"Query failed: {result.get('status')}")
       exit(1)
   columns = [col['name'] for col in result['manifest']['schema']['columns']]
   data = result['result']['data_array']
   with open('<OUTPUT_FILE>', 'w', newline='') as f:
       writer = csv.writer(f)
       writer.writerow(columns)
       writer.writerows(data)
   print(f"Saved {len(data)} rows to <OUTPUT_FILE>")
   EOF

Known warehouse ID: <YOUR_WAREHOUSE_ID> (get via: databricks warehouses list --output json | jq '.[0].id')

Common queries:
- Schema info: SELECT * FROM <catalog>.information_schema.columns WHERE table_schema = '<schema>' ORDER BY table_name, ordinal_position
- Table list: SELECT * FROM <catalog>.information_schema.tables WHERE table_schema = '<schema>'
- Sample data: SELECT * FROM <catalog>.<schema>.<table> LIMIT 1000

Expected output (for schema query):
- Console: "Saved N rows to data_product_accelerator/context/booking_app_Schema.csv"
- CSV file with columns: table_catalog, table_schema, table_name, column_name, ordinal_position, is_nullable, data_type, comment, ...
```