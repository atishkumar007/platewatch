import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Upload,
  ScanLine,
  ArrowRight,
  Keyboard,
  Smartphone,
  Video,
  X,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { PageHeading, Notice, Badge } from "../components/Layout";
import { api, post, normalise } from "../services";

export default function Lookup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("image"),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [method, setMethod] = useState("image_upload"),
    [stream, setStream] = useState(null),
    [recognition, setRecognition] = useState(null),
    [number, setNumber] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const video = useRef(),
    activeStream = useRef(null),
    cameraVersion = useRef(0),
    mounted = useRef(true),
    upload = useRef(),
    mobile = useRef();
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (stream && video.current) {
      video.current.srcObject = stream;
      video.current.play().catch(() => {});
    }
  }, [stream]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cameraVersion.current++;
      activeStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  function stop() {
    cameraVersion.current++;
    activeStream.current?.getTracks().forEach((t) => t.stop());
    activeStream.current = null;
    setStream(null);
  }
  function choose(f, input) {
    if (!f) return;
    stop();
    setRecognition(null);
    setNumber("");
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("The image must be smaller than 8 MB.");
      return;
    }
    setMethod(input);
    setFile(f);
  }
  async function webcam() {
    stop();
    const version = cameraVersion.current;
    setError("");
    setRecognition(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Webcam access requires localhost or HTTPS. For a phone on LAN HTTP, use Capture with Phone Camera.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mounted.current || version !== cameraVersion.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      activeStream.current = s;
      setStream(s);
      setFile(null);
      setMethod("webcam");
    } catch (e) {
      setError(
        e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow access in browser/OS settings and try again."
          : e.message,
      );
    }
  }
  function capture() {
    const v = video.current;
    if (!v?.videoWidth) {
      setError("Wait for the camera preview to load.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob)
          choose(
            new File([blob], "webcam.jpg", { type: "image/jpeg" }),
            "webcam",
          );
      },
      "image/jpeg",
      0.9,
    );
  }
  async function recognize() {
    setBusy(true);
    setError("");
    setRecognition(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("inputMethod", method);
      const data = await api("/recognize", { method: "POST", body: form });
      setRecognition(data);
      setNumber(
        (data.candidates.find((x) => x.validFormat) || data.candidates[0])
          ?.registrationNumber || "",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function lookup(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post("/lookup", {
        registrationNumber: number,
        ...(mode === "image" && recognition
          ? { recognitionId: recognition.recognitionId }
          : { inputMethod: "manual" }),
      });
      navigate("/result", { state: result });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function switchMode(m) {
    stop();
    setMode(m);
    setNumber("");
    setRecognition(null);
    setError("");
  }
  return (
    <>
      <PageHeading
        eyebrow="RECOGNITION STATION"
        title="One plate. A clearer picture."
        description="Capture a plate or enter its number, then check your application records."
      />
      <div className="lookup-grid">
        <section className="panel">
          <div className="tabs">
            <button
              className={mode === "image" ? "active" : ""}
              onClick={() => switchMode("image")}
            >
              <ScanLine size={17} />
              Image & camera
            </button>
            <button
              className={mode === "manual" ? "active" : ""}
              onClick={() => switchMode("manual")}
            >
              <Keyboard size={17} />
              Enter manually
            </button>
          </div>
          <Notice type="error">{error}</Notice>
          {mode === "manual" ? (
            <form onSubmit={lookup} className="manual-form">
              <span className="eyebrow">DIRECT LOOKUP</span>
              <h2>Enter a registration number</h2>
              <p>
                Spaces and hyphens are removed automatically. A valid format is
                not proof of an actual registration.
              </p>
              <label>
                Registration number
                <input
                  className="plate-input"
                  value={number}
                  onChange={(e) => setNumber(normalise(e.target.value))}
                  placeholder="PB10AB1234"
                  maxLength={30}
                  required
                  autoComplete="off"
                />
              </label>
              <button disabled={busy}>
                {busy ? "Looking up…" : "Search local records"}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <>
              <div className="input-options">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => upload.current.click()}
                >
                  <Upload size={17} />
                  Upload image
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => mobile.current.click()}
                >
                  <Smartphone size={17} />
                  Capture with Phone Camera
                </button>
                <button className="secondary" disabled={busy} onClick={webcam}>
                  <Video size={17} />
                  Use Webcam
                </button>
              </div>
              <input
                ref={upload}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  choose(e.target.files[0], "image_upload");
                  e.target.value = "";
                }}
              />
              <input
                ref={mobile}
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  choose(e.target.files[0], "mobile_camera");
                  e.target.value = "";
                }}
              />
              <div className="capture-view">
                {stream ? (
                  <video ref={video} autoPlay muted playsInline />
                ) : preview ? (
                  <img src={preview} alt="Selected vehicle image" />
                ) : (
                  <div className="capture-empty">
                    <div className="scan-symbol">
                      <ScanLine size={44} />
                    </div>
                    <h3>Bring a vehicle into focus</h3>
                    <p>Choose a photo or capture a frame to get started.</p>
                    <span>JPG, PNG, WEBP · UP TO 8 MB</span>
                  </div>
                )}
                <span className="capture-tag">
                  {stream
                    ? "WEBCAM PREVIEW"
                    : file
                      ? method.replaceAll("_", " ").toUpperCase()
                      : "NO CAMERA CONNECTED"}
                </span>
              </div>
              {stream ? (
                <div className="action-row">
                  <button onClick={capture}>
                    <Camera size={17} />
                    Capture photo
                  </button>
                  <button className="secondary" onClick={stop}>
                    Close camera
                  </button>
                </div>
              ) : file ? (
                <div className="action-row">
                  <button disabled={busy} onClick={recognize}>
                    <ScanLine size={17} />
                    {busy ? "Processing…" : "Recognise plate"}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setFile(null);
                      setRecognition(null);
                      setNumber("");
                    }}
                  >
                    <X size={16} />
                    Remove
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      method === "webcam"
                        ? webcam()
                        : method === "mobile_camera"
                          ? mobile.current.click()
                          : upload.current.click()
                    }
                  >
                    <RotateCcw size={15} />
                    Retake / replace
                  </button>
                </div>
              ) : null}
              <p className="hint">
                Images are processed in memory and are not saved. Webcam
                streaming needs localhost or HTTPS; phone photo capture depends
                on browser support.
              </p>
            </>
          )}
        </section>
        <aside className="panel review-panel">
          <div className="panel-title">
            <h2>Review the reading</h2>
            <Badge>CONFIRM FIRST</Badge>
          </div>
          {mode === "manual" ? (
            <div className="review-empty">
              <Keyboard size={32} />
              <p>
                Manual entries use the same local vehicle lookup as image
                recognition.
              </p>
            </div>
          ) : recognition ? (
            <>
              <Notice>{recognition.message}</Notice>
              {recognition.annotatedImage && (
                <img
                  className="annotated"
                  src={recognition.annotatedImage}
                  alt="Plate detection annotations"
                />
              )}
              <div className="candidate-list">
                {recognition.candidates.map((c, i) => (
                  <button
                    key={i}
                    disabled={!c.registrationNumber}
                    className={
                      "candidate " +
                      (number === c.registrationNumber ? "selected" : "")
                    }
                    onClick={() => setNumber(c.registrationNumber)}
                  >
                    <strong>{c.registrationNumber || "Unreadable"}</strong>
                    <span>
                      OCR{" "}
                      {c.ocrConfidence === null
                        ? "unavailable"
                        : Math.round(c.ocrConfidence * 100) + "%"}{" "}
                      · detection {Math.round(c.detectorConfidence * 100)}%
                    </span>
                    {!c.validFormat && (
                      <small>Unsupported / uncertain format</small>
                    )}
                  </button>
                ))}
              </div>
              <form onSubmit={lookup}>
                <label>
                  Confirm or correct the registration
                  <input
                    className="plate-input"
                    value={number}
                    onChange={(e) => setNumber(normalise(e.target.value))}
                    maxLength={30}
                    required
                  />
                </label>
                <button className="wide" disabled={busy || !number}>
                  <CheckCircle2 size={17} />
                  {busy ? "Searching…" : "Confirm & look up"}
                </button>
              </form>
              <p className="hint">
                OCR confidence is an engine score, not proof of vehicle
                identity. No lookup runs until you confirm.
              </p>
            </>
          ) : (
            <div className="review-empty">
              <ScanLine size={36} />
              <h3>Waiting for recognition</h3>
              <p>
                The detected plate appears here. You can select a plate and
                correct misread characters before lookup.
              </p>
            </div>
          )}
          <div className="review-note">
            <CheckCircle2 size={18} />
            <div>
              <strong>Local records first</strong>
              <p>
                Official lookup is attempted only when no local record exists
                and an approved provider is configured.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
