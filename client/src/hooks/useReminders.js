import { useEffect, useState } from "react";

// Fires a browser notification and sets `reminder` ("water" | "posture") for the UI banner.
export default function useReminders(goals) {
  const [reminder, setReminder] = useState(null);


  useEffect(() => {
    if (!goals) return;

    const fire = (type, title) => {
      setReminder(type);
    };

    const posture = setInterval(() => fire("posture", "Check your posture 🧍"), goals.postureIntervalMin * 60000);
    const water = setInterval(() => fire("water", "Time for a glass of water 💧"), goals.hydrationIntervalMin * 60000);

    return () => {
      clearInterval(posture);
      clearInterval(water);
    };
  }, [goals?.postureIntervalMin, goals?.hydrationIntervalMin]);

  return { reminder, clearReminder: () => setReminder(null) };
}