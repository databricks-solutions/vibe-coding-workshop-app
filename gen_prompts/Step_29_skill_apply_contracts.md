## Step 4: Apply & Test Your New Skill

Now that you have your complete Agent Skill package (SKILL.md + references + assets), it's time to save it to your project and test it against your target assets.

### Your Use Case: Booking App

### Save the Skill to Your Project

Copy the generated files into your project using the folder structure from the SKILL.md output:

```
data_product_accelerator/skills/common/<your-skill-name>/
├── SKILL.md
├── references/
│   └── <reference-doc>.md
└── assets/
    └── <config-file>.yaml
```

Use the exact file names and folder structure from the previous step's output.

### Test the Skill

Ask your AI assistant to use the new skill against your target assets:

Target: **{gold_table_target}**

**IMPORTANT: These are EXISTING gold-layer tables. Do NOT create new schemas or tables. Your skill should read and apply governance to the tables already in this schema.**

For example, ask:
> "Use the <skill-name> skill to apply [your measures/rules] to the existing tables in my target schema"

### Verify the Results

After the agent executes the skill, verify the results. For Unity Catalog tags:

```sql
SHOW TAGS ON TABLE <catalog>.<schema>.<table_name>;
```

For other asset types, use the verification approach described in your use case specification.

### Deliverables

- [ ] All skill files saved to the correct folder structure
- [ ] Skill applied to at least one target asset
- [ ] Results verified using the appropriate verification method
- [ ] No errors during skill execution