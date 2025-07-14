import base64
import os
import datetime

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from flask import Request, jsonify
import functions_framework
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

db = firestore.Client(database="status-db")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN")

def verify_signature(public_key_pem: str, message: str, signature_b64: str) -> bool:
    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    assert isinstance(public_key, Ed25519PublicKey)
    signature = base64.b64decode(signature_b64)

    try:
        public_key.verify(signature, message.encode("utf-8"))
        return True
    except Exception as e:
        print(f"Verification failed: {e}")
        return False

def pluralize(count: int, word: str) -> str:
    if count == 1:
        return f"{word}"
    else:
        return f"{word}s"


def format_duration(duration: datetime.timedelta) -> str:
    if duration.seconds < 60:
        secs = duration.seconds
        return f"{secs} {pluralize(secs, 'second')} ago"
    elif duration.seconds < 3600:
        mins = duration.seconds // 60
        return f"{mins} {pluralize(mins, 'minute')} ago"
    else:
        hours = duration.seconds // 3600
        return f"{hours} {pluralize(hours, 'hour')} ago"


@functions_framework.http
def public_info(req: Request):
    if req.method == "OPTIONS":
        return "ok", 200, {
            "Access-Control-Allow-Origin": CORS_ORIGIN,
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Content-Type"
        }

    docs = (db.collection("logs")
        .select(["name", "value", "timestamp"])
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(1)
        .get())

    headers = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
    }

    doc = docs[0]

    timestamp = doc.get("timestamp")
    assert isinstance(timestamp, datetime.datetime)
    
    duration = datetime.datetime.now(datetime.timezone.utc) - timestamp
    duration_str = format_duration(duration)

    if doc.get("value") != "active":
        return jsonify({"status": "fault", "since": duration_str}), 200, headers

    return jsonify({"status": "ok", "since": duration_str}), 200, headers


@functions_framework.http
def log(request: Request):
    try:
        data = request.get_json()
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        return "bad request", 400

    try:
        id = data.get("id")
        signature = data.get("signature")
        key = data.get("key")
        value = data.get("value")

        if not all([id, signature, key, value]):
            return "bad request", 400

        doc_ref = db.collection("machines").document(id)
        doc = doc_ref.get()

        if not doc.exists:
            return "machine not found", 404

        public_key_pem = doc.get("public_key")
        assert isinstance(public_key_pem, str)

        message = key + value
        if not verify_signature(public_key_pem, message, signature):
            return "unauthorized", 401

        db.collection("logs").add({
            "id": id,
            "key": key,
            "value": value,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return "ok", 200

    except Exception as e:
        print(f"Internal server error: {e}")
        return "internal server error", 500
