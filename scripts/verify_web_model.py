from __future__ import annotations

import csv
import struct
from pathlib import Path

import joblib
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "api" / "models" / "libras_21_model.joblib"
BINARY_PATH = ROOT / "public" / "models" / "libras_21_forest.bin"
DATASETS = [
    ROOT / ".training" / "original-dataset.bin",
    ROOT / ".training" / "external-landmarks.csv",
]
MAGIC = 0x46524C49


def align4(value: int) -> int:
    return (value + 3) & ~3


def load_samples(limit_per_dataset: int = 1500) -> np.ndarray:
    rng = np.random.default_rng(20260821)
    selected: list[np.ndarray] = []
    for path in DATASETS:
        with path.open(newline="", encoding="utf-8") as source:
            reader = csv.reader(source)
            next(reader)
            rows = [row for row in reader if len(row) == 64]
        indexes = rng.choice(len(rows), size=min(limit_per_dataset, len(rows)), replace=False)
        selected.append(np.asarray([[float(value) for value in rows[index][1:]] for index in indexes], dtype=np.float32))
    return np.vstack(selected)


class WebForest:
    def __init__(self, path: Path):
        data = path.read_bytes()
        magic, version, class_count, tree_count, node_count, _, labels_length, _ = struct.unpack_from("<8I", data)
        if magic != MAGIC or version != 1:
            raise ValueError("Invalid web forest header")
        self.labels = data[32 : 32 + labels_length].decode("ascii").split("\0")
        if len(self.labels) != class_count:
            raise ValueError("Invalid label count")
        offset = align4(32 + labels_length)
        self.roots = np.frombuffer(data, dtype="<i4", count=tree_count, offset=offset)
        offset += self.roots.nbytes
        self.features = np.frombuffer(data, dtype=np.int8, count=node_count, offset=offset)
        offset += self.features.nbytes
        self.leaf_classes = np.frombuffer(data, dtype=np.int8, count=node_count, offset=offset)
        offset = align4(offset + self.leaf_classes.nbytes)
        self.thresholds = np.frombuffer(data, dtype="<f4", count=node_count, offset=offset)
        offset += self.thresholds.nbytes
        self.left = np.frombuffer(data, dtype="<i4", count=node_count, offset=offset)
        offset += self.left.nbytes
        self.right = np.frombuffer(data, dtype="<i4", count=node_count, offset=offset)

    def predict_proba(self, samples: np.ndarray) -> np.ndarray:
        probabilities = np.zeros((len(samples), len(self.labels)), dtype=np.float64)
        for sample_index, sample in enumerate(samples):
            votes = np.zeros(len(self.labels), dtype=np.uint16)
            for root in self.roots:
                node = int(root)
                while self.leaf_classes[node] < 0:
                    node = int(self.left[node] if sample[self.features[node]] <= self.thresholds[node] else self.right[node])
                votes[self.leaf_classes[node]] += 1
            probabilities[sample_index] = votes / len(self.roots)
        return probabilities


def main() -> None:
    model = joblib.load(MODEL_PATH)
    web_model = WebForest(BINARY_PATH)
    samples = load_samples()
    expected = model.predict_proba(samples)
    actual = web_model.predict_proba(samples)
    expected_labels = np.asarray(model.classes_)[np.argmax(expected, axis=1)]
    actual_labels = np.asarray(web_model.labels)[np.argmax(actual, axis=1)]
    matches = int(np.sum(expected_labels == actual_labels))
    max_probability_delta = float(np.max(np.abs(expected - actual)))
    print(f"Samples checked: {len(samples)}")
    print(f"Matching predictions: {matches}/{len(samples)}")
    print(f"Maximum probability delta: {max_probability_delta:.10f}")
    if matches != len(samples) or max_probability_delta > 1e-7:
        raise SystemExit("Web model parity check failed")


if __name__ == "__main__":
    main()
