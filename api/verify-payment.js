const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeTicketId() {
  return 'FR26-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment fields' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.error('verify-payment: signature mismatch for order', razorpay_order_id);
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Idempotent: only flips pending -> verified once. If the webhook already
    // did this (it can arrive before or after this callback), we just read it back.
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('registrations')
      .update({
        payment_status: 'verified',
        ticket_status: 'issued',
        ticket_id: makeTicketId(),
        razorpay_payment_id,
        verified_at: new Date().toISOString()
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('payment_status', 'pending')
      .select('ticket_id')
      .maybeSingle();

    if (updateErr) {
      console.error('verify-payment update error', updateErr);
      return res.status(500).json({ error: 'Could not confirm registration' });
    }

    if (updated) {
      return res.status(200).json({ ticket_id: updated.ticket_id });
    }

    const { data: existing } = await supabaseAdmin
      .from('registrations')
      .select('ticket_id, payment_status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (existing?.payment_status === 'verified') {
      return res.status(200).json({ ticket_id: existing.ticket_id });
    }

    return res.status(404).json({ error: 'Registration not found for this order' });
  } catch (e) {
    console.error('verify-payment error', e);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};
