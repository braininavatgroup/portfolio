"use client";

import { useEffect } from "react";
import { installPageErrorBeacon } from "../lib/page-error-beacon";

export function PageErrorBeacon() {
  useEffect(() => installPageErrorBeacon(), []);
  return null;
}
