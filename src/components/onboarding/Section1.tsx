"use client";

import { useState, useTransition } from "react";
import { Check, Copy, CheckCheck } from "lucide-react";
import type { OnboardingCase } from "@/types/database";
import { markHrEmailSent } from "@/lib/actions";
import { useToast } from "@/components/Toast";

interface Props {
  c: OnboardingCase;
  onComplete: (updates: Partial<OnboardingCase>) => void;
}

const HR_EMAIL_TEMPLATE = `Hi [HR Team],

We have a new employee starting at Isikhwama and require the following HR requirements to be actioned before their start date:

• Signed employment contract and offer letter
• Banking details and payroll registration
• Leave management system setup
• Copies of ID and bank documents on file
• Emergency contact information captured
• Employee handbook acknowledgement

Please confirm receipt and advise on an estimated completion date.

Kind regards,
IT Department`;

export default function Section1({ c, onComplete }: Props) {
  const { error: toastError, success } = useToast();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(HR_EMAIL_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in some contexts
    }
  }

  function handleMarkSent() {
    startTransition(async () => {
      const { error } = await markHrEmailSent(c.id);
      if (error) { toastError(error); return; }
      success("HR email marked as sent");
      onComplete({ hr_email_sent_at: new Date().toISOString() });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-stone-500">
        Send the HR requirements email, then mark it as sent to unlock the employee details section.
      </p>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">HR Email Template</span>
          <button
            type="button"
            onClick={copyTemplate}
            className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-stone-50 border border-stone-100 rounded-lg px-4 py-3.5 text-[12px] text-stone-600 whitespace-pre-wrap font-sans leading-relaxed">
          {HR_EMAIL_TEMPLATE}
        </pre>
      </div>

      {c.hr_email_sent_at ? (
        <div className="flex items-center gap-2 text-[13px] text-green-700 font-medium">
          <Check size={14} className="text-green-500" />
          HR email sent — Section 2 is now unlocked
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMarkSent}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: "#C04F28" }}
        >
          <Check size={13} />
          {pending ? "Saving…" : "Mark HR email as sent"}
        </button>
      )}
    </div>
  );
}
