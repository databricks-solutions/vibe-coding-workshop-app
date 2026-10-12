import asyncio
import unittest
from unittest.mock import patch

from src.backend.api import value_profiles as vp

RAW = {
    "driver": "cost_avoided",
    "driver_label": "Fewer late departures",
    "value_pool": "Delay costs, millions a year per hub",
    "typical_low": "$2,000,000",
    "typical_high": 500000,
    "rollout_unit": "hubs",
    "rollout_full": 12,
    "hard_share": "Mostly Hard",
}


class NormalizeTests(unittest.TestCase):
    def test_snake_case_is_normalized_and_range_ordered(self):
        p = vp.normalize_profile(RAW)
        self.assertEqual(p["driver"], "cost_avoided")
        self.assertEqual((p["typicalLow"], p["typicalHigh"]), (500000, 2000000))
        self.assertEqual(p["rolloutFull"], 12)
        self.assertEqual(p["hardShare"], "mostly hard")

    def test_camel_case_round_trips(self):
        p = vp.normalize_profile(vp.normalize_profile(RAW))
        self.assertEqual(p, vp.normalize_profile(RAW))

    def test_rejects_unknown_driver_or_missing_value(self):
        self.assertIsNone(vp.normalize_profile({**RAW, "driver": "vibes"}))
        self.assertIsNone(vp.normalize_profile({**RAW, "typical_high": None}))
        self.assertIsNone(vp.normalize_profile({**RAW, "typical_low": 0, "typical_high": 0}))
        self.assertIsNone(vp.normalize_profile("nope"))

    def test_clamps_and_drops_bad_fields(self):
        p = vp.normalize_profile({**RAW, "typical_high": 1e15, "rollout_full": 0, "hard_share": "lots"})
        self.assertEqual(p["typicalHigh"], vp.MAX_VALUE)
        self.assertIsNone(p["rolloutFull"])
        self.assertIsNone(p["hardShare"])


class MemoryStoreTests(unittest.TestCase):
    def setUp(self):
        vp._memory.clear()
        self.no_db = patch.object(vp, "_ensure_table", return_value=None)
        self.no_db.start()

    def tearDown(self):
        self.no_db.stop()
        vp._memory.clear()

    def test_put_and_get(self):
        self.assertTrue(vp.put_profile("travel", "delays", RAW, "derived"))
        self.assertEqual(vp.get_profile("travel", "delays")["source"], "derived")

    def test_submitted_beats_derived(self):
        vp.put_profile("travel", "delays", {**RAW, "typical_high": 9_000_000}, "submitted")
        vp.put_profile("travel", "delays", RAW, "derived")
        got = vp.get_profile("travel", "delays")
        self.assertEqual((got["source"], got["typicalHigh"]), ("submitted", 9_000_000))

    def test_invalid_profile_is_not_stored(self):
        self.assertFalse(vp.put_profile("travel", "delays", {"driver": "x"}, "submitted"))
        self.assertIsNone(vp.get_profile("travel", "delays"))

    def test_profile_for_derives_once(self):
        calls = []

        async def fake(**kwargs):
            calls.append(kwargs)
            return {"response": 'Sure: {"driver": "revenue_uplift", "typical_low": 100000, "typical_high": 400000}'}

        with patch("src.backend.api.routes.call_databricks_serving_endpoint", fake):
            first = asyncio.run(vp.profile_for("retail", "promo", "template"))
            second = asyncio.run(vp.profile_for("retail", "promo", "template"))
        self.assertEqual(first["driver"], "revenue_uplift")
        self.assertEqual(second["typicalHigh"], 400000)
        self.assertEqual(len(calls), 1)

    def test_profile_for_survives_model_failure(self):
        async def broken(**kwargs):
            raise RuntimeError("down")

        with patch("src.backend.api.routes.call_databricks_serving_endpoint", broken):
            self.assertIsNone(asyncio.run(vp.profile_for("retail", "promo", "template")))


if __name__ == "__main__":
    unittest.main()
