"use client";

import { useState, useTransition } from "react";
import { Copy, CheckCheck, Check, Mail } from "lucide-react";
import type { OnboardingCase } from "@/types/database";
import { markAshtonEmailSent } from "@/lib/actions";
import { useToast } from "@/components/Toast";

interface Props {
  c: OnboardingCase;
  onSent: (updates: Partial<OnboardingCase>) => void;
}

export default function AshtonPanel({ c, onSent }: Props) {
  const { error: toastError, success } = useToast();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const firstName = c.first_name ?? "[First Name]";
  const lastName  = c.last_name  ?? "[Last Name]";
  const jobTitle  = c.job_title  ?? "[Job Title]";
  const site      = c.location   ?? "[Site]";

  const template =
    `Hi Ashton,\n\nPlease create an email signature for ${firstName} ${lastName}, ${jobTitle}, ${site}.\n\nThank you,\nIT Department`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in some contexts
    }
  }

  function handleMarkSent() {
    startTransition(async () => {
      const { error } = await markAshtonEmailSent(c.id);
      if (error) { toastError(error); return; }
      success("Ashton email marked as sent");
      onSent({ ashton_email_sent_at: new Date().toISOString() });
    });
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail size={13} className="text-amber-600" />
        <span className="text-[12px] font-semibold text-amber-800 uppercase tracking-wide">
          Email Signature Request
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-amber-700">Ashton email template</span>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 transition-colors"
          >
            {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-white border border-amber-200 rounded-lg px-3.5 py-3 text-[12px] text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">
          {template}
        </pre>
      </div>

      {c.ashton_email_sent_at ? (
        <div className="flex items-center gap-2 text-[13px] text-amber-800 font-medium">
          <Check size={13} className="text-amber-600" />
          Email sent — awaiting Ashton&apos;s confirmation
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMarkSent}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-medium rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          <Check size={12} />
          {pending ? "Saving…" : "Mark Ashton email sent"}
        </button>
      )}
    </div>
  );
}
