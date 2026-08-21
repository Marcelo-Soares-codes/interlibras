import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, BrainCircuit, Camera, Check, Cpu, Hand, ImagePlus, LoaderCircle, LockKeyhole, RefreshCw, ScanLine, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { localRecognizer } from "./recognition/localRecognizer";

const LIVE_INTERVAL_MS = 420;
const MIN_CONFIDENCE = 0.55;

type Prediction = { letter: string; confidence: number | null };

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRequestRef = useRef(0);
  const stableRef = useRef({ letter: "", count: 0 });
  const [screen, setScreen] = useState<"landing" | "camera">("landing");
  const [preview, setPreview] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [liveHint, setLiveHint] = useState("Enquadre sua mão");
  const [error, setError] = useState("");

  const stopCamera = () => {
    startRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    stableRef.current = { letter: "", count: 0 };
    setCameraOpen(false);
    setCameraStarting(false);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    const startPlayback = () => {
      void video.play().catch(() => setLiveHint("Toque na tela para iniciar a câmera"));
    };
    video.addEventListener("loadedmetadata", startPlayback, { once: true });
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) startPlayback();

    return () => {
      video.removeEventListener("loadedmetadata", startPlayback);
      video.srcObject = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!cameraOpen) return;
    let stopped = false;
    let timer: number | undefined;
    const schedule = (delay = LIVE_INTERVAL_MS) => { if (!stopped) timer = window.setTimeout(scan, delay); };
    const scan = async () => {
      if (stopped) return;
      if (document.hidden) return schedule(1200);
      const video = videoRef.current;
      if (!video?.videoWidth || !video.videoHeight) return schedule(350);
      try {
        const data = await localRecognizer.recognizeVideo(video, performance.now());
        if (data && data.confidence >= MIN_CONFIDENCE) {
          const stable = stableRef.current;
          stableRef.current = stable.letter === data.letter ? { letter: data.letter, count: stable.count + 1 } : { letter: data.letter, count: 1 };
          setLiveHint(stableRef.current.count >= 2 ? "Sinal reconhecido" : "Mantenha o gesto...");
          if (stableRef.current.count >= 2) setPrediction(data);
        } else {
          stableRef.current = { letter: "", count: 0 };
          setLiveHint(data ? "Ajuste a iluminação" : "Mostre toda a mão");
        }
      } catch {
        setLiveHint("Não foi possível analisar este quadro");
      } finally {
        schedule();
      }
    };
    schedule(700);
    return () => { stopped = true; if (timer) window.clearTimeout(timer); };
  }, [cameraOpen]);

  const startCamera = async () => {
    stopCamera();
    const requestId = startRequestRef.current;
    setScreen("camera");
    setPreview("");
    setPrediction(null);
    setError("");
    setCameraStarting(true);
    setLiveHint("Carregando reconhecimento local...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera exige localhost ou uma conexão HTTPS.");
      await localRecognizer.initialize();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOpen(true);
      setCameraStarting(false);
      setLiveHint("Enquadre sua mão");
    } catch (reason) {
      if (requestId !== startRequestRef.current) return;
      setCameraStarting(false);
      const denied = reason instanceof DOMException && reason.name === "NotAllowedError";
      setError(denied ? "O acesso à câmera foi negado." : reason instanceof Error ? reason.message : "Não foi possível abrir a câmera.");
    }
  };

  const analyzePhoto = async (image: string) => {
    setLoading(true); setError(""); setPrediction(null);
    try {
      const element = new Image();
      element.src = image;
      await element.decode();
      const data = await localRecognizer.recognizeImage(element);
      if (!data) throw new Error("Nenhuma mão foi encontrada. Centralize uma mão aberta e tente novamente.");
      setPrediction(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "O reconhecedor está indisponível."); }
    finally { setLoading(false); }
  };

  const usePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return setError("Escolha uma imagem válida de até 8 MB.");
    stopCamera(); setError("");
    const reader = new FileReader();
    reader.onload = () => { const image = String(reader.result); setPreview(image); void analyzePhoto(image); };
    reader.readAsDataURL(file);
  };

  const closeCamera = () => { stopCamera(); setScreen("landing"); setPreview(""); setPrediction(null); setError(""); };

  if (screen === "landing") return (
    <main className="landing-page">
      <section className="hero-shell" id="inicio">
        <div className="landing-bg" />
        <nav className="landing-nav"><a className="landing-brand" href="#inicio"><img src="/brand/interlibras-mark.png" alt="" /><span>InterLibras</span></a><div className="nav-links"><a href="#como-funciona">Como funciona</a><a href="#cobertura">Letras</a></div><div className="nav-actions"><button className="nav-cta" onClick={() => void startCamera()}>Experimentar</button></div></nav>
        <div className="landing-hero">
          <div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> Reconhecimento visual de Libras</span><h1>Gestos que viram<br /><em>entendimento.</em></h1><p>Mostre uma letra em Libras para a câmera. O InterLibras identifica o sinal em tempo real, direto no navegador.</p><div className="hero-actions"><button className="hero-cta" onClick={() => void startCamera()}>Iniciar reconhecimento <ArrowRight size={20} /></button><a href="#como-funciona">Entender a tecnologia</a></div><div className="hero-proof"><span><Check size={15} /> 21 letras estáticas</span><span><ShieldCheck size={15} /> Imagens não armazenadas</span><span><Zap size={15} /> Resultado ao vivo</span></div></div>
          <div className="product-preview" aria-label="Prévia da tela de reconhecimento do InterLibras"><div className="preview-top"><span><img src="/brand/interlibras-mark.png" alt="" /> InterLibras</span><i>AO VIVO</i></div><div className="preview-camera"><Hand size={122} strokeWidth={1.15} /><div className="preview-frame" /><span>Mantenha a mão na área</span></div><div className="preview-result"><small>LETRA RECONHECIDA</small><strong>A</strong><span>98% de confiança</span></div></div>
        </div>
        <div className="hero-scroll">Explore como funciona <ArrowRight size={15} /></div>
      </section>
      <section className="light-section how-section" id="como-funciona"><div className="section-heading"><span>COMO FUNCIONA</span><h2>Da câmera à letra<br />em poucos instantes.</h2><p>Um fluxo simples, sem cadastro e sem configurações complicadas.</p></div><div className="steps-grid"><article><b>01</b><div className="step-icon"><Camera size={25} /></div><h3>Abra a câmera</h3><p>Permita o acesso e posicione sua mão dentro da área indicada.</p></article><article><b>02</b><div className="step-icon"><ScanLine size={25} /></div><h3>Faça o sinal</h3><p>O sistema analisa os pontos e o formato da mão sem salvar a imagem.</p></article><article><b>03</b><div className="step-icon"><BrainCircuit size={25} /></div><h3>Veja a letra</h3><p>A previsão aparece ao vivo com uma indicação discreta de confiança.</p></article></div></section>
      <section className="light-section coverage-section" id="cobertura"><div className="coverage-copy"><span className="section-label">COBERTURA ATUAL</span><h2>21 letras reconhecidas.</h2><p>O modelo atual é focado em sinais estáticos — aqueles identificados em uma única posição da mão.</p><div className="coverage-note"><Hand size={22} /><div><strong>Por que algumas ficam de fora?</strong><span>H, J, K, X e Z dependem de movimento. Elas exigem um modelo temporal de vídeo.</span></div></div></div><div className="alphabet-card"><div className="alphabet-head"><span>Alfabeto disponível</span><strong>21/26</strong></div><div className="alphabet-grid">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => <span key={letter} className={"HJKXZ".includes(letter) ? "pending" : "supported"}>{letter}</span>)}</div><div className="alphabet-legend"><span><i className="ok" /> Reconhecida</span><span><i /> Requer movimento</span></div></div></section>
      <section className="tech-section"><div className="section-heading"><span>TECNOLOGIA</span><h2>Leve para usar.<br />Clara para entender.</h2></div><div className="tech-grid"><article><Cpu size={24} /><strong>Visão computacional</strong><p>MediaPipe localiza 21 pontos da mão em cada captura.</p></article><article><BrainCircuit size={24} /><strong>Modelo treinado</strong><p>Random Forest identifica padrões entre os sinais estáticos.</p></article><article><Zap size={24} /><strong>IA no dispositivo</strong><p>Todo o reconhecimento acontece no navegador, sem depender de servidor.</p></article><article><LockKeyhole size={24} /><strong>Privacidade primeiro</strong><p>Os quadros são processados no dispositivo e não ficam armazenados.</p></article></div></section>
      <section className="final-cta"><img src="/brand/interlibras-mark.png" alt="" /><span>PRONTO PARA TESTAR?</span><h2>Faça um sinal.<br /><em>Descubra a letra.</em></h2><p>Funciona melhor com boa iluminação, uma mão por vez e fundo simples.</p><button className="hero-cta" onClick={() => void startCamera()}>Abrir reconhecimento <Camera size={19} /></button></section>
      <footer className="site-footer"><div className="landing-brand"><img src="/brand/interlibras-mark.png" alt="" /><span>InterLibras</span></div><p>Reconhecimento de letras em Libras com visão computacional.</p><a href="#inicio">Voltar ao topo ↑</a></footer>
    </main>
  );

  return (
    <main className="camera-screen">
      <div className="camera-viewport">
      {cameraOpen && <video ref={videoRef} className="fullscreen-video" autoPlay muted playsInline onClick={() => void videoRef.current?.play()} aria-label="Imagem ao vivo da câmera" />}
      {preview && !cameraOpen && <img className="fullscreen-photo" src={preview} alt="Foto enviada para reconhecimento" />}
      <div className="camera-shade" />
      <header className="camera-header"><button onClick={closeCamera} aria-label="Voltar"><X size={22} /></button><div><img src="/brand/interlibras-mark.png" alt="" /><span>InterLibras</span></div><span className={`camera-status ${cameraOpen ? "active" : ""}`}><i /> {cameraOpen ? "Ao vivo" : "Câmera"}</span></header>

      {cameraOpen && <><div className="camera-frame" aria-hidden="true"><i /><i /><i /><i /></div><div className="camera-hint">{liveHint}</div></>}
      {cameraStarting && <div className="camera-loading"><LoaderCircle className="spin" size={34} /><strong>Abrindo a câmera...</strong><button onClick={() => inputRef.current?.click()}><ImagePlus size={17} /> Escolher uma foto</button></div>}
      {loading && <div className="camera-loading"><LoaderCircle className="spin" size={34} /><strong>Analisando foto...</strong></div>}

      {error && !cameraOpen && <section className="camera-fallback"><div className="fallback-icon"><Camera size={28} /></div><h2>Câmera indisponível</h2><p>{error}</p><button onClick={() => void startCamera()}><RefreshCw size={18} /> Tentar novamente</button><button className="fallback-secondary" onClick={() => inputRef.current?.click()}><ImagePlus size={18} /> Escolher uma foto</button></section>}

      <input ref={inputRef} hidden type="file" accept="image/*" capture="user" onChange={(event: ChangeEvent<HTMLInputElement>) => usePhoto(event.target.files?.[0])} />

      {(prediction || cameraOpen) && <section className={`recognition-hud ${prediction ? "has-result" : ""}`}>
        {prediction ? <><span className="hud-label">Letra reconhecida</span><strong>{prediction.letter}</strong>{prediction.confidence !== null && <small>{Math.round(prediction.confidence * 100)}% de confiança</small>}</>
          : <><span className="scan-pulse" /><span className="hud-waiting">Procurando um sinal...</span></>}
      </section>}
      </div>
    </main>
  );
}
