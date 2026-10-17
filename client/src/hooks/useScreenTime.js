import { useEffect, useRef, useState } from "react";
import api, { todayStr } from "../api/client";

// Counts seconds while the tab is VISIBLE and saves the total every minute.
export default function useScreenTime(onSaved) {
  const [seconds, setSeconds] = useState(0);
  const secRef = useRef(0);       // ref = latest value inside intervals (no stale closures)
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;

    // Seed from the server so a refresh doesn't reset today's total
    api.get(`/screentime/${todayStr()}`).then((r) => {
      if (!alive) return;
      secRef.current = r.data.totalMinutes * 60;
      setSeconds(secRef.current);
      loaded.current = true;
    });

    const tick = setInterval(() => {
      if (loaded.current && document.visibilityState === "visible") {
        secRef.current += 1;
        setSeconds(secRef.current);
      }
    }, 1000);

    const save = setInterval(() => {
      if (!loaded.current) return;
      api
        .put(`/screentime/${todayStr()}`, { totalMinutes: Math.floor(secRef.current / 60) })
        .then(() => onSaved?.())
        .catch(() => {});
    }, 60000);

    // Cleanup prevents duplicate timers and memory leaks
    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(save);
    };
  }, []);

  return seconds;
}