"use client";

import { useEffect } from "react";

function apply() {
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  document.documentElement.dataset.orientation = portrait ? "portrait" : "landscape";
}

export function OrientationSync() {
  useEffect(() => {
    apply();
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}