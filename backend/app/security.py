
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from .config import settings

bearer_scheme = HTTPBearer(auto_error=False)

# Admin client: database operations only
admin_client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key
)

# Public client: login and other public Supabase operations
public_client = create_client(
    settings.supabase_url,
    settings.supabase_anon_key
)


async def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    if not credentials:
        raise HTTPException(401, "Sign in required")

    jwt = credentials.credentials

    try:
        # Create an isolated client to verify this user's JWT.
        # Do not use the shared admin_client for user authentication.
        auth_client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )

        response = auth_client.auth.get_user(jwt=jwt)
        auth_user = response.user

        if not auth_user:
            raise ValueError("No authenticated user")

        # Use the admin client only for the database lookup.
        result = (
            admin_client.table("user_profiles")
            .select("id,full_name,role,active,language")
            .eq("id", auth_user.id)
            .single()
            .execute()
        )

        row = result.data

        if not row:
            raise HTTPException(403, "User profile not found")

        if not row.get("active", True):
            raise HTTPException(403, "Account is disabled")

        return {
            **row,
            "email": auth_user.email,
            "access_token": jwt
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(401, "Invalid or expired session")


def require_admin(user):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
