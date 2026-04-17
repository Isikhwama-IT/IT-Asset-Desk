"use client";

import { useState, useEffect } from "react";
import AnimatedStatCards from "@/components/AnimatedStatCards";

type Props = Parameters<typeof AnimatedStatCards>[0];

export default function AnimatedStatCardsWrapper(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="grid grid-cols-4 gap-4 mb-8" style={{ height: 104 }} />;
  return <AnimatedStatCards {...props} />;
}
