# Setting up the synthetic-data branch (step 59)

Only needed if you want to **generate** a dataset. If you already have tables, the connect
branch needs none of this and is the better choice anyway.

Everything below was worked out by getting it running against a real FEVM workspace
(`fevm-genie-workbench-demo`, serverless DBR 18.x). Three things bite, in order, and each
one fails in a way that does not obviously point at the cause.

---

## 1. It needs its own Python 3.12 venv

The app runs on **Python 3.11**. `databricks-connect` UDFs require the **client's minor
Python version to match the server's**, and serverless is on 3.12. Run a Faker UDF from a
3.11 venv and you get:

```
SparkConnectGrpcException: Python versions in the Spark Connect client and server are
different. To execute user-defined functions, client and server should have the same
minor Python version.
```

Note what does and does not break: **plain SQL through `databricks-connect` works fine on
3.11.** Only UDFs fail — which is precisely what Faker-based generation is. So a smoke test
of `spark.sql("SELECT 1")` passes and tells you nothing.

Do not "fix" this by rebuilding the app's venv on 3.12. Keep them separate:

```bash
uv venv .venv-datagen --python 3.12
VIRTUAL_ENV=.venv-datagen uv pip install "databricks-connect>=16.4,<17.4" faker numpy pandas holidays
```

`.venv-datagen/` is gitignored.

## 2. `databricks-connect` must be pinned

On Python 3.12, an unpinned install resolves to the newest release (19.0.0 at time of
writing), which fails with:

```
SparkConnectGrpcException: Serverless mode is not yet supported in this version of
Databricks Connect.
```

The `>=16.4,<17.4` range above is what the `databricks-synthetic-data-gen` skill itself
specifies. It resolved to **17.3.12**, which works against serverless DBR 18.x.

## 3. Serverless executors cannot see your local `faker`

This is the one the skill gets wrong. Its troubleshooting table says:

> | `ModuleNotFoundError: faker` | Install locally: `uv pip install faker`, import inside UDF |

Installing locally is necessary but **not sufficient**. The UDF body runs on the serverless
executors, which have their own environment, so importing Faker inside the function still
raises:

```
[PYTHON_EXCEPTION] ModuleNotFoundError: No module named 'faker'  SQLSTATE: 38000
```

Ship the package to the session as an artifact. Verified working — 15,000 rows with real
city names:

```python
import os, shutil, tempfile
import pandas as pd, pyspark.sql.functions as F
from pyspark.sql.types import StringType
from databricks.connect import DatabricksSession

spark = DatabricksSession.builder.profile("<your-profile>").serverless(True).getOrCreate()

# Ship the locally installed faker to the executors (~2 MB).
site = ".venv-datagen/lib/python3.12/site-packages"
zipped = shutil.make_archive(os.path.join(tempfile.mkdtemp(), "faker_pkg"), "zip", site, "faker")
spark.addArtifacts(zipped, pyfile=True)

@F.pandas_udf(StringType())
def fake_city(seed: pd.Series) -> pd.Series:
    from faker import Faker          # import inside the UDF, per the skill
    fake = Faker()
    return seed.map(lambda s: (Faker.seed(int(s)) or fake.city()))

df = spark.range(0, 15000).withColumn("store", fake_city("id"))
print(df.count())
```

`spark.addArtifacts(..., pypi=True)` does **not** exist — it raises `TypeError: got an
unexpected keyword argument 'pypi'`. Zip the installed package as above.

**A trap worth knowing:** artifacts persist for the life of the session, so once you have
called `addArtifacts` a later UDF may succeed and make you think the local install was
enough. Start a fresh process to check honestly.

## 4. The profile needs serverless enabled

Add to your profile block in `~/.databrickscfg`:

```ini
serverless_compute_id = auto
```

Without it, `databricks-connect` cannot acquire compute and fails on connect — before
anything to do with the workshop runs.

---

## Confirming it all works

```bash
DATABRICKS_CONFIG_PROFILE=<your-profile> .venv-datagen/bin/python - <<'PY'
from databricks.connect import DatabricksSession
spark = DatabricksSession.builder.serverless(True).getOrCreate()
print(spark.sql("SELECT current_version().dbr_version AS v").collect()[0].v)
PY
```

That proves connectivity. It does **not** prove UDFs work — for that, run the Faker snippet
in §3, which is the thing step 59 actually depends on.

## If you would rather not

Use the connect branch. Point the workshop at tables you already have. Real data has real
skew and real nulls, which makes the later data-quality decisions genuine rather than
theoretical — and it costs none of the setup above.
