import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    from: `ISIBAG IT Asset Desk <${process.env.RESEND_FROM_EMAIL ?? "noreply@assetdesk.app"}>`,
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
