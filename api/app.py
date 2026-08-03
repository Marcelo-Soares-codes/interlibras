from __future__ import annotations

import base64
import binascii
import os
from threading import Lock
from pathlib import Path

import cv2
import joblib
import numpy as np
from cvzone.HandTrackingModule import HandDetector
from flask import Flask, jsonify, request


BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = os.getenv("LIBRAS_MODEL", "libras_21")
MODEL_PATH = BASE_DIR / "models" / f"{MODEL_NAME}_model.joblib"
MODEL_LABELS = [
    "A", "B", "C", "D", "E", "F", "G", "I", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y",
]
SUPPORTED_LABELS = MODEL_LABELS
MAX_IMAGE_BYTES = 8 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES * 2

model = joblib.load(MODEL_PATH)
detector = HandDetector(staticMode=True, maxHands=1, detectionCon=0.4)
inference_lock = Lock()


def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.after_request
def add_cors_headers(response):
    return cors(response)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME, "letters": SUPPORTED_LABELS})


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image")
    if not isinstance(data_url, str) or "," not in data_url:
        return jsonify({"status": "error", "message": "Envie uma imagem válida."}), 400

    try:
        encoded = data_url.split(",", 1)[1]
        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        return jsonify({"status": "error", "message": "A imagem está corrompida."}), 400

    if len(image_bytes) > MAX_IMAGE_BYTES:
        return jsonify({"status": "error", "message": "A imagem deve ter no máximo 8 MB."}), 413

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"status": "error", "message": "Formato de imagem não reconhecido."}), 400

    try:
        with inference_lock:
            result = classify(frame)
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 422

    return jsonify({"status": "success", **result})


def classify(frame: np.ndarray) -> dict[str, object]:
    height_px, width_px = frame.shape[:2]
    if max(height_px, width_px) < 640:
        scale = 640 / max(height_px, width_px)
        frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    hands, _ = detector.findHands(frame, draw=False, flipType=True)
    if not hands:
        raise ValueError("Nenhuma mão foi encontrada. Centralize uma mão aberta e tente novamente.")

    hand = hands[0]
    landmarks = hand["lmList"]
    x, y, width, height = hand["bbox"]
    if width <= 0 or height <= 0:
        raise ValueError("Não foi possível medir a mão na imagem.")

    z_values = [mark[2] for mark in landmarks]
    z_min, z_max = min(z_values), max(z_values)
    z_range = z_max - z_min or 1

    points: list[float] = []
    for lx, ly, lz in landmarks:
        points.extend(((lx - x) / width, (ly - y) / height, (lz - z_min) / z_range))

    features = np.asarray(points, dtype=np.float64).reshape(1, 63)
    raw_prediction = np.asarray(model.predict(features))
    if raw_prediction.ndim == 2 and raw_prediction.shape[1] == len(MODEL_LABELS):
        predicted_index = int(np.argmax(raw_prediction[0]))
        predicted = MODEL_LABELS[predicted_index]
    else:
        predicted = str(raw_prediction.reshape(-1)[0])

    confidence = None
    alternatives = []
    if hasattr(model, "predict_proba"):
        raw_probabilities = model.predict_proba(features)
        if isinstance(raw_probabilities, list):
            probabilities = [float(values[0][-1]) for values in raw_probabilities]
            class_names = MODEL_LABELS
        else:
            probabilities = np.asarray(raw_probabilities)[0]
            class_names = [str(value) for value in model.classes_]
        ranked = sorted(
            ((label, score) for label, score in zip(class_names, probabilities) if label in SUPPORTED_LABELS),
            key=lambda item: item[1],
            reverse=True,
        )
        predicted = ranked[0][0]
        confidence = round(float(ranked[0][1]), 4)
        alternatives = [
            {"letter": label, "confidence": round(float(score), 4)}
            for label, score in ranked[1:3]
        ]

    return {
        "letter": predicted,
        "confidence": confidence,
        "alternatives": alternatives,
        "handedness": hand.get("type"),
    }


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"status": "error", "message": "A imagem deve ter no máximo 8 MB."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
