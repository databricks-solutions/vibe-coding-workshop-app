"""Contributed use cases: file-based use cases submitted to ``contrib/`` by pull request.

Contributors (individuals, companies, groups and partners) register once under
``contrib/contributors/`` and add use cases under ``contrib/usecases/``. The app
loads and validates them at startup and merges them into the Lakebase catalog.
See ``contrib/README.md`` for the contributor guide.
"""

KEY_PREFIX = "contrib__"
COMMUNITY_COLLECTION_ID = "community_contributions"
COMMUNITY_COLLECTION_LABEL = "Partner & Community"
SAMPLE_CONTRIBUTOR_ID = "sample"


def is_contributed_key(use_case: str | None) -> bool:
    return bool(use_case) and use_case.startswith(KEY_PREFIX)
