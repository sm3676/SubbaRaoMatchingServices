
import io
import json
import hmac
import hashlib
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageOps
import pytesseract

from .config import settings
from .security import (
    admin_client, public_client, current_user, require_admin
)

if settings.tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

app = FastAPI(title="Father's Matchmaking API", version="2.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# --------------------------------------------------
# AUDIT LOG
# --------------------------------------------------

def audit(user_id, action, details=None):
    admin_client.table("audit_logs").insert({
        "user_id": user_id,
        "action": action,
        "details": details or {},
    }).execute()


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ProfileIn(BaseModel):
    gender: str
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=18, le=100)
    height: Optional[str] = None
    location: Optional[str] = None
    gothram: Optional[str] = None
    star: Optional[str] = None
    education: Optional[str] = None
    job: Optional[str] = None
    salary_lpa: Optional[float] = Field(default=None, ge=0)
    phone: Optional[str] = None
    source_group: Optional[str] = None
    source_sender: Optional[str] = None
    source_date: Optional[str] = None
    notes: Optional[str] = None


class MatchIn(BaseModel):
    profile_id: str
    criteria: list[str]


class CommissionIn(BaseModel):
    profile_id: str
    owner_id: str
    amount: float = Field(ge=0)
    status: str = "pending"
    notes: str = ""


# --------------------------------------------------
# NAKSHATRA DATA
# --------------------------------------------------

NAKSHATRA_DATA = {
    "ashwini": ("Deva", "Adi", "Horse", "Pada"),
    "bharani": ("Manushya", "Madhya", "Elephant", "Kati"),
    "krittika": ("Rakshasa", "Antya", "Sheep", "Nabhi"),
    "rohini": ("Manushya", "Antya", "Serpent", "Kantha"),
    "mrigashira": ("Deva", "Madhya", "Serpent", "Siro"),
    "ardra": ("Manushya", "Adi", "Dog", "Kantha"),
    "punarvasu": ("Deva", "Adi", "Cat", "Nabhi"),
    "pushya": ("Deva", "Madhya", "Sheep", "Kati"),
    "ashlesha": ("Rakshasa", "Antya", "Cat", "Pada"),
    "magha": ("Rakshasa", "Antya", "Rat", "Pada"),
    "purva phalguni": ("Manushya", "Madhya", "Rat", "Kati"),
    "uttara phalguni": ("Manushya", "Adi", "Cow", "Nabhi"),
    "hasta": ("Deva", "Adi", "Buffalo", "Kantha"),
    "chitra": ("Rakshasa", "Madhya", "Tiger", "Siro"),
    "swati": ("Deva", "Antya", "Buffalo", "Kantha"),
    "vishakha": ("Rakshasa", "Antya", "Tiger", "Nabhi"),
    "anuradha": ("Deva", "Madhya", "Deer", "Kati"),
    "jyeshtha": ("Rakshasa", "Adi", "Deer", "Pada"),
    "mula": ("Rakshasa", "Adi", "Dog", "Pada"),
    "purva ashadha": ("Manushya", "Madhya", "Monkey", "Kati"),
    "uttara ashadha": ("Manushya", "Antya", "Mongoose", "Nabhi"),
    "shravana": ("Deva", "Antya", "Monkey", "Kantha"),
    "dhanishta": ("Rakshasa", "Madhya", "Lion", "Siro"),
    "shatabhisha": ("Rakshasa", "Adi", "Horse", "Kantha"),
    "purva bhadrapada": ("Manushya", "Adi", "Lion", "Nabhi"),
    "uttara bhadrapada": ("Manushya", "Madhya", "Cow", "Kati"),
    "revati": ("Deva", "Antya", "Elephant", "Pada"),
}

NAKSHATRA_ALIASES = {
    "aswini": "ashwini",
    "aashlesha": "ashlesha",
    "aashlesa": "ashlesha",
    "asvini": "ashwini",
    "purvashada": "purva ashadha",
    "krithika": "krittika",
    "mrigasira": "mrigashira",
    "thiruvathira": "ardra",
    "arudra": "ardra",
    "punarpoosam": "punarvasu",
    "poosam": "pushya",
    "ayilyam": "ashlesha",
    "poorva phalguni": "purva phalguni",
    "purva phalguni": "purva phalguni",
    "uthiram": "uttara phalguni",
    "chithirai": "chitra",
    "chothi": "swati",
    "visakha": "vishakha",
    "anusham": "anuradha",
    "kettai": "jyeshtha",
    "moolam": "mula",
    "pooradam": "purva ashadha",
    "uthradam": "uttara ashadha",
    "thiruvonam": "shravana",
    "avittam": "dhanishta",
    "sadayam": "shatabhisha",
    "poorattathi": "purva bhadrapada",
    "uthirattathi": "uttara bhadrapada",
    "revathi": "revati",
}

VEDHA_PAIRS = {
    frozenset(("ashwini", "jyeshtha")),
    frozenset(("bharani", "anuradha")),
    frozenset(("krittika", "vishakha")),
    frozenset(("rohini", "swati")),
    frozenset(("ardra", "shravana")),
    frozenset(("punarvasu", "uttara ashadha")),
    frozenset(("pushya", "purva ashadha")),
    frozenset(("ashlesha", "mula")),
    frozenset(("magha", "revati")),
    frozenset(("purva phalguni", "uttara bhadrapada")),
    frozenset(("uttara phalguni", "purva bhadrapada")),
    frozenset(("hasta", "shatabhisha")),
}


def normalize_star(value):
    if not value:
        return None

    name = re.sub(
        r"\s+", " ", str(value).strip().lower().replace("-", " ")
    )
    name = re.sub(
        r"\s+[1-4]\s*(?:pada|paada|paadam|padam|paadham)$",
        "", name
    )
    name = re.sub(
        r"\s+(?:pada|paada|paadam|padam|paadham)\s*[1-4]?$",
        "", name
    )
    name = re.sub(r"\s+[1-4]$", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return NAKSHATRA_ALIASES.get(name, name)


def nakshatra_compatibility(boy_star, girl_star):
    boy = normalize_star(boy_star)
    girl = normalize_star(girl_star)

    if boy not in NAKSHATRA_DATA:
        return {
            "available": False,
            "message": "Boy's Nakshatra is missing or not recognized",
        }

    if girl not in NAKSHATRA_DATA:
        return {
            "available": False,
            "message": "Girl's Nakshatra is missing or not recognized",
        }

    boy_gana, boy_nadi, boy_yoni, boy_rajju = NAKSHATRA_DATA[boy]
    girl_gana, girl_nadi, girl_yoni, girl_rajju = NAKSHATRA_DATA[girl]

    stars = list(NAKSHATRA_DATA.keys())
    boy_index = stars.index(boy)
    girl_index = stars.index(girl)

    count = (boy_index - girl_index) % 27 + 1
    tara_number = count % 9 or 9

    tara_names = {
        1: "Janma", 2: "Sampat", 3: "Vipat",
        4: "Kshema", 5: "Pratyari", 6: "Sadhaka",
        7: "Naidhana", 8: "Mitra", 9: "Parama Mitra",
    }

    tara_good = tara_number in (2, 4, 6, 8, 9)

    if boy_gana == girl_gana:
        gana_status = "Compatible"
    elif {boy_gana, girl_gana} == {"Deva", "Manushya"}:
        gana_status = "Moderate"
    else:
        gana_status = "Needs review"

    mahendra_good = count in (4, 7, 10, 13, 16, 19, 22, 25)
    stree_deergha_good = count >= 13
    rajju_good = boy_rajju != girl_rajju
    vedha_good = frozenset((boy, girl)) not in VEDHA_PAIRS
    nadi_good = boy_nadi != girl_nadi

    rules = {
        "tara": {
            "result": tara_names[tara_number],
            "status": "Pass" if tara_good else "Review",
            "count": count,
        },
        "gana": {
            "boy": boy_gana,
            "girl": girl_gana,
            "status": gana_status,
        },
        "mahendra": {
            "status": "Pass" if mahendra_good else "Review",
        },
        "stree_deergha": {
            "count": count,
            "status": "Pass" if stree_deergha_good else "Review",
        },
        "yoni": {
            "boy": boy_yoni,
            "girl": girl_yoni,
            "status": (
                "Same animal category"
                if boy_yoni == girl_yoni
                else "Different animal categories - review"
            ),
            "note": "Enemy-pair Yoni scoring is not applied in this version.",
        },
        "rajju": {
            "boy": boy_rajju,
            "girl": girl_rajju,
            "status": "Pass" if rajju_good else "FLAG",
        },
        "vedha": {
            "status": "Pass" if vedha_good else "FLAG",
        },
        "nadi": {
            "boy": boy_nadi,
            "girl": girl_nadi,
            "status": "Pass" if nadi_good else "Same Nadi - review",
        },
    }

    passed = sum((
        tara_good,
        mahendra_good,
        stree_deergha_good,
        rajju_good,
        vedha_good,
        nadi_good,
        gana_status == "Compatible",
    ))

    flags = []
    if not rajju_good:
        flags.append("Same Rajju group - verify with astrologer")
    if not vedha_good:
        flags.append("Vedha pair - verify with astrologer")
    if not nadi_good:
        flags.append("Same Nadi - verify with astrologer")

    return {
        "available": True,
        "boy_star": boy,
        "girl_star": girl,
        "rules": rules,
        "passed_checks": passed,
        "total_checks": 7,
        "major_flags": flags,
        "status": "Preliminary screening - astrologer verification required",
        "note": (
            "This is not a complete Telugu Jathakam match. "
            "Pada, Rasi, Rasi lord and family-specific rules are not evaluated."
        ),
    }


# --------------------------------------------------
# PRIVATE PROFILE IMAGE HELPERS
# --------------------------------------------------

def get_profile_images(profile_id):
    rows = (
        admin_client.table("profile_images")
        .select("id,profile_id,storage_path,original_filename,created_at")
        .eq("profile_id", profile_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    images = []

    for row in rows:
        signed_url = None

        try:
            signed = admin_client.storage.from_("profile-images").create_signed_url(
                row["storage_path"],
                3600,
            )

            signed_url = (
                signed.get("signedURL")
                or signed.get("signedUrl")
                or signed.get("signed_url")
            )

            if signed_url and signed_url.startswith("/"):
                signed_url = settings.supabase_url.rstrip("/") + signed_url

        except Exception:
            signed_url = None

        images.append({
            "id": row["id"],
            "original_filename": row.get("original_filename"),
            "created_at": row.get("created_at"),
            "url": signed_url,
        })

    return images


def verify_profile_image(raw):
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
        image = Image.open(io.BytesIO(raw))

        if image.format not in ("JPEG", "PNG", "WEBP", "GIF"):
            raise ValueError("Unsupported image format")

    except Exception:
        raise HTTPException(
            400,
            "Invalid image. Please upload a JPEG, PNG, WEBP or GIF file.",
        )


# --------------------------------------------------
# HEALTH
# --------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "service": "matchmaking-api"}


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/api/auth/login")
def login(payload: dict):
    try:
        result = public_client.auth.sign_in_with_password({
            "email": payload.get("email"),
            "password": payload.get("password"),
        })

        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "user": {
                "id": result.user.id,
                "email": result.user.email,
            },
        }

    except Exception:
        raise HTTPException(401, "Invalid email or password")


@app.post("/api/auth/logout")
def logout(user=Depends(current_user)):
    try:
        admin_client.auth.admin.sign_out(user["access_token"])
    except Exception:
        pass

    return {"ok": True}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return {k: v for k, v in user.items() if k != "access_token"}


# --------------------------------------------------
# DASHBOARD
# --------------------------------------------------

@app.get("/api/dashboard")
def dashboard(user=Depends(current_user)):
    result = (
        admin_client.table("profiles")
        .select("id,gender,verification_status", count="exact")
        .execute()
    )

    rows = result.data or []

    return {
        "total": len(rows),
        "male": sum(x.get("gender") == "Male" for x in rows),
        "female": sum(x.get("gender") == "Female" for x in rows),
        "pending": sum(
            x.get("verification_status") == "pending" for x in rows
        ),
    }


# --------------------------------------------------
# PROFILE LIST
# --------------------------------------------------

@app.get("/api/profiles")
def profiles(q: str = "", user=Depends(current_user)):
    query = (
        admin_client.table("profiles")
        .select(
            "*,first_member:user_profiles!profiles_first_submitted_by_fkey(full_name)"
        )
        .order("created_at", desc=True)
        .limit(500)
    )

    if q:
        query = query.or_(
            f"profile_code.ilike.%{q}%,"
            f"full_name.ilike.%{q}%,"
            f"location.ilike.%{q}%,"
            f"job.ilike.%{q}%"
        )

    return query.execute().data or []


# --------------------------------------------------
# PROFILE DETAILS + SUBMISSION HISTORY + PHOTOS
# --------------------------------------------------

@app.get("/api/profiles/{profile_id}")
def profile_detail(profile_id: str, user=Depends(current_user)):
    p = (
        admin_client.table("profiles")
        .select("*")
        .eq("id", profile_id)
        .single()
        .execute()
        .data
    )

    submissions = (
        admin_client.table("profile_submissions")
        .select("*,user_profiles(full_name)")
        .eq("profile_id", profile_id)
        .order("submitted_at")
        .execute()
        .data
        or []
    )

    return {
        "profile": p,
        "submissions": submissions,
        "images": get_profile_images(profile_id),
    }


# --------------------------------------------------
# CREATE PROFILE + DUPLICATE PROTECTION
# --------------------------------------------------

@app.post("/api/profiles")
def create_profile(data: ProfileIn, user=Depends(current_user)):
    if data.gender not in ("Male", "Female"):
        raise HTTPException(400, "Gender must be Male or Female")

    d = data.model_dump()
    duplicate = None

    if d.get("phone"):
        found = (
            admin_client.table("profiles")
            .select("id,profile_code,full_name")
            .eq("phone", d["phone"])
            .limit(1)
            .execute()
            .data
        )

        if found:
            duplicate = found[0]

    if not duplicate and d.get("full_name") and d.get("age"):
        found = (
            admin_client.table("profiles")
            .select("id,profile_code,full_name")
            .ilike("full_name", d["full_name"])
            .eq("age", d["age"])
            .eq("gender", d["gender"])
            .limit(1)
            .execute()
            .data
        )

        if found:
            duplicate = found[0]

    if duplicate:
        existing_query = (
            admin_client.table("profile_submissions")
            .select("id")
            .eq("profile_id", duplicate["id"])
            .eq("user_id", user["id"])
        )

        if d.get("source_group") is None:
            existing_query = existing_query.is_("source_group", "null")
        else:
            existing_query = existing_query.eq(
                "source_group", d["source_group"]
            )

        if d.get("source_sender") is None:
            existing_query = existing_query.is_("source_sender", "null")
        else:
            existing_query = existing_query.eq(
                "source_sender", d["source_sender"]
            )

        existing = existing_query.limit(1).execute().data

        if not existing:
            admin_client.table("profile_submissions").insert({
                "profile_id": duplicate["id"],
                "user_id": user["id"],
                "source_group": d.get("source_group"),
                "source_sender": d.get("source_sender"),
                "is_first": False,
            }).execute()

            audit(user["id"], "duplicate_profile_submitted", {
                "profile_id": duplicate["id"],
                "original_submitter_preserved": True,
            })

        raise HTTPException(409, detail={
            "message": (
                "Possible duplicate profile. "
                "Original submitter preserved."
            ),
            "duplicate": duplicate,
        })

    d.update({
        "first_submitted_by": user["id"],
        "verification_status": "pending",
        "marriage_status": "available",
    })

    created = (
        admin_client.table("profiles")
        .insert(d)
        .execute()
        .data[0]
    )

    admin_client.table("profile_submissions").insert({
        "profile_id": created["id"],
        "user_id": user["id"],
        "source_group": d.get("source_group"),
        "source_sender": d.get("source_sender"),
        "is_first": True,
    }).execute()

    audit(user["id"], "profile_created", {
        "profile_id": created["id"],
        "profile_code": created["profile_code"],
    })

    return created


# --------------------------------------------------
# UPDATE PROFILE
# --------------------------------------------------

@app.patch("/api/profiles/{profile_id}")
def update_profile(profile_id: str, payload: dict, user=Depends(current_user)):
    allowed = {
        "full_name", "age", "height", "location", "gothram", "star",
        "education", "job", "salary_lpa", "phone", "notes",
        "verification_status", "marriage_status",
    }

    patch = {k: v for k, v in payload.items() if k in allowed}

    if not patch:
        raise HTTPException(400, "No editable fields supplied")

    if any(k in patch for k in ("verification_status", "marriage_status")):
        require_admin(user)

    result = (
        admin_client.table("profiles")
        .update(patch)
        .eq("id", profile_id)
        .execute()
        .data
    )

    audit(user["id"], "profile_updated", {
        "profile_id": profile_id,
        "fields": list(patch),
    })

    return result


# --------------------------------------------------
# OCR INTAKE
# --------------------------------------------------

@app.post("/api/intake/ocr")
async def ocr_intake(
    file: UploadFile = File(...),
    source_group: str = Form(""),
    source_sender: str = Form(""),
    source_date: str = Form(""),
    user=Depends(current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload an image file")

    raw = await file.read()

    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(413, "Image must be 12 MB or smaller")

    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
        text = pytesseract.image_to_string(img, lang="eng+tel")

    except Exception:
        raise HTTPException(
            422,
            "OCR failed. Install Tesseract and the Telugu language pack if needed.",
        )

    age_match = re.search(r"\b([2-6][0-9])\s*(?:yrs?|years?)\b", text, re.I)
    phone_match = re.search(
        r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)", text
    )

    suggestions = {
        "age": int(age_match.group(1)) if age_match else None,
        "phone": phone_match.group(0) if phone_match else None,
    }

    audit(user["id"], "ocr_processed", {
        "filename": file.filename,
        "source_group": source_group,
    })

    return {
        "ocr_text": text,
        "suggested_fields": suggestions,
        "source": {
            "group": source_group,
            "sender": source_sender,
            "date": source_date,
        },
        "warning": (
            "OCR can be inaccurate. Verify every field "
            "with the original image before saving."
        ),
    }


# --------------------------------------------------
# PRIVATE IMAGE UPLOAD
# --------------------------------------------------

@app.post("/api/intake/image")
async def upload_image(
    profile_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Image required")

    raw = await file.read()

    if not raw:
        raise HTTPException(400, "The uploaded image is empty")

    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(413, "Image must be 12 MB or smaller")

    profile = (
        admin_client.table("profiles")
        .select("id")
        .eq("id", profile_id)
        .limit(1)
        .execute()
        .data
    )

    if not profile:
        raise HTTPException(404, "Profile not found")

    verify_profile_image(raw)

    safe_filename = re.sub(
        r"[^A-Za-z0-9._-]", "_", file.filename or "profile.jpg"
    )

    path = (
        f"{profile_id}/"
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')}_"
        f"{safe_filename}"
    )

    try:
        admin_client.storage.from_("profile-images").upload(
            path,
            raw,
            {
                "content-type": file.content_type,
                "upsert": "false",
            },
        )

        inserted = (
            admin_client.table("profile_images")
            .insert({
                "profile_id": profile_id,
                "storage_path": path,
                "uploaded_by": user["id"],
                "original_filename": file.filename,
            })
            .execute()
            .data
        )

        if not inserted:
            raise RuntimeError("Image record was not created")

        row = inserted[0]

    except Exception as exc:
        try:
            admin_client.storage.from_("profile-images").remove([path])
        except Exception:
            pass

        raise HTTPException(
            400,
            "Could not upload image. Check the private profile-images bucket and database.",
        ) from exc

    audit(user["id"], "profile_image_uploaded", {
        "profile_id": profile_id,
        "image_id": row["id"],
    })

    return {"image": row}


# --------------------------------------------------
# GET PROFILE PHOTOS WITH PRIVATE SIGNED URLS
# --------------------------------------------------

@app.get("/api/profiles/{profile_id}/images")
def profile_images(profile_id: str, user=Depends(current_user)):
    profile = (
        admin_client.table("profiles")
        .select("id")
        .eq("id", profile_id)
        .limit(1)
        .execute()
        .data
    )

    if not profile:
        raise HTTPException(404, "Profile not found")

    return {"images": get_profile_images(profile_id)}


# --------------------------------------------------
# PROFILE MATCHING + NAKSHATRA REPORT
# --------------------------------------------------

@app.post("/api/matching")
def matching(data: MatchIn, user=Depends(current_user)):
    allowed = {"location", "salary_lpa", "job", "age", "gothram", "star"}
    criteria = list(dict.fromkeys(data.criteria))

    if len(criteria) != 3 or any(x not in allowed for x in criteria):
        raise HTTPException(400, "Select exactly three supported criteria")

    src = (
        admin_client.table("profiles")
        .select("*")
        .eq("id", data.profile_id)
        .single()
        .execute()
        .data
    )

    opposite = "Female" if src["gender"] == "Male" else "Male"

    candidates = (
        admin_client.table("profiles")
        .select("*")
        .eq("gender", opposite)
        .eq("marriage_status", "available")
        .neq("id", data.profile_id)
        .limit(1000)
        .execute()
        .data
        or []
    )

    weights = {
        "location": 30,
        "salary_lpa": 25,
        "job": 15,
        "age": 15,
        "gothram": 10,
        "star": 5,
    }

    out = []

    for candidate in candidates:
        score = 0.0
        available = 0
        reasons = []
        star_report = None

        for field in criteria:
            source_value = src.get(field)
            candidate_value = candidate.get(field)

            if source_value in (None, "") or candidate_value in (None, ""):
                reasons.append(f"{field}: missing")
                continue

            available += weights[field]

            if field == "star":
                if src["gender"] == "Male":
                    boy_star, girl_star = source_value, candidate_value
                else:
                    boy_star, girl_star = candidate_value, source_value

                star_report = nakshatra_compatibility(boy_star, girl_star)

                if star_report["available"]:
                    ratio = (
                        star_report["passed_checks"]
                        / star_report["total_checks"]
                    )
                    score += weights[field] * ratio
                    reasons.append("star: compatibility evaluated")
                else:
                    reasons.append("star: " + star_report["message"])

            elif field == "salary_lpa":
                is_match = (
                    float(candidate_value) >= float(source_value) * 0.5
                )

                if is_match:
                    score += weights[field]

                reasons.append(
                    f"{field}: {'match' if is_match else 'different'}"
                )

            elif field == "age":
                source_age = int(source_value)
                candidate_age = int(candidate_value)

                if src["gender"] == "Male":
                    is_match = candidate_age <= source_age

                    reason = (
                        f"age: match (candidate {candidate_age} is same age "
                        f"or younger than source {source_age})"
                        if is_match else
                        f"age: different (candidate {candidate_age} is older "
                        f"than source {source_age})"
                    )
                else:
                    is_match = candidate_age >= source_age

                    reason = (
                        f"age: match (candidate {candidate_age} is same age "
                        f"or older than source {source_age})"
                        if is_match else
                        f"age: different (candidate {candidate_age} is younger "
                        f"than source {source_age})"
                    )

                if is_match:
                    score += weights[field]

                reasons.append(reason)

            else:
                is_match = (
                    str(source_value).strip().casefold()
                    == str(candidate_value).strip().casefold()
                )

                if is_match:
                    score += weights[field]

                reasons.append(
                    f"{field}: {'match' if is_match else 'different'}"
                )

        out.append({
            "profile": candidate,
            "score": round(score / available * 100, 1) if available else 0,
            "reasons": reasons,
            "star_compatibility": star_report,
        })

    out.sort(key=lambda item: item["score"], reverse=True)

    audit(user["id"], "matching_run", {
        "source_profile": data.profile_id,
        "criteria": criteria,
    })

    return {
        "criteria": criteria,
        "results": out[:100],
    }


# --------------------------------------------------
# SHORTLISTS
# --------------------------------------------------

@app.post("/api/shortlists")
def shortlist(payload: dict, user=Depends(current_user)):
    row = (
        admin_client.table("shortlists")
        .upsert(
            {
                "profile_id": payload["profile_id"],
                "created_by": user["id"],
                "notes": payload.get("notes", ""),
            },
            on_conflict="profile_id,created_by",
        )
        .execute()
        .data
    )

    return row


@app.get("/api/shortlists")
def get_shortlists(user=Depends(current_user)):
    return (
        admin_client.table("shortlists")
        .select("*,profiles(*)")
        .eq("created_by", user["id"])
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


# --------------------------------------------------
# MEMBERS
# --------------------------------------------------

@app.get("/api/members")
def members(user=Depends(current_user)):
    require_admin(user)

    return (
        admin_client.table("user_profiles")
        .select("id,full_name,role,active,language")
        .order("full_name")
        .execute()
        .data
        or []
    )


# --------------------------------------------------
# COMMISSIONS
# --------------------------------------------------

@app.post("/api/commissions")
def add_commission(data: CommissionIn, user=Depends(current_user)):
    require_admin(user)

    row = (
        admin_client.table("commissions")
        .insert(data.model_dump())
        .execute()
        .data[0]
    )

    audit(user["id"], "commission_created", {
        "commission_id": row["id"],
    })

    return row


@app.get("/api/commissions")
def commissions(user=Depends(current_user)):
    require_admin(user)

    return (
        admin_client.table("commissions")
        .select(
            "*,profiles(profile_code,full_name),"
            "user_profiles!commissions_owner_id_fkey(full_name)"
        )
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


# --------------------------------------------------
# WHATSAPP WEBHOOK
# --------------------------------------------------

@app.get("/api/whatsapp/webhook")
def whatsapp_verify(request: Request):
    q = request.query_params

    if (
        q.get("hub.mode") == "subscribe"
        and hmac.compare_digest(
            q.get("hub.verify_token", ""),
            settings.whatsapp_verify_token,
        )
    ):
        return PlainTextResponse(q.get("hub.challenge", ""))

    raise HTTPException(403, "Webhook verification failed")


@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if settings.whatsapp_app_secret:
        expected = (
            "sha256="
            + hmac.new(
                settings.whatsapp_app_secret.encode(),
                body,
                hashlib.sha256,
            ).hexdigest()
        )

        if not hmac.compare_digest(signature, expected):
            raise HTTPException(401, "Invalid webhook signature")

    payload = json.loads(body or b"{}")

    admin_client.table("whatsapp_events").insert({
        "payload": payload,
        "status": "needs_review",
    }).execute()

    return {"received": True}


# --------------------------------------------------
# AUDIT HISTORY
# --------------------------------------------------

@app.get("/api/audit")
def audit_events(user=Depends(current_user)):
    require_admin(user)

    return (
        admin_client.table("audit_logs")
        .select("*,user_profiles(full_name)")
        .order("created_at", desc=True)
        .limit(250)
        .execute()
        .data
        or []
    )


# --------------------------------------------------
# END OF APPLICATION
# --------------------------------------------------
