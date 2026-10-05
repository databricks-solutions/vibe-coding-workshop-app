"""
Databricks Model Serving (FMAPI) seam.

Extracted verbatim from src/backend/api/routes.py (D4 §1.2, decision D-20) so
non-web callers (e.g. mcp_server.py) can call the serving endpoint without
importing the web-API layer. routes.py re-exports every public name here.

This module must not import src.backend.api.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Databricks SDK - handles authentication automatically when running as Databricks App
try:
    from databricks.sdk import WorkspaceClient
    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    WorkspaceClient = None
    logger.warning("Databricks SDK not available - LLM features will use mock responses")

# Default serving endpoint - can be overridden via environment variable
# Common endpoint names in Databricks workspaces:
# - databricks-meta-llama-3-1-70b-instruct (Foundation Model API)
# - databricks-dbrx-instruct (Foundation Model API)
# - databricks-mixtral-8x7b-instruct (Foundation Model API)
# - Custom endpoints deployed in your workspace
# Default endpoint (Claude Sonnet 4.5)
SERVING_ENDPOINT_NAME = os.getenv("DATABRICKS_SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")

# Fallback endpoints to try if the configured/default endpoint is not deployed in
# the current workspace (e.g. Claude is unavailable on Databricks Free Edition).
# Ordered instruct-first (plain string content) then reasoning models.
FALLBACK_ENDPOINTS = [
    "databricks-meta-llama-3-3-70b-instruct",
    "databricks-llama-4-maverick",
    "databricks-gemma-3-12b",
    "databricks-meta-llama-3-1-8b-instruct",
    "databricks-qwen3-next-80b-a3b-instruct",
    "databricks-gpt-oss-120b",
]

# Initialize WorkspaceClient - automatically handles auth when running as Databricks App
# Uses OAuth from environment when deployed, falls back to config file for local dev
_workspace_client = None
_available_endpoints_cache = None

def get_workspace_client() -> Optional['WorkspaceClient']:
    """
    Get or create the Databricks WorkspaceClient.
    When running as a Databricks App, authentication is automatic via OAuth.
    """
    global _workspace_client
    if _workspace_client is None and DATABRICKS_SDK_AVAILABLE:
        try:
            from src.backend.identity import get_tagged_workspace_client, PRODUCT_NAME, PRODUCT_VERSION
            _workspace_client = get_tagged_workspace_client()
            logger.info("Databricks WorkspaceClient initialized (UA: %s/%s)", PRODUCT_NAME, PRODUCT_VERSION)
        except Exception as e:
            logger.warning(f"Could not initialize WorkspaceClient: {e}")
            import traceback
            logger.warning(f"  Traceback: {traceback.format_exc()}")
    return _workspace_client


def get_available_serving_endpoints() -> List[str]:
    """
    Get list of available serving endpoints in the workspace.
    Results are cached to avoid repeated API calls.
    """
    global _available_endpoints_cache
    
    if _available_endpoints_cache is not None:
        return _available_endpoints_cache
    
    client = get_workspace_client()
    if not client:
        logger.warning("Cannot list endpoints - WorkspaceClient not available")
        return []
    
    try:
        logger.info("Fetching available serving endpoints from workspace...")
        endpoints = client.serving_endpoints.list()
        endpoint_names = [ep.name for ep in endpoints if ep.name]
        _available_endpoints_cache = endpoint_names
        logger.info(f"Found {len(endpoint_names)} serving endpoints: {endpoint_names}")
        return endpoint_names
    except Exception as e:
        logger.error(f"Error listing serving endpoints: {e}")
        return []


def get_best_available_endpoint() -> Optional[str]:
    """
    Resolve the serving endpoint to use, with environment-aware fallback.

    The configured/default endpoint (``SERVING_ENDPOINT_NAME``) is the primary.
    When fallback is enabled (default) and the primary is not deployed in this
    workspace - e.g. Claude on Databricks Free Edition - the first available
    endpoint from ``FALLBACK_ENDPOINTS`` is used instead. If endpoints cannot be
    listed, the primary is returned unchanged (identical to prior behavior).

    Set ``DATABRICKS_ENDPOINT_FALLBACK=false`` to disable and always return the
    primary (kill-switch).
    """
    primary = SERVING_ENDPOINT_NAME

    # Kill-switch: preserve prior behavior exactly (return the configured primary).
    if os.getenv("DATABRICKS_ENDPOINT_FALLBACK", "true").strip().lower() == "false":
        return primary

    available = get_available_serving_endpoints()  # cached; [] on any failure

    # If we cannot list endpoints, or the primary is deployed here, use the primary.
    if not available or primary in available:
        return primary

    # Primary not deployed in this workspace: fall back to a known available model.
    for fallback in FALLBACK_ENDPOINTS:
        if fallback in available:
            logger.info(
                f"Primary endpoint '{primary}' not available; using fallback: {fallback}"
            )
            return fallback

    first_available = available[0]
    logger.info(
        f"Primary endpoint '{primary}' not available and no known fallback present; "
        f"using first available endpoint: {first_available}"
    )
    return first_available


def _extract_text(content: Any) -> str:
    """Normalize a serving-endpoint message/delta ``content`` to a plain string.

    Reasoning models (e.g. gpt-oss, qwen35 on Free Edition) return ``content`` as
    a list of parts such as
    ``[{"type": "reasoning", ...}, {"type": "text", "text": "Hi"}]``; only the
    ``text`` parts are user-facing. Plain chat models return a string, which
    passes through unchanged so existing (Claude/Llama/Gemma) behavior is
    identical.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part["text"]
            for part in content
            if isinstance(part, dict)
            and part.get("type") == "text"
            and isinstance(part.get("text"), str)
        )
    return "" if content is None else str(content)


# ============== Databricks Serving Endpoint Functions ==============

async def call_databricks_serving_endpoint(
    prompt: str,
    endpoint_name: str = None,
    max_tokens: int = 4000,  # Full response length
    temperature: float = 0.5,  # Lower temp = faster generation
    system_prompt: str = None
) -> Dict[str, Any]:
    """
    Call a Databricks Model Serving endpoint using the SDK's API client.
    
    When running as a Databricks App, authentication is automatic via OAuth -
    no token needed! The SDK uses the app's service principal credentials.
    
    Args:
        prompt: The user prompt to send to the model
        endpoint_name: Name of the serving endpoint (auto-discovered if not provided)
        max_tokens: Maximum tokens in the response
        temperature: Sampling temperature (0.0-1.0)
        system_prompt: Optional system prompt for the model
    
    Returns:
        Dict containing the response, model info, and usage stats
    """
    # Auto-discover endpoint if not specified
    endpoint = endpoint_name or get_best_available_endpoint()
    
    if not endpoint:
        logger.error("  ❌ No serving endpoint available!")
        logger.error("     Please configure DATABRICKS_SERVING_ENDPOINT or deploy a model serving endpoint")
        available = get_available_serving_endpoints()
        logger.error(f"     Available endpoints in workspace: {available if available else 'None found'}")
        return {
            "response": "[Error] No serving endpoint configured or available. Please set DATABRICKS_SERVING_ENDPOINT environment variable or deploy a model serving endpoint in your Databricks workspace.",
            "model": "none",
            "usage": {}
        }
    
    
    # Get the workspace client (handles auth automatically)
    client = get_workspace_client()
    
    
    if not client or not DATABRICKS_SDK_AVAILABLE:
        logger.warning("  ⚠️ Databricks SDK not available or client not initialized")
        logger.warning("  ⚠️ Returning MOCK response")
        return {
            "response": f"[Mock Response - SDK not available] This is a simulated response for: {prompt[:100]}...",
            "model": endpoint,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }
    
    # Build messages list for SDK query (OpenAI chat format)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    
    # Raw HTTP to the serving endpoint (avoids SDK query() serialization issues)
    
    import time
    start_time = time.time()
    
    try:
        
        # Get the workspace host from the SDK client
        workspace_host = client.config.host.rstrip('/')
        
        # Try OpenAI-compatible format first (most common)
        openai_payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        # Build a combined prompt string for simple input format
        combined_prompt = prompt
        if messages:
            parts = []
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "system":
                    parts.append(f"[System] {content}")
                else:
                    parts.append(content)
            combined_prompt = "\n\n".join(parts)
        
        # Agent format payloads - try multiple variations
        agent_payloads = [
            # Variation 1: Messages as input (like OpenAI but different key)
            {"input": messages, "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 2: Simple string input in array
            {"input": [combined_prompt], "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 3: Just the string input
            {"input": combined_prompt, "max_output_tokens": max_tokens, "temperature": temperature},
            # Variation 4: Minimal with just input
            {"input": combined_prompt},
        ]
        
        import json as json_lib
        
        
        # Use SDK's serving_endpoints.query() directly - it handles auth automatically
        def make_request(payload):
            """Make request using SDK's serving_endpoints API."""
            try:
                # Check if it's OpenAI format (has 'messages')
                if 'messages' in payload:
                    # Use only required parameters to avoid SDK adding extra keys
                    result = client.serving_endpoints.query(
                        name=endpoint,
                        messages=payload.get('messages'),
                        max_tokens=payload.get('max_tokens', max_tokens),
                        temperature=payload.get('temperature', temperature)
                    )
                else:
                    # For Agent/custom format, use inputs with ONLY the input key
                    input_data = payload.get('input', '')
                    
                    # Ensure input is always a list of message dicts for Agent endpoints
                    if isinstance(input_data, str):
                        input_list = [{"role": "user", "content": input_data}]
                    elif isinstance(input_data, list):
                        if all(isinstance(x, dict) for x in input_data):
                            input_list = input_data
                        else:
                            input_list = [{"role": "user", "content": str(input_data)}]
                    else:
                        input_list = [{"role": "user", "content": str(input_data)}]
                    
                    logger.info(f"  Input list length: {len(input_list)}")
                    # Use only inputs parameter - no other parameters
                    result = client.serving_endpoints.query(
                        name=endpoint,
                        input=input_list  # Try 'input' instead of 'inputs'
                    )
                
                logger.info(f"  SDK query returned type: {type(result).__name__}")
                
                # Safely convert result to dict
                if result is None:
                    return {}
                if isinstance(result, dict):
                    return result
                    
                # Try to convert to dict without calling as_dict (which causes the bug)
                result_dict = {}
                for attr in ['choices', 'usage', 'model', 'id', 'object', 'created', 'output', 'predictions']:
                    if hasattr(result, attr):
                        val = getattr(result, attr)
                        if val is not None:
                            # Convert nested objects
                            if isinstance(val, list):
                                result_dict[attr] = []
                                for item in val:
                                    if isinstance(item, dict):
                                        result_dict[attr].append(item)
                                    elif hasattr(item, '__dict__'):
                                        result_dict[attr].append({k: v for k, v in vars(item).items() if not k.startswith('_')})
                                    else:
                                        result_dict[attr].append(item)
                            elif isinstance(val, dict):
                                result_dict[attr] = val
                            elif hasattr(val, '__dict__'):
                                result_dict[attr] = {k: v for k, v in vars(val).items() if not k.startswith('_')}
                            else:
                                result_dict[attr] = val
                
                if result_dict:
                    return result_dict
                    
                # Last resort - try to stringify
                return {"raw": str(result)}
                
            except Exception as e:
                logger.error(f"  SDK query failed: {e}")
                raise
        
        # Bypass SDK's buggy serving_endpoints.query() - use low-level API client instead
        query_response = None
        last_error = None
        
        # Build payload for OpenAI-compatible endpoint.
        # Send the minimal Chat Completions body accepted by every Databricks-served
        # chat model; do NOT send extra_params (strict FM chat schemas reject it).
        openai_request_body: Dict[str, Any] = {
            "messages": messages,
            "max_tokens": max_tokens,
        }
        ep_lower = endpoint.lower()
        if "mini" not in ep_lower:
            openai_request_body["temperature"] = temperature
        
        
        try:
            # Use SDK's api_client.do() which handles auth but doesn't have the as_dict bug.
            # Offloaded to a worker thread: this is a synchronous, blocking SDK HTTP
            # call, and call_databricks_serving_endpoint runs on the shared event loop
            # (web /generate-prompt and the MCP step-prompt path both reach here) — a
            # slow endpoint must not freeze the loop. to_thread copies contextvars, so
            # auth is unchanged; no signature/timeout/retry change.
            raw_result = await asyncio.to_thread(
                lambda: client.api_client.do(
                    method="POST",
                    path=f"/serving-endpoints/{endpoint}/invocations",
                    body=openai_request_body
                )
            )
            
            # The api_client.do() returns a dict directly
            if isinstance(raw_result, dict):
                query_response = raw_result
            else:
                query_response = {"raw": str(raw_result)}
        except Exception as openai_err:
            last_error = openai_err
            error_msg = str(openai_err).lower()
            logger.info(f"  OpenAI format failed: {openai_err}")
            
            # Only try Agent format if it's a schema/format error
            if "schema" in error_msg or "missing inputs" in error_msg or "input" in error_msg:
                for i, agent_payload in enumerate(agent_payloads):
                    try:
                        logger.info(f"  Trying Agent format variation {i+1}...")
                        # make_request wraps the blocking SDK serving_endpoints.query()
                        # fallbacks; offload it off the shared event loop too.
                        query_response = await asyncio.to_thread(make_request, agent_payload)
                        last_error = None
                        break
                    except Exception as agent_err:
                        logger.info(f"  Agent format variation {i+1} failed: {agent_err}")
                        last_error = agent_err
        
        if last_error:
            logger.error(f"  ❌ All formats failed!")
            raise last_error
        
        logger.info(f"  Raw API response type: {type(query_response).__name__}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"  Response received: type={type(query_response).__name__}")
        
        # Convert response to a plain dict - SDK often returns dict already
        response = None
        
        # Case 1: Already a plain dict - use it directly
        if isinstance(query_response, dict):
            response = query_response
            logger.info(f"  Response is already a dict, using directly")
        
        # Case 2: SDK object - try various conversion methods (each wrapped in try/except)
        elif query_response is not None:
            import json
            
            # Try as_dict first
            if response is None:
                try:
                    if hasattr(query_response, 'as_dict'):
                        response = query_response.as_dict()
                        logger.info(f"  Converted using as_dict()")
                except Exception as e:
                    logger.warning(f"  as_dict() failed: {e}")
            
            # Try to_dict
            if response is None:
                try:
                    if hasattr(query_response, 'to_dict'):
                        response = query_response.to_dict()
                        logger.info(f"  Converted using to_dict()")
                except Exception as e:
                    logger.warning(f"  to_dict() failed: {e}")
            
            # Try vars/__dict__
            if response is None:
                try:
                    if hasattr(query_response, '__dict__'):
                        response = dict(vars(query_response))
                        logger.info(f"  Converted using vars()")
                except Exception as e:
                    logger.warning(f"  vars() failed: {e}")
            
            # Try JSON serialization
            if response is None:
                try:
                    response = json.loads(json.dumps(query_response, default=str))
                    logger.info(f"  Converted using JSON serialization")
                except Exception as e:
                    logger.warning(f"  JSON serialization failed: {e}")
            
            # Ultimate fallback - string
            if response is None:
                response = {"raw_response": str(query_response)}
                logger.info(f"  Using string fallback")
        
        if response is None:
            response = {"error": "Empty response from SDK"}
            
        logger.info(f"  Final response type: {type(response).__name__}")
        
        logger.info(f"  Response keys: {list(response.keys()) if isinstance(response, dict) else 'N/A'}")
        
        # Parse the response
        content = None
        usage = {}
        model_used = endpoint
        
        if isinstance(response, dict):
            for key, val in response.items():
                val_type = type(val).__name__
                logger.debug(f"    Key '{key}': type={val_type}, length={len(str(val))}")
            
            # Try OpenAI format (choices)
            if "choices" in response and response["choices"]:
                choice = response["choices"][0]
                logger.info(f"  Choice type: {type(choice).__name__}")
                
                # Handle choice as dict
                if isinstance(choice, dict):
                    message = choice.get("message", {})
                    if isinstance(message, dict):
                        content = _extract_text(message.get("content", ""))
                    elif hasattr(message, 'content'):
                        content = _extract_text(getattr(message, 'content', ''))
                # Handle choice as SDK object
                elif hasattr(choice, 'message'):
                    message = choice.message
                    if isinstance(message, dict):
                        content = _extract_text(message.get("content", ""))
                    elif hasattr(message, 'content'):
                        content = _extract_text(getattr(message, 'content', ''))
                
                if "usage" in response:
                    usage_data = response["usage"]
                    if isinstance(usage_data, dict):
                        usage = {
                            "prompt_tokens": usage_data.get("prompt_tokens", 0),
                            "completion_tokens": usage_data.get("completion_tokens", 0),
                            "total_tokens": usage_data.get("total_tokens", 0)
                        }
                    elif hasattr(usage_data, 'prompt_tokens'):
                        usage = {
                            "prompt_tokens": getattr(usage_data, 'prompt_tokens', 0),
                            "completion_tokens": getattr(usage_data, 'completion_tokens', 0),
                            "total_tokens": getattr(usage_data, 'total_tokens', 0)
                        }
                model_used = response.get("model", endpoint)
            
            # Try output format (agent endpoints)
            elif "output" in response:
                content = response["output"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
                usage = response.get("usage", {})
            
            # Try predictions format
            elif "predictions" in response:
                content = response["predictions"]
                if isinstance(content, list):
                    content = content[0] if content else ""
            
            # Try result format
            elif "result" in response:
                content = response["result"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
            
            # Try response format (nested)
            elif "response" in response:
                content = response["response"]
                if isinstance(content, list):
                    content = content[0] if content else ""
                elif isinstance(content, dict):
                    content = content.get("content") or content.get("text") or str(content)
            
            # Try data format
            elif "data" in response:
                data = response["data"]
                if isinstance(data, list) and data:
                    item = data[0]
                    content = item.get("content") if isinstance(item, dict) else str(item)
                elif isinstance(data, dict):
                    content = data.get("content") or data.get("text") or str(data)
                else:
                    content = str(data)
            
            # Try text format
            elif "text" in response:
                content = response["text"]
            
            # Try content format directly
            elif "content" in response:
                content = response["content"]
            
            # Fallback
            else:
                content = str(response)
        
        # Check for empty content (common with reasoning models that use all tokens for reasoning)
        if content is not None and content != "":
            logger.info(f"     Model: {model_used}")
            logger.info(f"     Response length: {len(str(content))} characters")
            logger.info(f"     Usage: {usage}")
            
            return {
                "response": content,
                "model": model_used,
                "usage": usage,
                "source": "llm_generated"
            }
        else:
            # Check if this is a reasoning model that exhausted tokens
            finish_reason = None
            reasoning_tokens = 0
            if isinstance(response, dict) and "choices" in response and response["choices"]:
                choice = response["choices"][0]
                if isinstance(choice, dict):
                    finish_reason = choice.get("finish_reason")
            if isinstance(response, dict) and "usage" in response:
                usage_details = response["usage"]
                if isinstance(usage_details, dict):
                    reasoning_tokens = usage_details.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
            
            logger.warning(f"  ⚠️ Empty content in response!")
            logger.warning(f"     Finish reason: {finish_reason}")
            logger.warning(f"     Reasoning tokens: {reasoning_tokens}")
            logger.warning(f"     This model may have used all tokens for internal reasoning.")
            
            # Return a more helpful message
            if finish_reason == "length" and reasoning_tokens > 0:
                return {
                    "response": f"[Model used {reasoning_tokens} reasoning tokens but produced no visible output. This is a reasoning model - try increasing max_tokens or using a different model.]",
                    "model": model_used,
                    "usage": usage,
                    "source": "llm_reasoning_exhausted"
                }
            else:
                return {
                    "response": str(response) if response else "[Empty response from LLM]",
                    "model": model_used,
                    "usage": usage,
                    "source": "llm_empty_response"
                }
            
    except Exception as e:
        error_str = str(e)
        logger.error(f"  ❌ SDK query failed!")
        logger.error(f"     Error type: {type(e).__name__}")
        logger.error(f"     Error message: {error_str}")
        import traceback
        logger.error(f"     Traceback:\n{traceback.format_exc()}")
        
        error_msg = error_str.lower()
        if "unauthorized" in error_msg or "403" in error_msg or "401" in error_msg or "permission" in error_msg:
            logger.error("     ❌ AUTHENTICATION ERROR - Check app permissions for serving endpoints")
            logger.error("     Make sure the serving endpoint resource is added in the Databricks App UI!")
            raise HTTPException(
                status_code=403,
                detail=f"Authentication failed. Ensure the app has permission to access the serving endpoint '{endpoint}'. "
                       f"Add the endpoint as a resource in the Databricks App settings. Error: {error_str}"
            )
        elif "not found" in error_msg or "404" in error_msg or "does not exist" in error_msg:
            logger.error(f"     ❌ ENDPOINT NOT FOUND - '{endpoint}' does not exist")
            raise HTTPException(
                status_code=404,
                detail=f"Serving endpoint '{endpoint}' not found. Check the endpoint name and ensure it exists in your workspace."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error calling serving endpoint '{endpoint}': {error_str}"
            )
