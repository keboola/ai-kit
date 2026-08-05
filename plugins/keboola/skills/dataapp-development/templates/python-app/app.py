"""Minimal Python data app — Flask on internal port 5000."""
import os
from flask import Flask, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", 5000))


@app.route("/", methods=["GET", "POST"])
def index():
    # Keboola POSTs to / on startup — handle both methods.
    return """
    <!doctype html>
    <html><body style="font-family:sans-serif;padding:2rem;">
      <h1>Hello from Keboola</h1>
      <p>Python/JS Flask app running.</p>
    </body></html>
    """


@app.route("/api/health")
def health():
    return jsonify(ok=True, kbc_url=bool(os.environ.get("KBC_URL")))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
