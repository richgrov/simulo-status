import base64
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from flask import Request, jsonify
import functions_framework
from google.cloud import firestore

db = firestore.Client(database="status-db")

TARGET_STATUS = os.environ.get("TARGET_STATUS")

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


@functions_framework.http
def public_info(_: Request):
    docs = (db.collection("logs")
        .select(["name", "value"])
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(1)
        .get())

    if len(docs) == 0:
        return jsonify({"status": "fault"}), 200

    doc = docs[0]
    if doc.get("value") != TARGET_STATUS:
        return jsonify({"status": "fault"}), 200

    return jsonify({"status": "ok"}), 200


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
