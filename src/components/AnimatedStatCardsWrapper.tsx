"use client";

import dynamic from "next/dynamic";

const AnimatedStatCards = dynamic(() => import("@/components/AnimatedStatCards"), { ssr: false });

export default AnimatedStatCards;
