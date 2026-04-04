## Step 5: Build a Validation & Automation Pipeline

The final step is to automate the validation and compliance workflow for your **Booking App** skill so it runs continuously.

### What to Build

**IMPORTANT: The target assets below are EXISTING gold-layer tables. Do NOT create new schemas or tables. Your validation should query the tables already in this schema.**

Ask your AI assistant to create two files:

#### 1. Validation Notebook: `skill_validator.py`

A Databricks notebook that:
- Lists all target assets ({gold_table_target})
- For each asset, reads its current tags/state via the appropriate method
- Runs the validation checks from your skill's reference document
- Collects pass/fail results for each measure/rule
- Updates the asset's status based on results (e.g., applies or removes compliance tags)
- Outputs a summary report of which assets passed/failed and why

Use the **Validation Approach** and **Certification Criteria** from your use case specification to drive the logic.

#### 2. Job Configuration: `skill_validation_job.yml`

A Databricks Asset Bundle (DAB) job YAML that:
- Runs `skill_validator.py` on a schedule (from the use case specification's scheduling recommendations)
- Uses the default SQL warehouse: `Serverless Starter Warehouse`
- Sends email alerts on failure
- Tags the job with a descriptive purpose tag

### Running the Validation

After creating the files:
1. Deploy using `databricks bundle deploy`
2. Run the validation job manually first: `databricks bundle run skill_validation_job`
3. Check the results in the notebook output
4. Verify the compliance status on your target assets

### Deliverables

- [ ] `skill_validator.py` notebook created and tested
- [ ] `skill_validation_job.yml` DAB config created
- [ ] Validation job deployed and run successfully
- [ ] At least one target asset shows the expected compliance status
- [ ] Summary report showing pass/fail results
- [ ] Job scheduled for recurring validation