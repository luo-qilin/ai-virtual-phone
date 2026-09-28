"use client";

import { useEffect } from "react";

type ScreenOrientationName = "portrait" | "landscape";

function viewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

function readOrientation(width: number, height: number): ScreenOrientationName {
  if (window.matchMedia("(orientation: portrait)").matches) return "portrait";
  if (window.matchMedia("(orientation: landscape)").matches) return "landscape";
  return height >= width ? "portrait" : "landscape";
}

function isTouchPhone() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function apply() {
  const root = document.documentElement;
  const { width, height } = viewportSize();
  const orientation = readOrientation(width, height);

  root.dataset.orientation = orientation;
  root.dataset.mobile = isTouchPhone() ? "1" : "0";
  root.style.setProperty("--vv-width", `${width}px`);
  root.style.setProperty("--vv-height", `${height}px`);

  if (isTouchPhone()) {
    root.style.setProperty("--phone-screen-width", `${width}px`);
    root.style.setProperty("--phone-screen-height", `${height}px`);
  }
}

export function OrientationSync() {
  useEffect(() => {
    const sync = () => requestAnimationFrame(apply);
    apply();

    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  return null;
}
