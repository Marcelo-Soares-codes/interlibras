from __future__ import annotations

import struct
from pathlib import Path

import joblib
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "api" / "models" / "libras_21_model.joblib"
OUTPUT = ROOT / "public" / "models" / "libras_21_forest.bin"
MAGIC = 0x46524C49  # ILRF in little-endian byte order.
VERSION = 1


def align4(value: int) -> int:
    return (value + 3) & ~3


def main() -> None:
    model = joblib.load(SOURCE)
    labels = [str(value) for value in model.classes_]
    trees = model.estimators_
    node_count = sum(estimator.tree_.node_count for estimator in trees)

    roots: list[int] = []
    features = np.empty(node_count, dtype=np.int8)
    thresholds = np.empty(node_count, dtype="<f4")
    left = np.empty(node_count, dtype="<i4")
    right = np.empty(node_count, dtype="<i4")
    leaf_classes = np.full(node_count, -1, dtype=np.int8)
    leaf_count = 0

    node_offset = 0
    for estimator in trees:
        tree = estimator.tree_
        roots.append(node_offset)
        length = tree.node_count
        node_slice = slice(node_offset, node_offset + length)
        features[node_slice] = tree.feature.astype(np.int8)
        thresholds[node_slice] = tree.threshold.astype(np.float32)

        local_left = tree.children_left.astype(np.int32)
        local_right = tree.children_right.astype(np.int32)
        left[node_slice] = np.where(local_left >= 0, local_left + node_offset, -1)
        right[node_slice] = np.where(local_right >= 0, local_right + node_offset, -1)

        for local_index in np.flatnonzero(local_left < 0):
            counts = tree.value[local_index][0].astype(np.float64)
            nonzero_classes = np.flatnonzero(counts)
            if len(nonzero_classes) != 1:
                raise ValueError("The compact web format requires pure Random Forest leaves.")
            leaf_classes[node_offset + local_index] = int(nonzero_classes[0])
            leaf_count += 1

        node_offset += length

    roots_array = np.asarray(roots, dtype="<i4")
    labels_bytes = "\0".join(labels).encode("ascii")

    header = struct.pack(
        "<8I",
        MAGIC,
        VERSION,
        len(labels),
        len(trees),
        node_count,
        leaf_count,
        len(labels_bytes),
        0,
    )

    chunks = [header, labels_bytes]
    current_size = len(header) + len(labels_bytes)
    padding = align4(current_size) - current_size
    if padding:
        chunks.append(b"\0" * padding)
    chunks.extend(
        [
            roots_array.tobytes(),
            features.tobytes(),
            leaf_classes.tobytes(),
        ]
    )
    current_size = sum(len(chunk) for chunk in chunks)
    padding = align4(current_size) - current_size
    if padding:
        chunks.append(b"\0" * padding)
    chunks.extend(
        [
            thresholds.tobytes(),
            left.tobytes(),
            right.tobytes(),
        ]
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(b"".join(chunks))
    print(f"Exported {len(trees)} trees, {node_count} nodes and {leaf_count} pure leaves")
    print(f"Labels: {', '.join(labels)}")
    print(f"Output: {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
