import { useEffect, useState } from 'react';

/** Current timestamp, refreshed every `ms` — keeps countdowns and open/ended states live. */
export default function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
