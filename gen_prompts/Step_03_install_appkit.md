## Install and Set Up Databricks AppKit

Complete this prerequisite before running any app-building prompts.

---

### Step 1: Verify System Requirements

```bash
node -v              # Must be v22+
databricks --version # Must be v0.295.0+
```

If missing: Node.js from https://nodejs.org/ (v22 LTS), Databricks CLI from https://docs.databricks.com/en/dev-tools/cli/install.html

---

### Step 2: Authenticate to Databricks

```bash
databricks auth login --host https://adb-4101016551133680.0.azuredatabricks.ne
databricks current-user me --output json | jq -r '.userName'
```

---

### Step 3: Bootstrap the AppKit Project

```bash
databricks apps init
```

Select **AppKit** as the framework, choose plugins (analytics, lakebase, etc.). The CLI scaffolds the project, installs dependencies, and optionally deploys.

---

### Step 4: Install AI Coding Assistant Skills

```bash
databricks experimental aitools skills install
```

---

### Step 5: Verify

```bash
npm run dev
```

Open http://localhost:8000 — the default AppKit page should load. Run `npx @databricks/appkit docs` for inline documentation.