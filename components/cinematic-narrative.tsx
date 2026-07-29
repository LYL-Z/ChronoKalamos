"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PublishedCinematicScene } from "@/lib/game/cinematic";

type CinematicNarrativeProps = {
  scene: PublishedCinematicScene | null;
  sceneNumber: string;
  locationLabel: string;
  classificationLabel: string;
  sourceSummary: string;
  narrative: string;
};

function subscribeToSpeechSupport() {
  return () => undefined;
}

function getSpeechSupportSnapshot() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function getServerSpeechSupportSnapshot() {
  return false;
}

export function CinematicNarrative({
  scene,
  sceneNumber,
  locationLabel,
  classificationLabel,
  sourceSummary,
  narrative,
}: CinematicNarrativeProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getServerSpeechSupportSnapshot,
  );
  const [speakingEventId, setSpeakingEventId] = useState<string | null>(null);
  const speaking = speakingEventId === scene?.eventId;

  useEffect(() => {
    window.speechSynthesis?.cancel();
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [scene?.eventId]);

  function toggleVoiceLine() {
    if (!scene || !speechSupported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeakingEventId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(scene.voiceLine.text);
    utterance.lang = scene.voiceLine.language;
    utterance.rate = 0.9;
    utterance.pitch = scene.originId === "merchant" ? 0.96 : scene.originId === "craft" ? 0.9 : 1;
    utterance.onend = () => setSpeakingEventId(null);
    utterance.onerror = () => setSpeakingEventId(null);
    setSpeakingEventId(scene.eventId);
    window.speechSynthesis.speak(utterance);
  }

  if (!scene) {
    return (
      <section className="cinematic-stage cinematic-fallback" data-testid="cinematic-stage">
        <div className="cinematic-heading">
          <span>SCENE {sceneNumber} · {locationLabel}</span>
          <span>{classificationLabel} · {sourceSummary}</span>
        </div>
        <p className="narrative-lede" aria-live="polite">{narrative}</p>
      </section>
    );
  }

  return (
    <section
      className={`cinematic-stage cinematic-${scene.originId} shot-${scene.shot}`}
      data-testid="cinematic-stage"
      aria-labelledby={`cinematic-title-${scene.eventId}`}
    >
      <div className="cinematic-plate" aria-hidden="true">
        <span className="cinematic-depth cinematic-depth-far" />
        <span className="cinematic-depth cinematic-depth-mid" />
        <span className="cinematic-depth cinematic-depth-near" />
        <span className="cinematic-light" />
        <span className="cinematic-grain" />
      </div>
      <div className="cinematic-heading">
        <span>SCENE {sceneNumber} · {locationLabel}</span>
        <span>{classificationLabel} · {sourceSummary}</span>
      </div>
      <div className="cinematic-copy">
        <span className="cinematic-titlecard">CINEMATIC BEAT · {scene.shot.toUpperCase()}</span>
        <h2 id={`cinematic-title-${scene.eventId}`}>{scene.titleCard}</h2>
        <p className="cinematic-atmosphere">{scene.atmosphere}</p>
        <p className="narrative-lede" aria-live="polite">{narrative}</p>
      </div>
      <div className="cinematic-dialogue">
        <span className="dialogue-mark" aria-hidden="true">“</span>
        <blockquote>{scene.voiceLine.text}</blockquote>
        <div className="dialogue-credit">
          <span><strong>{scene.voiceLine.speaker}</strong><small>{scene.voiceLine.role} · {scene.voiceLine.classification}</small></span>
          <button
            type="button"
            className="voice-button"
            aria-pressed={speaking}
            disabled={!speechSupported}
            onClick={toggleVoiceLine}
          >
            {speaking ? "停止设备朗读" : speechSupported ? "播放设备合成台词" : "当前设备不支持朗读"}
          </button>
        </div>
        <small className="voice-disclosure">现代普通话设备合成音，仅用于无障碍与节奏预演；不是唐代语音复原，也不使用真人声纹。</small>
      </div>
      <details className="cinematic-direction">
        <summary>镜头与声音说明</summary>
        <p><strong>动态：</strong>{scene.motionCue}</p>
        <p><strong>场景声：</strong>{scene.soundscape}</p>
      </details>
    </section>
  );
}
