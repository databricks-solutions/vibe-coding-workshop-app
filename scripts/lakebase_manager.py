#!/usr/bin/env python3
"""
Lakebase Instance Manager
=========================
Manages Lakebase PostgreSQL instances and permissions for Databricks Apps.

This script automates the setup of Lakebase access for Databricks Apps, including:
  - Checking Lakebase connectivity and status
  - Getting app service principal information
  - Granting Unity Catalog permissions
  - Adding Lakebase database roles (DATABRICKS_SUPERUSER)
  - Listing existing Lakebase roles

DATABRICKS APIS USED:
  - GET   /api/2.0/apps/{app_name}                    → Get app details + service principal
  - PATCH /api/2.0/apps/{app_name}                    → Update app (e.g., add resources)
  - GET   /api/2.0/database/instances/{instance}      → Get Lakebase instance details
  - GET   /api/2.0/database/instances/{instance}/roles → List database roles
  - POST  /api/2.0/database/instances/{instance}/roles → Add database role
  - PATCH /api/2.1/unity-catalog/permissions/catalog/{catalog} → Grant catalog permissions

Usage:
    python scripts/lakebase_manager.py --action check               # Check connectivity
    python scripts/lakebase_manager.py --action app-info            # Get app service principal
    python scripts/lakebase_manager.py --action full-info           # Get full app details
    python scripts/lakebase_manager.py --action status              # Full status check
    python scripts/lakebase_manager.py --action grant-permissions   # Grant catalog permissions
    python scripts/lakebase_manager.py --action add-lakebase-role   # Add database role
    python scripts/lakebase_manager.py --action list-lakebase-roles # List database roles
    python scripts/lakebase_manager.py --action link-app-resource   # Link Lakebase to app (App Resources)
    python scripts/lakebase_manager.py --action instructions        # Print setup instructions

Configuration:
    Set environment variables or use defaults from app.yaml:
    - DATABRICKS_HOST: Workspace URL
    - LAKEBASE_INSTANCE_NAME: Lakebase instance name
    - APP_NAME: Databricks App name
"""

import os
import sys
import json
import argparse
import shutil
import subprocess
import re
from typing import Optional, Dict, Any, Tuple


def _run_cmd(argv, **kwargs):
    """subprocess.run wrapper that resolves argv[0] via shutil.which.

    This is required on Windows for .cmd / .bat shims because CreateProcessW
    only auto-appends .exe (not PATHEXT). Functionally equivalent to
    subprocess.run on POSIX.
    """
    resolved = shutil.which(argv[0]) or argv[0]
    return subprocess.run([resolved, *argv[1:]], **kwargs)


# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Configuration for Lakebase management."""
    
    # Databricks workspace
    DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
    
    # Lakebase instance settings (loaded from app.yaml)
    LAKEBASE_HOST = None
    LAKEBASE_DATABASE = None
    LAKEBASE_SCHEMA = None
    LAKEBASE_PORT = 443
    LAKEBASE_USER = None
    LAKEBASE_INSTANCE_NAME = os.getenv("LAKEBASE_INSTANCE_NAME", "vibe-coding-workshop-lakebase")
    
    # App settings
    APP_NAME = os.getenv("APP_NAME", "vibe-coding-workshop-app")
    
    @classmethod
    def load_from_app_yaml(cls, project_root: str = "."):
        """Load configuration from app.yaml."""
        app_yaml_path = os.path.join(project_root, "app.yaml")
        
        if not os.path.exists(app_yaml_path):
            print(f"⚠️  app.yaml not found at {app_yaml_path}")
            return
        
        with open(app_yaml_path, 'r') as f:
            content = f.read()
        
        def get_yaml_value(key):
            match = re.search(rf'name: {key}.*?value:\s*"([^"]*)"', content, re.DOTALL)
            return match.group(1) if match else None
        
        cls.LAKEBASE_HOST = get_yaml_value('LAKEBASE_HOST')
        cls.LAKEBASE_DATABASE = get_yaml_value('LAKEBASE_DATABASE')
        cls.LAKEBASE_SCHEMA = get_yaml_value('LAKEBASE_SCHEMA')
        cls.LAKEBASE_PORT = int(get_yaml_value('LAKEBASE_PORT') or '443')
        
        # Get current authenticated user from Databricks CLI (not from app.yaml)
        # lakebase_manager.py runs during deployment as the deployer, not as the app
        try:
            result = _run_cmd(
                ['databricks', 'current-user', 'me', '--output', 'json'],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode == 0:
                import json
                user_info = json.loads(result.stdout)
                cls.LAKEBASE_USER = user_info.get('userName', '')
        except Exception:
            pass
        if not cls.LAKEBASE_USER:
            cls.LAKEBASE_USER = os.getenv('LAKEBASE_USER_OVERRIDE', '')
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        return {
            "databricks_host": cls.DATABRICKS_HOST,
            "lakebase_host": cls.LAKEBASE_HOST,
            "lakebase_database": cls.LAKEBASE_DATABASE,
            "lakebase_schema": cls.LAKEBASE_SCHEMA,
            "lakebase_port": cls.LAKEBASE_PORT,
            "lakebase_user": cls.LAKEBASE_USER,
            "lakebase_instance_name": cls.LAKEBASE_INSTANCE_NAME,
            "app_name": cls.APP_NAME,
        }


# =============================================================================
# HELPERS
# =============================================================================

def get_databricks_token(host: str) -> Optional[str]:
    """Get OAuth token from Databricks CLI."""
    try:
        result = _run_cmd(
            ['databricks', 'auth', 'token', '--host', host],
            capture_output=True, text=True, check=True
        )
        token_data = json.loads(result.stdout)
        return token_data.get('access_token')
    except Exception as e:
        print(f"❌ Failed to get auth token: {e}")
        print(f"   Run: databricks auth login --host {host}")
        return None


def get_app_service_principal(host: str, token: str, app_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Get the app's service principal ID and name.
    
    Returns:
        Tuple of (service_principal_id, service_principal_name)
    """
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{host}/api/2.0/apps/{app_name}", headers=headers)
        if response.status_code == 200:
            app_info = response.json()
            return (
                app_info.get('service_principal_client_id'),
                app_info.get('service_principal_name')
            )
        else:
            print(f"⚠️  Could not get app info: {response.status_code}")
            return None, None
    except Exception as e:
        print(f"❌ Error getting app info: {e}")
        return None, None


def get_full_app_info(host: str, token: str, app_name: str) -> Optional[Dict[str, Any]]:
    """
    Get full app information including URL and status.
    
    Returns:
        Dict with app info or None
    """
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{host}/api/2.0/apps/{app_name}", headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️  Could not get app info: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error getting app info: {e}")
        return None


def grant_catalog_permissions(host: str, token: str, catalog_name: str, principal_id: str) -> bool:
    """
    Grant ALL_PRIVILEGES on a catalog to a service principal.
    
    Args:
        host: Databricks workspace URL
        token: OAuth token
        catalog_name: Name of the catalog
        principal_id: Service principal client ID
    
    Returns:
        True if successful, False otherwise
    """
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "changes": [
            {
                "principal": principal_id,
                "add": ["ALL_PRIVILEGES"]
            }
        ]
    }
    
    try:
        response = requests.patch(
            f"{host}/api/2.1/unity-catalog/permissions/catalog/{catalog_name}",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            return True
        else:
            print(f"⚠️  Permission grant returned: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error granting permissions: {e}")
        return False


def deploy_app_source(host: str, token: str, app_name: str, source_path: str) -> bool:
    """
    Deploy source code to a Databricks App.
    
    Args:
        host: Databricks workspace URL
        token: OAuth token
        app_name: Name of the app
        source_path: Workspace path to source code
    
    Returns:
        True if successful, False otherwise
    """
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "source_code_path": source_path
    }
    
    try:
        response = requests.post(
            f"{host}/api/2.0/apps/{app_name}/deployments",
            headers=headers,
            json=payload
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            status = result.get('status', {}).get('state', 'UNKNOWN')
            print(f"   Deployment status: {status}")
            return True
        else:
            print(f"⚠️  Deployment returned: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error deploying app: {e}")
        return False


def _roles_api_path(instance_name: str, mode: str = "provisioned", branch: str = "") -> str:
    """Build the roles REST API path.
    
    For autoscaling, roles live at the branch level:
        /api/2.0/postgres/projects/{pid}/branches/{bid}/roles
    For provisioned, roles live at the instance level:
        /api/2.0/database/instances/{name}/roles
    """
    if mode == "autoscaling":
        if branch:
            return f"/api/2.0/postgres/{branch}/roles"
        return f"/api/2.0/postgres/projects/{instance_name}/branches/production/roles"
    return f"/api/2.0/database/instances/{instance_name}/roles"


def add_lakebase_role(host: str, token: str, instance_name: str, principal_id: str, 
                      identity_type: str = "SERVICE_PRINCIPAL", 
                      membership_role: str = "DATABRICKS_SUPERUSER",
                      mode: str = "provisioned",
                      branch: str = "") -> bool:
    """Add a database role to a Lakebase instance (provisioned) or branch (autoscaling)."""
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    if mode == "autoscaling":
        payload = {
            "spec": {
                "postgres_role": principal_id,
                "identity_type": identity_type,
                "membership_roles": [membership_role]
            }
        }
    else:
        payload = {
            "name": principal_id,
            "identity_type": identity_type,
            "membership_role": membership_role
        }
    
    try:
        response = requests.post(
            f"{host}{_roles_api_path(instance_name, mode, branch)}",
            headers=headers,
            json=payload
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            if mode == "autoscaling":
                status = result.get('status', {})
                print(f"   Role: {status.get('membership_roles', [])}")
                print(f"   Identity Type: {status.get('identity_type')}")
            else:
                print(f"   Role: {result.get('membership_role')}")
                print(f"   Identity Type: {result.get('identity_type')}")
            return True
        elif response.status_code == 409:
            print(f"⚠️  Role already exists")
            return True
        else:
            print(f"⚠️  Add role returned: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error adding role: {e}")
        return False


def get_lakebase_roles(host: str, token: str, instance_name: str,
                       mode: str = "provisioned", branch: str = "") -> list:
    """Get all database roles for a Lakebase instance (provisioned) or branch (autoscaling)."""
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{host}{_roles_api_path(instance_name, mode, branch)}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('database_instance_roles', data.get('roles', []))
        else:
            print(f"⚠️  Get roles returned: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error getting roles: {e}")
        return []


def get_app_resources(host: str, token: str, app_name: str) -> list:
    """
    Get existing app resources for a Databricks App.
    
    Args:
        host: Databricks workspace URL
        token: OAuth token
        app_name: Name of the app
    
    Returns:
        List of resource dictionaries
    """
    app_info = get_full_app_info(host, token, app_name)
    if app_info:
        return app_info.get('resources', [])
    return []


def link_app_resource(host: str, token: str, app_name: str, instance_name: str,
                      database_name: str = "databricks_postgres",
                      permission: str = "CAN_CONNECT_AND_CREATE",
                      mode: str = "provisioned") -> bool:
    """
    Link a Lakebase instance/project to a Databricks App as an App Resource.

    For Provisioned: links the database instance directly.
    For Autoscaling: links the postgres project.
    Both enable automatic PGHOST/PGUSER injection at runtime.
    """
    import requests
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    resource_entry = {
        "name": "database",
        "database": {
            "instance_name": instance_name,
            "database_name": database_name,
            "permission": permission
        }
    }
    
    payload = {"resources": [resource_entry]}
    
    try:
        response = requests.patch(
            f"{host}/api/2.0/apps/{app_name}",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            result = response.json()
            resources = result.get('resources', [])
            for r in resources:
                db = r.get('database', {})
                if db.get('instance_name') == instance_name:
                    print(f"   Instance/Project: {db.get('instance_name')}")
                    print(f"   Database: {db.get('database_name')}")
                    print(f"   Permission: {db.get('permission')}")
                    return True
            return True
        else:
            print(f"⚠️  Link app resource returned: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error linking app resource: {e}")
        return False


def check_lakebase_connection(config: Config, token: str) -> Tuple[bool, Dict[str, int]]:
    """Check Lakebase connectivity and return table counts."""
    if not config.LAKEBASE_HOST:
        return False, {"error": "LAKEBASE_HOST not configured"}
    
    try:
        try:
            import psycopg
            conn = psycopg.connect(
                host=config.LAKEBASE_HOST,
                port=config.LAKEBASE_PORT,
                dbname=config.LAKEBASE_DATABASE,
                user=config.LAKEBASE_USER,
                password=token,
                sslmode='require'
            )
        except ImportError:
            import psycopg2
            conn = psycopg2.connect(
                host=config.LAKEBASE_HOST,
                port=config.LAKEBASE_PORT,
                database=config.LAKEBASE_DATABASE,
                user=config.LAKEBASE_USER,
                password=token,
                sslmode='require'
            )
        cursor = conn.cursor()
        
        tables = ['usecase_descriptions', 'section_input_prompts', 'sessions']
        counts = {}
        
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {config.LAKEBASE_SCHEMA}.{table}")
                counts[table] = cursor.fetchone()[0]
            except Exception as e:
                counts[table] = f"ERROR: {e}"
        
        cursor.close()
        conn.close()
        return True, counts
    except Exception as e:
        return False, {"error": str(e)}


# =============================================================================
# ACTIONS
# =============================================================================

def action_check(config: Config) -> int:
    """Check Lakebase connectivity."""
    print("🔍 Checking Lakebase Connection\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    print(f"Configuration:")
    print(f"  Host:     {(config.LAKEBASE_HOST or 'NOT SET')[:50]}...")
    print(f"  Database: {config.LAKEBASE_DATABASE or 'NOT SET'}")
    print(f"  Schema:   {config.LAKEBASE_SCHEMA or 'NOT SET'}")
    print(f"  Port:     {config.LAKEBASE_PORT}")
    print(f"  User:     {config.LAKEBASE_USER or 'NOT SET'}")
    print()
    
    success, counts = check_lakebase_connection(config, token)
    
    if success:
        print("✓ Connection successful!\n")
        print("Table counts:")
        for table, count in counts.items():
            print(f"  {table}: {count} rows")
        return 0
    else:
        print(f"❌ Connection failed: {counts.get('error', 'Unknown error')}")
        return 1


def action_app_info(config: Config) -> int:
    """Get app service principal information."""
    print("🔍 Getting App Service Principal Info\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    sp_id, sp_name = get_app_service_principal(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    if sp_id:
        print(f"✓ App Name: {config.APP_NAME}")
        print(f"✓ Service Principal ID: {sp_id}")
        print(f"✓ Service Principal Name: {sp_name}")
        return 0
    else:
        print(f"❌ Could not get service principal for app: {config.APP_NAME}")
        print("   Is the app deployed?")
        return 1


def action_status(config: Config) -> int:
    """Full status check."""
    print("=" * 60)
    print("LAKEBASE STATUS CHECK")
    print("=" * 60)
    print()
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    # 1. App Info
    print("1. App Information:")
    sp_id, sp_name = get_app_service_principal(config.DATABRICKS_HOST, token, config.APP_NAME)
    if sp_id:
        print(f"   ✓ App Name: {config.APP_NAME}")
        print(f"   ✓ Service Principal ID: {sp_id}")
        print(f"   ✓ Service Principal Name: {sp_name}")
    else:
        print(f"   ❌ Could not get app info")
        sp_id = "UNKNOWN"
    
    # 2. Lakebase Connection
    print("\n2. Lakebase Connection:")
    print(f"   Instance: {config.LAKEBASE_INSTANCE_NAME}")
    print(f"   Host: {(config.LAKEBASE_HOST or 'NOT SET')[:50]}...")
    
    success, counts = check_lakebase_connection(config, token)
    if success:
        print("   ✓ Connection successful!")
        for table, count in counts.items():
            print(f"   ✓ {table}: {count} rows")
    else:
        print(f"   ❌ Connection failed: {counts.get('error', 'Unknown')}")
    
    # 3. Instructions
    print("\n" + "=" * 60)
    print("PERMISSION SETUP (if needed)")
    print("=" * 60)
    print(f"""
To grant the app access to Lakebase as superuser:

1. Go to: {config.DATABRICKS_HOST.replace('https://', '')}
2. Navigate to: Compute > Lakebase Postgres > {config.LAKEBASE_INSTANCE_NAME}
3. Click: Permissions tab
4. Click: Add role
5. Enter Service Principal ID: {sp_id}
6. Set Role membership: databricks_superuser
7. Click: Confirm

NOTE: Lakebase management APIs are not yet public.
      Permission setup must be done via UI.
""")
    
    return 0 if success else 1


def action_grant_permissions(config: Config, catalog_name: str) -> int:
    """Grant catalog permissions to app service principal."""
    print("🔐 Granting Catalog Permissions\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    # Get app service principal
    sp_id, sp_name = get_app_service_principal(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    if not sp_id:
        print(f"❌ Could not get service principal for app: {config.APP_NAME}")
        return 1
    
    print(f"App: {config.APP_NAME}")
    print(f"Service Principal: {sp_id}")
    print(f"Catalog: {catalog_name}")
    print()
    
    # Grant permissions
    print(f"Granting ALL_PRIVILEGES on catalog '{catalog_name}'...")
    if grant_catalog_permissions(config.DATABRICKS_HOST, token, catalog_name, sp_id):
        print(f"\n✓ Successfully granted ALL_PRIVILEGES to {sp_id}")
        return 0
    else:
        print(f"\n❌ Failed to grant permissions")
        return 1


def action_deploy(config: Config, source_path: str) -> int:
    """Deploy app source code."""
    print("🚀 Deploying App Source Code\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    print(f"App: {config.APP_NAME}")
    print(f"Source Path: {source_path}")
    print()
    
    if deploy_app_source(config.DATABRICKS_HOST, token, config.APP_NAME, source_path):
        print(f"\n✓ App deployment initiated")
        return 0
    else:
        print(f"\n❌ App deployment failed")
        return 1


def action_full_info(config: Config) -> int:
    """Get full app information."""
    print("📱 Full App Information\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    app_info = get_full_app_info(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    if app_info:
        print(f"App Name:               {app_info.get('name')}")
        print(f"App ID:                 {app_info.get('id')}")
        print(f"App URL:                {app_info.get('url')}")
        print(f"Service Principal ID:   {app_info.get('service_principal_client_id')}")
        print(f"Service Principal Name: {app_info.get('service_principal_name')}")
        print(f"App Status:             {app_info.get('app_status', {}).get('state')}")
        print(f"Compute Status:         {app_info.get('compute_status', {}).get('state')}")
        print(f"Creator:                {app_info.get('creator')}")
        print(f"Created:                {app_info.get('create_time')}")
        
        active_deployment = app_info.get('active_deployment', {})
        if active_deployment:
            print(f"\nActive Deployment:")
            print(f"  Deployment ID:        {active_deployment.get('deployment_id')}")
            print(f"  Status:               {active_deployment.get('status', {}).get('state')}")
            print(f"  Source Path:          {active_deployment.get('source_code_path')}")
        return 0
    else:
        print(f"❌ Could not get app info for: {config.APP_NAME}")
        return 1


def action_add_lakebase_role(config: Config, mode: str = "provisioned", branch: str = "") -> int:
    """Add app service principal as Lakebase database role."""
    print("🔐 Adding Lakebase Database Role\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    # Get app service principal
    sp_id, sp_name = get_app_service_principal(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    if not sp_id:
        print(f"❌ Could not get service principal for app: {config.APP_NAME}")
        return 1
    
    print(f"App: {config.APP_NAME}")
    print(f"Service Principal: {sp_id}")
    print(f"Lakebase Instance: {config.LAKEBASE_INSTANCE_NAME} ({mode})")
    print()
    
    # Check if role already exists
    existing_roles = get_lakebase_roles(config.DATABRICKS_HOST, token, config.LAKEBASE_INSTANCE_NAME, mode=mode)
    for role in existing_roles:
        if role.get('name') == sp_id:
            print(f"⚠️  Role already exists: {role.get('membership_role')}")
            return 0
    
    # Add the role
    print(f"Adding DATABRICKS_SUPERUSER role...")
    if add_lakebase_role(config.DATABRICKS_HOST, token, config.LAKEBASE_INSTANCE_NAME, sp_id, mode=mode, branch=branch):
        print(f"\n✓ Successfully added Lakebase role for {sp_id}")
        return 0
    else:
        print(f"\n❌ Failed to add Lakebase role")
        return 1


def action_list_lakebase_roles(config: Config, mode: str = "provisioned", branch: str = "") -> int:
    """List all Lakebase database roles."""
    print("📋 Lakebase Database Roles\n")
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    print(f"Instance: {config.LAKEBASE_INSTANCE_NAME} ({mode})\n")
    
    roles = get_lakebase_roles(config.DATABRICKS_HOST, token, config.LAKEBASE_INSTANCE_NAME, mode=mode, branch=branch)
    
    if not roles:
        print("No roles found")
        return 0
    
    for role in roles:
        print(f"  {role.get('identity_type')}: {role.get('name')}")
        print(f"    Role: {role.get('membership_role')}")
        print()
    
    return 0


def action_link_app_resource(config: Config, mode: str = "provisioned") -> int:
    """Link Lakebase instance/project to app as an App Resource."""
    print("🔗 Linking Lakebase to App Resource\n")
    
    if mode == "autoscaling":
        print("ℹ️  Autoscaling mode: App Resource linking is not supported.")
        print("   The app authenticates via WorkspaceClient().postgres.generate_database_credential()")
        print("   using SQL-level role grants. No resource link needed.")
        return 0
    
    token = get_databricks_token(config.DATABRICKS_HOST)
    if not token:
        return 1
    
    print(f"App: {config.APP_NAME}")
    print(f"Lakebase: {config.LAKEBASE_INSTANCE_NAME} ({mode})")
    print()
    
    existing_resources = get_app_resources(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    for resource in existing_resources:
        db = resource.get('database', {})
        if db.get('instance_name') == config.LAKEBASE_INSTANCE_NAME:
            print(f"⚠️  Lakebase already linked to app")
            print(f"   Instance/Project: {db.get('instance_name')}")
            print(f"   Permission: {db.get('permission')}")
            return 0
    
    print(f"Linking with CAN_CONNECT_AND_CREATE permission...")
    if link_app_resource(
        config.DATABRICKS_HOST, 
        token, 
        config.APP_NAME, 
        config.LAKEBASE_INSTANCE_NAME,
        mode=mode
    ):
        print(f"\n✓ Successfully linked Lakebase to app")
        print(f"   Visible in: Databricks UI > Apps > {config.APP_NAME} > Settings > App Resources")
        return 0
    else:
        print(f"\n❌ Failed to link Lakebase to app")
        return 1


def action_instructions(config: Config) -> int:
    """Print setup instructions."""
    token = get_databricks_token(config.DATABRICKS_HOST)
    sp_id, sp_name = None, None
    
    if token:
        sp_id, sp_name = get_app_service_principal(config.DATABRICKS_HOST, token, config.APP_NAME)
    
    print("=" * 60)
    print("LAKEBASE SETUP INSTRUCTIONS")
    print("=" * 60)
    print(f"""
OPTION A: Using Databricks Asset Bundles (Recommended)
======================================================
Lakebase infrastructure can be managed via databricks.yml.
Reference: https://github.com/databricks/bundle-examples/tree/main/knowledge_base/database_with_catalog

STEP 1: Deploy Infrastructure with DAB
--------------------------------------
   # Validate the bundle configuration
   databricks bundle validate
   
   # Deploy Lakebase instance + app
   databricks bundle deploy -t development

This creates:
   - Lakebase PostgreSQL instance
   - Catalog and database
   - Databricks App

STEP 2: Get App Service Principal
---------------------------------
After deployment, get the service principal:
   python scripts/lakebase_manager.py --action app-info

STEP 3: Add App Permission to Lakebase (Manual Step)
----------------------------------------------------
1. Navigate to: Compute > Lakebase Postgres > {config.LAKEBASE_INSTANCE_NAME}
2. Click: Permissions tab
3. Click: Add role
4. Enter Service Principal ID: {sp_id or '<from Step 2>'}
5. Set Role membership: databricks_superuser
6. Click: Confirm

STEP 4: Update app.yaml with Connection Details
-----------------------------------------------
Get connection details from:
   Compute > Lakebase Postgres > {config.LAKEBASE_INSTANCE_NAME} > Connection details

Update app.yaml env vars:
   LAKEBASE_HOST: <endpoint from connection details>
   LAKEBASE_DATABASE: databricks_postgres

STEP 5: Create Tables and Seed Data
-----------------------------------
   ./scripts/setup-lakebase.sh --recreate

STEP 6: Redeploy App
--------------------
   databricks bundle deploy -t development


OPTION B: Manual Setup (Alternative)
====================================

STEP 1: Create Lakebase Instance via UI
---------------------------------------
1. Go to: {config.DATABRICKS_HOST}
2. Navigate to: Compute > Lakebase Postgres
3. Click: Create
4. Enter name: {config.LAKEBASE_INSTANCE_NAME}
5. Click: Create

STEP 2: Deploy App
------------------
   databricks apps deploy {config.APP_NAME} --source-code-path /Workspace/...

STEP 3: Add Permission (same as Option A Step 3)

STEP 4: Update app.yaml (same as Option A Step 4)

STEP 5: Create Tables
---------------------
   ./scripts/setup-lakebase.sh --recreate

Your app should now have full access to Lakebase!
""")
    
    return 0


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Lakebase Instance Manager for Databricks Apps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check Lakebase connectivity
  python lakebase_manager.py --action check

  # Get app service principal info
  python lakebase_manager.py --action app-info

  # Get full app information
  python lakebase_manager.py --action full-info

  # Full status check
  python lakebase_manager.py --action status

  # Grant catalog permissions to app
  python lakebase_manager.py --action grant-permissions --catalog my_catalog

  # Add Lakebase role for app service principal
  python lakebase_manager.py --action add-lakebase-role

  # List all Lakebase roles
  python lakebase_manager.py --action list-lakebase-roles

  # Link Lakebase instance as App Resource (enables automatic PGPASSWORD injection)
  python lakebase_manager.py --action link-app-resource

  # Deploy app source code
  python lakebase_manager.py --action deploy --source-path /Workspace/...

  # Print setup instructions
  python lakebase_manager.py --action instructions

NOTE: Lakebase management APIs are not yet publicly available.
      Instance creation and permission setup must be done via UI.
        """
    )
    
    parser.add_argument(
        "--action",
        choices=["check", "app-info", "full-info", "status", "instructions", 
                 "grant-permissions", "deploy", "add-lakebase-role", "list-lakebase-roles",
                 "link-app-resource"],
        required=True,
        help="Action to perform"
    )
    
    parser.add_argument(
        "--app-name",
        default=Config.APP_NAME,
        help=f"Databricks App name (default: {Config.APP_NAME})"
    )
    
    parser.add_argument(
        "--instance-name",
        default=Config.LAKEBASE_INSTANCE_NAME,
        help=f"Lakebase instance name (default: {Config.LAKEBASE_INSTANCE_NAME})"
    )
    
    parser.add_argument(
        "--host",
        default=Config.DATABRICKS_HOST,
        help=f"Databricks host (default: {Config.DATABRICKS_HOST})"
    )
    
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root directory (default: current directory)"
    )
    
    parser.add_argument(
        "--catalog",
        default=None,
        help="Catalog name (for grant-permissions action)"
    )
    
    parser.add_argument(
        "--source-path",
        default=None,
        help="Source code path (for deploy action)"
    )
    
    parser.add_argument(
        "--mode",
        choices=["autoscaling", "provisioned"],
        default=os.getenv("LAKEBASE_MODE", "autoscaling"),
        help="Lakebase mode: autoscaling or provisioned (default from LAKEBASE_MODE env)"
    )
    parser.add_argument(
        "--branch",
        default=os.getenv("AUTOSCALING_BRANCH", ""),
        help="Branch resource path for autoscaling roles (e.g. projects/{id}/branches/{id})"
    )
    
    args = parser.parse_args()
    
    # Update config from args
    Config.DATABRICKS_HOST = args.host
    Config.LAKEBASE_INSTANCE_NAME = args.instance_name
    Config.APP_NAME = args.app_name
    
    # Load from app.yaml
    Config.load_from_app_yaml(args.project_root)
    
    # Check for required packages
    try:
        import requests
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("   Install with: pip install requests")
        return 1
    
    # Execute action
    if args.action == "check":
        return action_check(Config)
    elif args.action == "app-info":
        return action_app_info(Config)
    elif args.action == "full-info":
        return action_full_info(Config)
    elif args.action == "status":
        return action_status(Config)
    elif args.action == "instructions":
        return action_instructions(Config)
    elif args.action == "grant-permissions":
        if not args.catalog:
            print("❌ --catalog is required for grant-permissions action")
            return 1
        return action_grant_permissions(Config, args.catalog)
    elif args.action == "deploy":
        if not args.source_path:
            print("❌ --source-path is required for deploy action")
            return 1
        return action_deploy(Config, args.source_path)
    elif args.action == "add-lakebase-role":
        return action_add_lakebase_role(Config, mode=args.mode, branch=args.branch)
    elif args.action == "list-lakebase-roles":
        return action_list_lakebase_roles(Config, mode=args.mode, branch=args.branch)
    elif args.action == "link-app-resource":
        return action_link_app_resource(Config, mode=args.mode)
    
    return 1


if __name__ == "__main__":
    sys.exit(main())
