import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { RandomForestModel, type ForestPrediction } from "./randomForest";

export type RecognitionResult = ForestPrediction & { handedness: string | null };

const MODEL_PATH = "/models/hand_landmarker.task";
const FOREST_PATH = "/models/libras_21_forest.bin";
const WASM_PATH = "/mediapipe";
const ANALYSIS_SIZE = 640;

const prepareCanvas = (source: HTMLVideoElement | HTMLImageElement) => {
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sourceWidth || !sourceHeight) return null;
  const scale = ANALYSIS_SIZE / Math.max(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.getContext("2d", { alpha: false })?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const normalizeLandmarks = (landmarks: NormalizedLandmark[], width: number, height: number) => {
  if (landmarks.length !== 21) throw new Error("A mão detectada não possui os 21 pontos esperados.");

  // CVZone, usado no treinamento, converts MediaPipe coordinates to integer pixels.
  const marks = landmarks.map(({ x, y, z }) => [
    Math.trunc(x * width),
    Math.trunc(y * height),
    Math.trunc(z * width),
  ]);
  const xValues = marks.map((mark) => mark[0]);
  const yValues = marks.map((mark) => mark[1]);
  const zValues = marks.map((mark) => mark[2]);
  const xMin = Math.min(...xValues);
  const yMin = Math.min(...yValues);
  const zMin = Math.min(...zValues);
  const widthRange = Math.max(...xValues) - xMin;
  const heightRange = Math.max(...yValues) - yMin;
  const zRange = Math.max(...zValues) - zMin || 1;
  if (widthRange <= 0 || heightRange <= 0) throw new Error("Não foi possível medir a mão.");

  const output = new Float32Array(63);
  marks.forEach(([x, y, z], index) => {
    output[index * 3] = (x - xMin) / widthRange;
    output[index * 3 + 1] = (y - yMin) / heightRange;
    output[index * 3 + 2] = (z - zMin) / zRange;
  });
  return output;
};

class LocalLibrasRecognizer {
  private initialization: Promise<void> | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private forest: RandomForestModel | null = null;
  private mode: "IMAGE" | "VIDEO" = "IMAGE";

  initialize() {
    if (!this.initialization) this.initialization = this.load();
    return this.initialization;
  }

  private async load() {
    const [vision, forest] = await Promise.all([
      FilesetResolver.forVisionTasks(WASM_PATH),
      RandomForestModel.load(FOREST_PATH),
    ]);
    this.forest = forest;
    try {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    }
  }

  async recognizeVideo(video: HTMLVideoElement, timestamp: number) {
    await this.initialize();
    if (this.mode !== "VIDEO") {
      await this.handLandmarker!.setOptions({ runningMode: "VIDEO" });
      this.mode = "VIDEO";
    }
    const canvas = prepareCanvas(video);
    if (!canvas) return null;
    return this.classify(this.handLandmarker!.detectForVideo(canvas, timestamp), canvas.width, canvas.height);
  }

  async recognizeImage(image: HTMLImageElement) {
    await this.initialize();
    if (this.mode !== "IMAGE") {
      await this.handLandmarker!.setOptions({ runningMode: "IMAGE" });
      this.mode = "IMAGE";
    }
    const canvas = prepareCanvas(image);
    if (!canvas) throw new Error("Não foi possível preparar a imagem.");
    return this.classify(this.handLandmarker!.detect(canvas), canvas.width, canvas.height);
  }

  private classify(result: HandLandmarkerResult, width: number, height: number): RecognitionResult | null {
    const landmarks = result.landmarks[0];
    if (!landmarks) return null;
    const prediction = this.forest!.predict(normalizeLandmarks(landmarks, width, height));
    return {
      ...prediction,
      handedness: result.handedness[0]?.[0]?.categoryName ?? null,
    };
  }
}

export const localRecognizer = new LocalLibrasRecognizer();
