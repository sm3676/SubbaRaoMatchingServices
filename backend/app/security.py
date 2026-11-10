
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from .config import settings

bearer_scheme = HTTPBearer(auto_error=False)

admin_client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key
)

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
        response = admin_client.auth.get_user(jwt)
        auth_user = response.user

        if not auth_user:
            raise ValueError("No user")

        row = (
            admin_client.table("user_profiles")
            .select("id,full_name,role,active,language")
            .eq("id", auth_user.id)
            .single()
            .execute()
            .data
        )

        if not row or not row.get("active", True):
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
