const crypto = require('crypto');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const hashField = (v) => {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  return s ? sha256(s) : undefined;
};

const hashPhone = (v) => {
  if (v == null) return undefined;
  const digits = String(v).replace(/\D/g, '');
  if (!digits) return undefined;
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  return sha256(normalized);
};

const pick = (obj, keys) => {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

exports.handler = async (event) => {
  const {
    META_PIXEL_ID,
    META_CAPI_ACCESS_TOKEN,
    TAVE_WEBHOOK_SECRET,
    META_TEST_EVENT_CODE,
  } = process.env;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN || !TAVE_WEBHOOK_SECRET) {
    console.log('Missing required env var(s)');
    return { statusCode: 500, body: 'Server misconfigured' };
  }

  const qs = event.queryStringParameters || {};
  const providedSecret =
    qs.secret ||
    event.headers['x-webhook-secret'] ||
    event.headers['X-Webhook-Secret'];
  if (providedSecret !== TAVE_WEBHOOK_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const contentType = (event.headers['content-type'] || '').toLowerCase();
  let payload = {};
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      payload = Object.fromEntries(new URLSearchParams(event.body || ''));
    } else {
      payload = JSON.parse(event.body || '{}');
    }
  } catch (e) {
    console.log('Body parse failed; raw body:', event.body);
  }

  console.log('Táve webhook payload:', JSON.stringify(payload));

  const lead = payload.lead || payload.client || payload.contact || payload;
  const email = pick(lead, ['email', 'email_address', 'emailAddress']);
  const phone = pick(lead, ['phone', 'phone_number', 'phoneNumber', 'mobile']);
  const firstName = pick(lead, ['first_name', 'firstName', 'fname']);
  const lastName = pick(lead, ['last_name', 'lastName', 'lname']);

  const explicitId = pick(lead, ['id', 'lead_id', 'leadId']) || pick(payload, ['id', 'lead_id', 'leadId']);
  const eventId = explicitId
    ? String(explicitId)
    : `lead_${sha256(JSON.stringify({ email, phone, firstName, lastName })).slice(0, 24)}`;

  const userData = {};
  const em = hashField(email);
  const ph = hashPhone(phone);
  const fn = hashField(firstName);
  const ln = hashField(lastName);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (ip) userData.client_ip_address = ip;
  const ua = event.headers['user-agent'];
  if (ua) userData.client_user_agent = ua;

  if (!em && !ph && !fn && !ln) {
    console.log('No PII in payload; refusing to send empty Lead event');
    return { statusCode: 400, body: 'No usable lead fields in payload' };
  }

  const capiBody = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: String(eventId),
        event_source_url: 'https://michaelsilvano.com/',
        action_source: 'website',
        user_data: userData,
      },
    ],
  };
  if (META_TEST_EVENT_CODE) capiBody.test_event_code = META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiBody),
    });
    const metaResult = await res.json();
    if (!res.ok) {
      console.log('Meta CAPI error:', res.status, JSON.stringify(metaResult));
      return { statusCode: 502, body: JSON.stringify(metaResult) };
    }
    console.log('Meta CAPI success:', JSON.stringify({ event_id: eventId, meta: metaResult }));
    return { statusCode: 200, body: JSON.stringify({ ok: true, event_id: eventId }) };
  } catch (e) {
    console.log('Meta CAPI request failed:', e.message);
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};
