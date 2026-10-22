import unittest
from unittest.mock import patch
from fastapi import HTTPException

from src.backend.api import library


class LibraryGovernanceTest(unittest.TestCase):
    def test_pending_ideate_submission_cannot_be_published_through_generic_library_update(self):
        with (
            patch.object(library, "ensure_library_schema", return_value={"source": True}),
            patch.object(library, "execute_query", return_value=[{"source": "ideate_pending"}]),
        ):
            with self.assertRaises(HTTPException) as caught:
                library._assert_use_case_publishable(
                    "workshop",
                    "airlines",
                    "crew_recovery",
                    {"is_active": True},
                )

        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("review workspace", str(caught.exception.detail))

    def test_approved_ideate_submission_can_be_toggled(self):
        with (
            patch.object(library, "ensure_library_schema", return_value={"source": True}),
            patch.object(library, "execute_query", return_value=[{"source": "ideate_approved"}]),
        ):
            library._assert_use_case_publishable(
                "workshop",
                "airlines",
                "crew_recovery",
                {"is_active": True},
            )

    def test_hiding_never_requires_review_lookup(self):
        with patch.object(library, "execute_query") as query:
            library._assert_use_case_publishable(
                "workshop",
                "airlines",
                "crew_recovery",
                {"is_active": False},
            )
        query.assert_not_called()


if __name__ == "__main__":
    unittest.main()
