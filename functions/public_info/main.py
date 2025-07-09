from datetime import datetime, timedelta
import json

import functions_framework
from google.cloud import firestore

client = firestore.Client(database="status-db")

@functions_framework.http
def main(request):
    history = datetime.now() - timedelta(days=2)
    docs = client.collection("updates").select(["stat", "value"]).where("timestamp", ">", history).get()
    return json.dumps([doc.to_dict() for doc in docs])
