export type ForestPrediction = {
  letter: string;
  confidence: number;
  alternatives: Array<{ letter: string; confidence: number }>;
};

const MAGIC = 0x46524c49;
const VERSION = 1;
const HEADER_BYTES = 32;

const align4 = (value: number) => (value + 3) & ~3;

export class RandomForestModel {
  private constructor(
    private readonly labels: string[],
    private readonly roots: Int32Array,
    private readonly features: Int8Array,
    private readonly leafClasses: Int8Array,
    private readonly thresholds: Float32Array,
    private readonly left: Int32Array,
    private readonly right: Int32Array,
  ) {}

  static async load(url: string): Promise<RandomForestModel> {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Não foi possível carregar o modelo de Libras.");
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== VERSION) {
      throw new Error("O modelo de Libras é incompatível com esta versão.");
    }

    const classCount = view.getUint32(8, true);
    const treeCount = view.getUint32(12, true);
    const nodeCount = view.getUint32(16, true);
    const labelsLength = view.getUint32(24, true);
    const labelBytes = new Uint8Array(buffer, HEADER_BYTES, labelsLength);
    const labels = new TextDecoder("ascii").decode(labelBytes).split("\0");
    if (labels.length !== classCount) throw new Error("As classes do modelo estão corrompidas.");

    let offset = align4(HEADER_BYTES + labelsLength);
    const roots = new Int32Array(buffer, offset, treeCount);
    offset += roots.byteLength;
    const features = new Int8Array(buffer, offset, nodeCount);
    offset += features.byteLength;
    const leafClasses = new Int8Array(buffer, offset, nodeCount);
    offset = align4(offset + leafClasses.byteLength);
    const thresholds = new Float32Array(buffer, offset, nodeCount);
    offset += thresholds.byteLength;
    const left = new Int32Array(buffer, offset, nodeCount);
    offset += left.byteLength;
    const right = new Int32Array(buffer, offset, nodeCount);

    return new RandomForestModel(labels, roots, features, leafClasses, thresholds, left, right);
  }

  predict(features: Float32Array): ForestPrediction {
    if (features.length !== 63) throw new Error("O reconhecedor esperava 63 pontos normalizados.");
    const votes = new Uint16Array(this.labels.length);

    for (const root of this.roots) {
      let node = root;
      while (this.leafClasses[node] < 0) {
        node = features[this.features[node]] <= this.thresholds[node] ? this.left[node] : this.right[node];
      }
      votes[this.leafClasses[node]] += 1;
    }

    const ranked = this.labels
      .map((letter, index) => ({ letter, confidence: votes[index] / this.roots.length }))
      .sort((first, second) => second.confidence - first.confidence);

    return {
      letter: ranked[0].letter,
      confidence: ranked[0].confidence,
      alternatives: ranked.slice(1, 3),
    };
  }
}
