/**
 * SNMP_POLL_ENABLED — true only when NEXT_PUBLIC_SNMP_POLL=true is set.
 * Add that line to .env.local for localhost. Never set it on Vercel.
 */
export const SNMP_POLL_ENABLED = process.env.NEXT_PUBLIC_SNMP_POLL === "true";
