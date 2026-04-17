"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type React from "react";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || target === 0) { setValue(target); return; }
    started.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return value;
}

interface StatCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub: string;
  accent: string;
  iconBg: string;
}

function StatCard({ card }: { card: StatCard }) {
  const count = useCountUp(card.value);

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.10)", transition: { duration: 0.2 } }}
      className="bg-white rounded-xl border border-stone-200 p-5 overflow-hidden relative cursor-default"
      style={{ borderLeft: `3px solid ${card.accent}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.iconBg }}>
          {card.icon}
        </div>
      </div>
      <p
        className="text-3xl font-semibold mb-1 tabular-nums"
        style={{ letterSpacing: "-0.04em", color: card.accent }}
      >
        {count}
      </p>
      <p className="text-[13px] font-medium" style={{ color: "#414042" }}>{card.label}</p>
      <p className="text-[11px] text-stone-400 mt-0.5">{card.sub}</p>
    </motion.div>
  );
}

export default function AnimatedStatCards({ cards }: { cards: StatCard[] }) {
  return (
    <motion.div
      className="grid grid-cols-4 gap-4 mb-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card) => (
        <StatCard key={card.label} card={card} />
      ))}
    </motion.div>
  );
}
