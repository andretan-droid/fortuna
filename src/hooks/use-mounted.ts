"use client";

import { useEffect, useState } from "react";

/** True only after first client paint — the mount gate for anything that would
 *  otherwise mismatch between server and client (theme, relative time, etc.). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
