import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const STATUS_CONFIG: Record<string, { label: string; color: string; message: string }> = {
  "In Review":  { label: "In Review",  color: "#0369a1", message: "Your request is currently being reviewed by our IT team. We'll be in touch shortly." },
  "Approved":   { label: "Approved",   color: "#15803d", message: "Great news — your asset request has been approved. Our IT team will be in contact to arrange delivery or collection." },
  "Declined":   { label: "Declined",   color: "#dc2626", message: "Unfortunately your request has been declined at this time. Please contact the IT department if you have any questions." },
  "Closed":     { label: "Closed",     color: "#78716c", message: "Your request has been closed. If you still need assistance, please feel free to submit a new request." },
};

export async function sendRequestStatusEmail(params: {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  categoryName: string;
  status: string;
  adminNotes?: string;
}) {
  const cfg = STATUS_CONFIG[params.status];
  if (!cfg) return; // Don't email for "Pending" — they already got the submission confirmation

  await resend.emails.send({
    from: `ISIBAG IT Asset Desk <${process.env.RESEND_FROM_EMAIL ?? "noreply@ustieloiru.resend.app"}>`,
    to: params.requesterEmail,
    subject: `Your Asset Request has been ${cfg.label} — ISIBAG IT Asset Desk`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <div style="border-left: 4px solid ${cfg.color}; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #1c1917;">
            Request ${cfg.label}
          </h2>
          <p style="margin: 0; font-size: 13px; color: #78716c;">ISIBAG IT Asset Desk</p>
        </div>

        <p style="font-size: 14px; color: #1c1917; margin-bottom: 8px;">Hi ${params.requesterName},</p>
        <p style="font-size: 14px; color: #44403c; line-height: 1.6; margin-bottom: 24px;">
          ${cfg.message}
        </p>

        <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
          <div style="margin-bottom: 8px;">
            <span style="color: #78716c;">Category:</span>
            <span style="margin-left: 8px; font-weight: 500;">${params.categoryName}</span>
          </div>
          <div>
            <span style="color: #78716c;">Status:</span>
            <span style="margin-left: 8px; font-weight: 600; color: ${cfg.color};">${cfg.label}</span>
          </div>
          ${params.adminNotes ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e7e5e4;">
            <span style="color: #78716c;">Note from IT:</span>
            <p style="margin: 4px 0 0; color: #1c1917;">${params.adminNotes}</p>
          </div>` : ""}
        </div>

        <p style="font-size: 12px; color: #a8a29e; margin-top: 32px;">
          This is an automated message from ISIBAG IT Asset Desk. Please do not reply to this email — contact the IT department directly if you need further assistance.
        </p>
      </div>
    `,
  });
}

export async function sendAssetRequestEmail(params: {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  categoryName: string;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const reviewUrl = `${appUrl}/requests/${params.requestId}`;

  await resend.emails.send({
    from: `ISIBAG IT Asset Desk <${process.env.RESEND_FROM_EMAIL ?? "noreply@ustieloiru.resend.app"}>`,
    to: process.env.ADMIN_EMAIL!,
    subject: `New Asset Request — ${params.categoryName} from ${params.requesterName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <div style="border-bottom: 1px solid #e7e5e4; padding-bottom: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1c1917;">New Asset Request</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #78716c;">Submitted via Asset Desk</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px 0; color: #78716c; width: 140px;">Name</td>
            <td style="padding: 8px 0; font-weight: 500;">${params.requesterName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${params.requesterEmail}" style="color: #0369a1;">${params.requesterEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #78716c;">Category</td>
            <td style="padding: 8px 0;">${params.categoryName}</td>
          </tr>
          ${params.reason ? `
          <tr>
            <td style="padding: 8px 0; color: #78716c; vertical-align: top;">Reason</td>
            <td style="padding: 8px 0;">${params.reason}</td>
          </tr>` : ""}
        </table>
        <div style="margin-top: 28px;">
          <a href="${reviewUrl}" style="display: inline-block; background: #1c1917; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;">
            Review Request →
          </a>
        </div>
        <p style="margin-top: 24px; font-size: 11px; color: #a8a29e;">
          This email was sent by Nexus · ISIBAG. Reply directly to ${params.requesterEmail} to contact the requester.
        </p>
      </div>
    `,
  });
}
