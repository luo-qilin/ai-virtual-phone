"use client";

import { useEffect } from "react";

type ScreenOrientationName = "portrait" | "landscape";

function readOrientation(): ScreenOrientationName {
  if (typeof window === "undefined") return "portrait";
  if (window.matchMedia("(orientation: portrait)").matches) return "portrait";
  if (window.matchMedia("(orientation: landscape)").matches) return "landscape";
  return window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
}

function applyOrientation(orientation: ScreenOrientationName) {
  const root = document.documentElement;
  root.dataset.orientation = orientation;
  root.style.setProperty("--vv-width", `${window.innerWidth}px`);
  root.style.setProperty("--vv-height", `${window.innerHeight}px`);
}

export function OrientationSync() {
  useEffect(() => {
    const sync = () => {
      requestAnimationFrame(() => applyOrientation(readOrientation()));
    };

    applyOrientation(readOrientation());

    const portraitMQ = window.matchMedia("(orientation: portrait)");
    portraitMQ.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.visualViewport?.addEventListener("resize", sync);

    return () => {
      portraitMQ.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  return null;
}