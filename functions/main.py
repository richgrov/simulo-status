import base64
import os
import datetime
import json

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

    headers = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
    }

    quickest_since = None
    ok = False

    for machine in db.collection("machines").stream():
        for collection in machine.reference.collections():
            if not collection.id.startswith("metric_"):
                continue

            metric = collection.id.removeprefix("metric_")

            docs = collection.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(1).get()
            if not docs or len(docs) == 0:
                return jsonify({"status": "fault"}), 200, headers
            
            doc = docs[0]

            timestamp = doc.get("timestamp")
            assert isinstance(timestamp, datetime.datetime)
            duration = datetime.datetime.now(datetime.timezone.utc) - timestamp
            if duration.total_seconds() > 60 * 25:
                return jsonify({"status": "fault"}), 200, headers

            if quickest_since is None or duration < quickest_since:
                quickest_since = duration

            value = doc.get("value")

            if metric == "service" and value == "active":
                ok = True
            elif metric == "cpu_percent" and all(0 <= v <= 100 for v in value):
                ok = True
            elif metric == "max_ram" and value > 0:
                ok = True
            elif metric == "ram_used" and value >= 0:
                ok = True
            elif metric == "ram_free" and value >= 0:
                ok = True

    duration_str = format_duration(quickest_since)

    if ok:
        return jsonify({"status": "ok", "since": duration_str}), 200, headers
    else:
        return jsonify({"status": "fault", "since": duration_str}), 200, headers


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
        logs = data.get("logs")

        if not isinstance(id, str) or not isinstance(signature, str) or not isinstance(logs, str):
            return "bad request", 400

        doc_ref = db.collection("machines").document(id)
        doc = doc_ref.get()
        if not doc.exists:
            return "machine not found", 404

        public_key_pem = doc.get("public_key")
        assert isinstance(public_key_pem, str)

        message = id + logs
        if not verify_signature(public_key_pem, message, signature):
            return "unauthorized", 401

        try:
            logs = json.loads(logs)
        except Exception as e:
            print(f"failed to parse logs: {e}")
            return "bad request", 400

        for key, value in logs:
            if not isinstance(key, str) or \
                not isinstance(value, (str, int, float, bool, list, dict)) or \
                key not in ["service", "cpu_percent", "max_ram", "ram_used", "ram_free"]:
                print(f"invalid log entry: {key} {value}")
                return "bad request", 400

            doc_ref.collection("metric_" + key).add({
                "value": value,
                "timestamp": firestore.SERVER_TIMESTAMP
            })

        return "ok", 200

    except Exception as e:
        print(f"internal server error: {e}")
        return "internal server error", 500
