from pathlib import Path

from src.backend.identity import PRODUCT_VERSION, build_user_agent


ROOT = Path(__file__).resolve().parents[2]


def test_user_agent_keeps_existing_shape_without_feature_tags():
    user_agent = build_user_agent(
        section_tag="gold_model",
        industry="retail",
        use_case="demand_forecasting",
    )

    assert user_agent.startswith(f"vibe-to-value-workshop/{PRODUCT_VERSION} ")
    assert "section/gold_model" in user_agent
    assert "industry/retail" in user_agent
    assert "usecase/demand_forecasting" in user_agent
    assert "feature/" not in user_agent
    assert "action/" not in user_agent
    assert "detail/" not in user_agent


def test_user_agent_adds_only_sanitized_feature_tags():
    user_agent = build_user_agent(
        feature="Idea Studio",
        action="AI/Score",
        detail="Judge (Quality)",
    )

    assert "feature/Idea-Studio" in user_agent
    assert "action/AI-Score" in user_agent
    assert "detail/Judge-Quality" in user_agent
    assert "/" not in user_agent.split("action/", 1)[1].split(" ", 1)[0]
    assert "(" not in user_agent
    assert ")" not in user_agent


def test_user_agent_uses_current_workshop_version():
    assert PRODUCT_VERSION == (ROOT / "VERSION").read_text().strip()
    assert build_user_agent().startswith(f"vibe-to-value-workshop/{PRODUCT_VERSION} ")


def test_feedback_telemetry_ua_uses_bounded_enums_without_pii():
    from src.backend.api.routes import _feedback_telemetry_ua

    ua = _feedback_telemetry_ua("thumbs_up", "idea-studio", True)
    assert "feature/feedback" in ua
    assert "action/thumbs-up" in ua
    assert "detail/idea-studio-followup" in ua

    fallback_ua = _feedback_telemetry_ua("weird", "secret@email.com", False)
    assert "feature/feedback" in fallback_ua
    assert "action/rated" in fallback_ua
    assert "detail/app" in fallback_ua
    assert "email" not in fallback_ua

