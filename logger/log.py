#!/usr/bin/env python3

import os
import json
import base64
import subprocess
from typing import Tuple
import psutil
import requests
from datetime import datetime
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

PRIVATE_KEY_PATH = os.path.expanduser("~/.simulo/private.der")
LOG_ENDPOINT = ""
BACKEND_ID = ""

with open(PRIVATE_KEY_PATH, "rb") as key_file:
    private_key = serialization.load_der_private_key(key_file.read(), password=None)
    if not isinstance(private_key, Ed25519PrivateKey):
        raise TypeError("Loaded key is not an Ed25519 private key")

def get_service_status() -> str:
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "simulo-backend"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=True,
            text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "error"

def sign_message(message: str) -> str:
    signature = private_key.sign(message.encode("utf-8"))
    return base64.b64encode(signature).decode("utf-8")

def post_log(entries: Tuple[str, str]):
    logs = [[key, value] for key, value in entries]
    logs_str = json.dumps(logs)

    payload = {
        "id": BACKEND_ID,
        "signature": sign_message(BACKEND_ID + logs_str),
        "logs": logs_str
    }

    response = requests.post(LOG_ENDPOINT + "/log", json=payload)
    print(f"[{datetime.now().isoformat()}] Sent status '{logs_str}', response: {response.status_code} {response.text}")

def main():
    status = get_service_status()

    cpus_percent = psutil.cpu_percent(interval=1, percpu=True)
    vram = psutil.virtual_memory()

    post_log([
        ("service", status),
        ("cpu_percent", cpus_percent),
        ("max_ram", vram.total),
        ("ram_used", vram.used),
        ("ram_free", vram.free)
    ])

if __name__ == "__main__":
    log_endpoint = os.environ.get("SIMULO_STATUS_API")
    assert log_endpoint is not None
    LOG_ENDPOINT = log_endpoint

    backend_id = os.environ.get("SIMULO_STATUS_ID")
    assert backend_id is not None
    BACKEND_ID = backend_id

    main()
