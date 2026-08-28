const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// We need the raw request body (byte-for-byte) to verify the webhook
// signature, so automatic JSON body parsing must be disabled.
module.exports.config = {
  api: { bodyParser: false }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function makeTicketId() {
  return 'FR26-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (!signature || signature !== expected) {
    console.error('webhook: signature mismatch');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      await supabaseAdmin
        .from('registrations')
        .update({
          payment_status: 'verified',
          ticket_status: 'issued',
          ticket_id: makeTicketId(),
          razorpay_payment_id: payment.id,
          verified_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id)
        .eq('payment_status', 'pending');
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      await supabaseAdmin
        .from('registrations')
        .update({ payment_status: 'failed' })
        .eq('razorpay_order_id', payment.order_id)
        .eq('payment_status', 'pending');
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook processing error', e);
    // Still return 200 so Razorpay doesn't endlessly retry a bug on our side;
    // check Vercel logs for the actual error.
    res.status(200).json({ ok: false });
  }
};
