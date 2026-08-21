from __future__ import annotations

import csv
import json
from pathlib import Path

import cv2
import joblib
import numpy as np
from cvzone.HandTrackingModule import HandDetector
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier


ROOT = Path(__file__).resolve().parents[2]
ORIGINAL_CSV = ROOT / ".training" / "original-dataset.bin"
EXTERNAL_ROOT = ROOT / ".validation-dataset-page" / "dataset"
EXTERNAL_CSV = ROOT / ".training" / "external-landmarks.csv"
MODEL_OUTPUT = Path(__file__).resolve().with_name("libras_21_model.joblib")
METRICS_OUTPUT = ROOT / ".training" / "metrics.json"
LABELS = ["A", "B", "C", "D", "E", "F", "G", "I", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y"]


def landmarks_from_image(detector: HandDetector, image_path: Path) -> list[float] | None:
    frame = cv2.imread(str(image_path))
    if frame is None:
        return None
    height_px, width_px = frame.shape[:2]
    if max(height_px, width_px) < 640:
        scale = 640 / max(height_px, width_px)
        frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    hands, _ = detector.findHands(frame, draw=False, flipType=True)
    if not hands:
        return None
    hand = hands[0]
    x, y, width, height = hand["bbox"]
    if width <= 0 or height <= 0:
        return None
    marks = hand["lmList"]
    z_values = [mark[2] for mark in marks]
    z_min, z_max = min(z_values), max(z_values)
    z_range = z_max - z_min or 1
    points: list[float] = []
    for lx, ly, lz in marks:
        points.extend(((lx - x) / width, (ly - y) / height, (lz - z_min) / z_range))
    return points


def extract_external() -> None:
    if EXTERNAL_CSV.exists():
        print(f"Using cached external landmarks: {EXTERNAL_CSV}", flush=True)
        return
    detector = HandDetector(staticMode=True, maxHands=1, detectionCon=0.4)
    rows: list[list[object]] = []
    image_paths = sorted(EXTERNAL_ROOT.glob("*/*.jpg"))
    for index, path in enumerate(image_paths, start=1):
        points = landmarks_from_image(detector, path)
        if points is not None:
            rows.append([path.parent.name, *points])
        if index % 250 == 0 or index == len(image_paths):
            print(f"Landmarks: {index}/{len(image_paths)} images, {len(rows)} detected", flush=True)
    with EXTERNAL_CSV.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["label", *[f"feature_{index}" for index in range(63)]])
        writer.writerows(rows)


def load_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with path.open(newline="", encoding="utf-8") as source:
        reader = csv.reader(source)
        next(reader)
        rows = [row for row in reader if len(row) == 64]
    y = np.asarray([row[0] for row in rows])
    x = np.asarray([[float(value) for value in row[1:]] for row in rows], dtype=np.float32)
    return x, y


def main() -> None:
    extract_external()
    original_x, original_y = load_csv(ORIGINAL_CSV)
    external_x, external_y = load_csv(EXTERNAL_CSV)

    original_train_x, original_test_x, original_train_y, original_test_y = train_test_split(
        original_x, original_y, test_size=0.15, random_state=42, stratify=original_y
    )
    external_train_x, external_test_x, external_train_y, external_test_y = train_test_split(
        external_x, external_y, test_size=0.25, random_state=42, stratify=external_y
    )
    train_x = np.vstack([original_train_x, external_train_x])
    train_y = np.concatenate([original_train_y, external_train_y])

    candidates = {
        "knn": KNeighborsClassifier(n_neighbors=5, weights="distance", n_jobs=-1),
        "random_forest": RandomForestClassifier(n_estimators=240, max_features="sqrt", n_jobs=-1, random_state=42),
        "extra_trees": ExtraTreesClassifier(n_estimators=240, max_features="sqrt", n_jobs=-1, random_state=42),
    }
    metrics: dict[str, object] = {
        "samples": {"original": len(original_y), "external_detected": len(external_y), "train": len(train_y)},
        "models": {},
    }
    best_name = ""
    best_model = None
    best_score = -1.0
    for name, candidate in candidates.items():
        print(f"Training {name}...", flush=True)
        candidate.fit(train_x, train_y)
        original_accuracy = accuracy_score(original_test_y, candidate.predict(original_test_x))
        external_predictions = candidate.predict(external_test_x)
        external_accuracy = accuracy_score(external_test_y, external_predictions)
        combined_score = 0.35 * original_accuracy + 0.65 * external_accuracy
        metrics["models"][name] = {
            "original_accuracy": round(float(original_accuracy), 5),
            "external_accuracy": round(float(external_accuracy), 5),
            "weighted_score": round(float(combined_score), 5),
        }
        print(name, metrics["models"][name], flush=True)
        if combined_score > best_score:
            best_name, best_model, best_score = name, candidate, combined_score

    assert best_model is not None
    metrics["selected_model"] = best_name
    metrics["external_report"] = classification_report(
        external_test_y, best_model.predict(external_test_x), labels=sorted(set(external_test_y)), output_dict=True, zero_division=0
    )
    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, MODEL_OUTPUT, compress=3)
    METRICS_OUTPUT.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"Selected: {best_name}", flush=True)
    print(f"Model saved to: {MODEL_OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
