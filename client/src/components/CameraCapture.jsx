import { useEffect, useRef, useState } from "react";

/* Take a photo or record a short video with the camera. Works on localhost or https. */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelRef = useRef(false);
  const [mode, setMode] = useState("photo");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("The camera needs a secure page (https or localhost) and a modern browser.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: mode === "video" })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((e) => setError(
        e.name === "NotAllowedError" ? "Camera permission was blocked. Allow it in the browser settings." : "Could not open the camera."
      ));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  function close() {
    cancelRef.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    onClose();
  }

  function takePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  function toggleRecord() {
    if (!recording) {
      const stream = streamRef.current;
      if (!stream || !window.MediaRecorder) return setError("Video recording is not supported in this browser.");
      chunksRef.current = [];
      cancelRef.current = false;
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (cancelRef.current) return;
        const type = rec.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        onCapture(new File([blob], `video-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`, { type }));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } else {
      recRef.current?.stop();
      setRecording(false);
    }
  }

  return (
    <div className="cam-box" role="dialog" aria-label="Camera">
      <video ref={videoRef} playsInline muted />
      {error && <p className="error">{error}</p>}
      <div className="cam-row">
        <button className={mode === "photo" ? "pill on" : "pill"} disabled={recording} onClick={() => setMode("photo")}>📷 Photo</button>
        <button className={mode === "video" ? "pill on" : "pill"} disabled={recording} onClick={() => setMode("video")}>🎥 Video</button>
      </div>
      <div className="cam-row">
        {mode === "photo"
          ? <button className="shutter" onClick={takePhoto} disabled={!!error} aria-label="Take photo" />
          : <button className={recording ? "shutter rec" : "shutter"} onClick={toggleRecord} disabled={!!error} aria-label={recording ? "Stop recording" : "Start recording"} />}
        <button className="pill" onClick={close}>Close</button>
      </div>
    </div>
  );
}
