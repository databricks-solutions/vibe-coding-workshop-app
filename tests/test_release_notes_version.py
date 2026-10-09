"""
Guards against version drift between the app version and the release notes.

The newest entry in src/constants/releaseNotes.ts must match the project-root
VERSION file (shown in the sidebar) and package.json.

    python3 -m unittest tests.test_release_notes_version -v
"""

import json
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RELEASE_NOTES = REPO_ROOT / "src" / "constants" / "releaseNotes.ts"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def _release_versions() -> list[str]:
    return re.findall(r"^\s*version:\s*'([^']+)'", RELEASE_NOTES.read_text(), re.MULTILINE)


class TestReleaseNotesVersion(unittest.TestCase):
    def test_latest_release_matches_version_file(self):
        versions = _release_versions()
        self.assertTrue(versions, "no releases found in releaseNotes.ts")
        self.assertEqual(versions[0], (REPO_ROOT / "VERSION").read_text().strip())

    def test_latest_release_matches_package_json(self):
        package = json.loads((REPO_ROOT / "package.json").read_text())
        self.assertEqual(_release_versions()[0], package["version"])

    def test_releases_are_unique_semver_newest_first(self):
        versions = _release_versions()
        for v in versions:
            self.assertRegex(v, SEMVER)
        self.assertEqual(len(versions), len(set(versions)), "duplicate release versions")
        as_tuples = [tuple(map(int, v.split("."))) for v in versions]
        self.assertEqual(as_tuples, sorted(as_tuples, reverse=True), "releases must be newest first")


if __name__ == "__main__":
    unittest.main()
