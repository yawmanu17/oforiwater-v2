const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oforiwater-v2.vercel.app';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'OFORI Water <onboarding@resend.dev>';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return json({ ok: true });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body = await req.json();

    const { email, fullName, role, utilityName } = body;

    if (!RESEND_API_KEY) {
      return json({ error: 'Missing RESEND_API_KEY' }, 500);
    }

    if (!email || !role || !utilityName) {
      return json({ error: 'Email, role, and utility name are required.' }, 400);
    }

    const roleLabel = formatRole(role);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:620px;margin:auto;">
        <div style="background:#0e7490;color:#ffffff;padding:18px 22px;border-radius:14px 14px 0 0;">
          <h2 style="margin:0;">OFORI Water Platform Invitation</h2>
        </div>

        <div style="border:1px solid #dbeafe;border-top:0;padding:22px;border-radius:0 0 14px 14px;">
          <p>Hello ${escapeHtml(fullName || email)},</p>

          <p>
            You have been invited to join <strong>${escapeHtml(utilityName)}</strong>
            on the OFORI Water Platform.
          </p>

          <p>Assigned role: <strong>${escapeHtml(roleLabel)}</strong></p>

          <p>
            Please create your account using this exact email address:
            <strong>${escapeHtml(email)}</strong>
          </p>

          <p style="margin:26px 0;">
            <a href="${APP_URL}" style="background:#0e7490;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">
              Open OFORI Water Platform
            </a>
          </p>

          <p>
            After signup, your utility access and role permissions will be applied automatically.
          </p>

          <p style="font-size:12px;color:#64748b;margin-top:24px;">
            If you were not expecting this invitation, you can ignore this email.
          </p>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Invitation to ${utilityName} on OFORI Water Platform`,
        html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return json({ error: result }, response.status);
    }

    return json({
      ok: true,
      id: result.id
    });
  } catch (error) {
    return json({ error: error.message || 'Invite email failed.' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  });
}

function formatRole(role: string) {
  const labels: Record<string, string> = {
    admin: 'Admin',
    supervisor: 'Supervisor',
    meter_reader: 'Meter Reader',
    billing: 'Billing',
    nrw_analyst: 'NRW Analyst'
  };

  return labels[role] || role;
}

function escapeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char] || char));
}