"""Workshop assembler — the single implementation of ``get_section_input_content``.

Mechanically extracted from ``src/backend/api/routes.py`` (formerly at
routes.py:1241) with behavior preserved byte-for-byte (D3 §7, invariant I2 —
"no second assembler"). ``routes.py`` re-exports this function, so
``routes.get_section_input_content`` and
``assembler.get_section_input_content`` resolve to the SAME code object.

The ~15 module-local helpers this assembler depends on (fork resolver, prompt
maps, workshop-parameter resolution, brand oklch conversion, …) remain in
``routes.py`` and are imported lazily inside the function to avoid an import
cycle. A byte-parity test (tests/workshop/test_assembler_parity.py, D8 §2.4)
guards this extraction.
"""
from typing import Dict, Optional


def get_section_input_content(industry: str, use_case: str, section_tag: str, previous_outputs: Optional[Dict[str, str]] = None, session_id: Optional[str] = None, coding_assistant_override: Optional[str] = None) -> Dict[str, str]:
    """
    Get the input content (context/requirements) for a specific section.
    Templates are loaded from prompts_config.yaml with parameter substitution.
    
    Parameters substituted:
      - {industry_name}: Formatted industry name
      - {use_case_title}: Formatted use case title
      - {use_case_description}: Full prompt template text for this use case
      - {section_tag}: The section identifier
      - {prd_document}: PRD document from Step 2 (for UI design steps)
      - Workshop parameters: {workspace_url}, {lakebase_instance_name}, {lakebase_host_name}, {default_warehouse}
      - Any other keys from previous_outputs dict
    """
    # Deferred import breaks the routes<->assembler import cycle: routes.py
    # re-exports this function at module-load time, so importing routes lazily
    # (at call time, not import time) keeps both modules importable. Every
    # helper below resolves to the live routes.py definition, so there stays
    # exactly ONE assembler (D3 invariant I2) and test monkeypatches on the
    # routes module are honoured.
    from src.backend.api import routes
    format_industry_name = routes.format_industry_name
    format_use_case_name = routes.format_use_case_name
    get_prompt_templates_map = routes.get_prompt_templates_map
    get_effective_workshop_parameters = routes.get_effective_workshop_parameters
    get_section_input_prompts_map = routes.get_section_input_prompts_map
    get_section_input_template = routes.get_section_input_template
    _normalize_coding_assistant = routes._normalize_coding_assistant
    _get_session_coding_assistant = routes._get_session_coding_assistant
    get_section_input_prompts_from_lakebase = routes.get_section_input_prompts_from_lakebase
    get_workshop_parameters_sync = routes.get_workshop_parameters_sync
    _hex_to_oklch = routes._hex_to_oklch
    DEFAULT_CODING_ASSISTANT_KEY = routes.DEFAULT_CODING_ASSISTANT_KEY
    logger = routes.logger

    industry_name = format_industry_name(industry)
    use_case_title = format_use_case_name(use_case)
    
    # Look up the detailed use case description from prompt_templates
    prompt_templates = get_prompt_templates_map()
    use_case_description = ""
    
    if industry.lower() in prompt_templates:
        industry_templates = prompt_templates[industry.lower()]
        if use_case.lower() in industry_templates:
            use_case_description = industry_templates[use_case.lower()]
    
    # Fallback description if not found
    if not use_case_description:
        use_case_description = f"Build a {use_case_title} solution for the {industry_name} industry."
    
    # Get workshop parameters (includes session-specific overrides if session_id is provided)
    workshop_params = get_effective_workshop_parameters(session_id)
    
    # Check for session-level use case overrides (user-edited name/description)
    if session_id:
        custom_desc = workshop_params.get('custom_use_case_description', '').strip()
        if custom_desc:
            use_case_description = custom_desc
        custom_title = workshop_params.get('custom_use_case_label', '').strip()
        if custom_title:
            use_case_title = custom_title
    
    # Load section inputs from config
    section_input_prompts_config = get_section_input_prompts_map()

    # Resolve the correct prompt for the session's coding assistant.
    # Falls back to the legacy 'default' section_tag entry if the requested tag
    # has no row in the database at all (preserves pre-existing behavior).
    # When `coding_assistant_override` is provided (Test Scenario tab), it takes
    # priority over the session lookup so an explicit choice can drive fork
    # resolution without persisting anything to a session.
    if coding_assistant_override is not None and coding_assistant_override != "":
        assistant_key = _normalize_coding_assistant(coding_assistant_override)
    else:
        assistant_key = _get_session_coding_assistant(session_id)
    fork_template = get_section_input_template(section_tag, assistant_key)
    template = (
        fork_template
        or section_input_prompts_config.get(section_tag)
        or section_input_prompts_config.get('default', {})
    )
    # Resolve which assistant variant actually provided the prompt content.
    # If a fork row exists for (section_tag, assistant_key), the fork wins;
    # otherwise the Default row is used (even when a non-default assistant is
    # selected). This value is returned to the UI so it can render a pill.
    resolved_variant = DEFAULT_CODING_ASSISTANT_KEY
    if assistant_key != DEFAULT_CODING_ASSISTANT_KEY:
        _rows = get_section_input_prompts_from_lakebase() or []
        _has_fork = any(
            r.get("section_tag") == section_tag and r.get("coding_assistant") == assistant_key
            for r in _rows
        )
        if _has_fork:
            resolved_variant = assistant_key
        logger.info(
            f"[Prompt Resolver] section_tag={section_tag} assistant={assistant_key} "
            f"variant={'fork' if _has_fork else 'default'}"
        )
    
    # Replace parameters in templates
    input_text = template.get('input', '')
    input_template_raw = input_text  # Keep the raw template with variables for reference
    system_prompt = template.get('system_prompt', '')
    how_to_apply = template.get('how_to_apply', '')
    expected_output = template.get('expected_output', '')
    how_to_apply_images = template.get('how_to_apply_images', [])
    expected_output_images = template.get('expected_output_images', [])
    bypass_llm = template.get('bypass_llm', False)  # Check if this section bypasses LLM
    
    # Substitute all parameters including use_case_description
    params = {
        '{industry_name}': industry_name,
        '{use_case_title}': use_case_title,
        '{use_case_description}': use_case_description,
        '{section_tag}': section_tag,
    }

    # Scoped strictly to the Iterate & Enhance step. Its template is the only one
    # that uses the bare {industry}/{use_case} tokens; gating on section_tag
    # guarantees no other step's substitution behavior changes.
    if section_tag == 'iterate_enhance':
        params['{industry}'] = industry_name
        params['{use_case}'] = use_case_title
    
    # Add workshop parameters to substitution params
    for key, value in workshop_params.items():
        params['{' + key + '}'] = value
    
    # Add previous outputs to params (e.g., {prd_document})
    if previous_outputs:
        for key, value in previous_outputs.items():
            params['{' + key + '}'] = value or f"[No {key} provided - please complete Step 2 first]"
    
    # Set default for {prd_document} if not provided (for UI design steps)
    if '{prd_document}' not in params:
        params['{prd_document}'] = "[PRD not provided - please complete Step 2 (PRD Generation) first to include the PRD in your UI design]"
    
    for key, value in params.items():
        input_text = input_text.replace(key, str(value))
        system_prompt = system_prompt.replace(key, str(value))
        how_to_apply = how_to_apply.replace(key, str(value))
        expected_output = expected_output.replace(key, str(value))
    
    # Conditional branding injection -- only when company_brand_url is specified
    # Session overrides may store empty string for brand URL (e.g. from initial
    # "Get Started" before URL was populated). Fall back to the global workshop
    # parameter when the effective value is empty.
    brand_url = (workshop_params.get('company_brand_url') or '').strip()
    if not brand_url and session_id:
        brand_url = (get_workshop_parameters_sync().get('company_brand_url') or '').strip()
    if brand_url and section_tag in (
        'prd_generation', 'figma_ui_design', 'cursor_copilot_ui_design',
        'activation_app_design', 'activation_build_wire', 'gaccel_dashboard',
    ):
        _company_display = ''
        try:
            from urllib.parse import urlparse
            _parsed = urlparse(brand_url)
            _path = _parsed.path.strip('/')
            if _path:
                _last_seg = _path.split('/')[-1]
                if any(c.isalpha() for c in _last_seg) and len(_last_seg) > 2:
                    _company_display = _last_seg.replace('-', ' ').replace('_', ' ').title()
        except Exception:
            pass

        if section_tag == 'prd_generation':
            if _company_display:
                branding_section = f"""

---

## Company Context and Branding

This application is being built for **{_company_display}**.
- Reference {brand_url} for the company's brand identity, colors, and visual assets
- Contextualize all user personas, workflows, and terminology to align with {_company_display}'s business domain and customer base
- Use {_company_display}-appropriate product naming, voice, and tone throughout the PRD
- User journeys should reflect realistic scenarios within {_company_display}'s industry and operations
- Include brand identity considerations (name, logo, color palette) in any UI-related requirements sections"""
            else:
                branding_section = f"""

---

## Company Context and Branding

This application is being built for the company defined at the following URL.
- Reference {brand_url} for the company's brand identity, colors, and visual assets
- Contextualize all user personas, workflows, and terminology to align with the company's business domain and customer base
- Use company-appropriate product naming, voice, and tone throughout the PRD
- User journeys should reflect realistic scenarios within the company's industry and operations
- Include brand identity considerations (name, logo, color palette) in any UI-related requirements sections"""
        else:
            # Concrete brand assets extracted at install time (may be blank).
            # Fall back to the global workshop parameters when the session copy
            # is empty, mirroring the brand_url resolution above.
            def _brand_param(key: str) -> str:
                val = (workshop_params.get(key) or '').strip()
                if not val and session_id:
                    val = (get_workshop_parameters_sync().get(key) or '').strip()
                return val

            _primary = _brand_param('company_primary_color')
            _secondary = _brand_param('company_secondary_color')
            _accent = _brand_param('company_accent_color')
            _logo = _brand_param('company_logo_url')
            _name = _brand_param('company_name') or _company_display

            _brand_label = f"**{_name}**" if _name else "the brand defined at the following URL"

            # Build the concrete-color palette lines only for colors we actually
            # have. Each carries the oklch triple so the agent can drop it
            # straight into the AppKit scaffold's client/src/index.css variables.
            _palette_lines = []
            for _label, _var, _hex in (
                ("Primary", "--primary", _primary),
                ("Secondary", "--secondary", _secondary),
                ("Accent", "--accent", _accent),
            ):
                if _hex:
                    _oklch = _hex_to_oklch(_hex)
                    _oklch_str = f" -> `oklch({_oklch})`" if _oklch else ""
                    _palette_lines.append(f"- {_label}: `{_hex}`{_oklch_str} (set the `{_var}` CSS variable)")

            if _palette_lines:
                _palette_block = "\n".join(_palette_lines)
                _logo_line = (
                    f"- Logo: place `{_logo}` in the header/navbar and use it as the favicon"
                    if _logo else
                    f"- Logo: use the company logo from {brand_url} in the header/navbar and as the favicon"
                )
                branding_section = f"""

---

## Branding Guidelines

Theme this application for {_brand_label} using the concrete brand assets below (extracted from {brand_url}).

### Brand palette (exact values)
{_palette_block}

Uncomment and set these as the oklch CSS custom properties in the AppKit scaffold's `client/src/index.css` (the scaffold ships them commented out). Every brand color MUST flow through these CSS variables and be referenced via Tailwind classes (e.g. `bg-primary`, `text-primary-foreground`) — never inline hex, which bypasses dark mode.

### Logo
{_logo_line}

### Apply throughout
- Apply the primary and secondary brand colors to the theme, buttons, headers, chart series, and accents
- Ensure text on brand-colored backgrounds meets WCAG AA contrast (4.5:1 normal, 3:1 large)
- Ensure all UI elements, buttons, and accents align with the brand's visual identity"""
            elif _name or _company_display:
                _label = _name or _company_display
                branding_section = f"""

---

## Branding Guidelines

Use **{_label}** as the brand for this application.
- Reference {brand_url} for the official brand color codes and assets
- Apply the company's primary and secondary brand colors throughout the UI as oklch CSS variables in `client/src/index.css` (theme, buttons, headers, accents)
- Use the company's logo where appropriate (e.g., header/navbar, favicon)
- Ensure all UI elements, buttons, and accents align with the brand's visual identity"""
            else:
                branding_section = f"""

---

## Branding Guidelines

Use the brand defined at the following URL for this application.
- Reference {brand_url} for the official brand color codes and assets
- Apply the brand's primary and secondary colors throughout the UI as oklch CSS variables in `client/src/index.css` (theme, buttons, headers, accents)
- Use the brand's logo where appropriate (e.g., header/navbar, favicon)
- Ensure all UI elements, buttons, and accents align with the brand's visual identity"""
        input_text += branding_section
    
    # If no config found, use fallback
    if not input_text:
        input_text = f"""Generate content for {section_tag} in {industry_name} for {use_case_title}.

## Use Case Context
{use_case_description}

Industry: {industry_name}
Use Case: {use_case_title}
Section: {section_tag}

Please provide detailed requirements and specifications for this section."""
        system_prompt = f"""You are an expert Databricks solutions architect.
Generate a detailed, actionable prompt for {section_tag} in a {industry_name} {use_case_title} application."""
    
    return {
        "input": input_text,
        "input_template": input_template_raw,
        "system_prompt": system_prompt,
        "how_to_apply": how_to_apply,
        "expected_output": expected_output,
        "how_to_apply_images": how_to_apply_images,
        "expected_output_images": expected_output_images,
        "bypass_llm": bypass_llm,
        "_brand_url": brand_url,
        "coding_assistant_variant": resolved_variant,
    }
