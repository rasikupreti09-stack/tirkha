"use client";

import { useEffect, useState } from "react";
import { TirkhaMark } from "./tirkha-mark";

export function LaunchSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 1050);
    const removeTimer = window.setTimeout(() => setVisible(false), 1450);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`tirkha-launch-splash${leaving ? " is-leaving" : ""}`} role="status" aria-label="Tirkha | तिर्खा">
      <div className="tirkha-splash-glow" aria-hidden="true" />
      <div className="tirkha-splash-content">
        <span className="tirkha-splash-orbit" aria-hidden="true" />
        <TirkhaMark className="tirkha-splash-logo" />
        <span className="tirkha-splash-overline">GOOD HELP, CLOSER TO HOME</span>
        <strong className="tirkha-splash-name">Tirkha</strong>
        <span className="tirkha-splash-nepali" lang="ne">तिर्खा</span>
        <span className="tirkha-splash-rule" aria-hidden="true" />
        <span className="tirkha-splash-tagline">A little help. A better everyday.</span>
        <span className="tirkha-splash-tagline-nepali" lang="ne">सानो सहयोग, हरेक दिन अझ सहज।</span>
        <span className="tirkha-splash-loader" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}
