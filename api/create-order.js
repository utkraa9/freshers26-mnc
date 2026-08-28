const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { registration_id } = req.body || {};
    if (!registration_id) {
      return res.status(400).json({ error: 'registration_id is required' });
    }

    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('id, category, payment_status')
      .eq('id', registration_id)
      .single();

    if (regErr || !reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.payment_status === 'verified') {
      return res.status(400).json({ error: 'This registration is already paid' });
    }

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('event_settings')
      .select('senior_fee, junior_fee, payment_name')
      .eq('id', 1)
      .single();

    if (settingsErr || !settings) {
      return res.status(500).json({ error: 'Event settings unavailable' });
    }

    const amount = reg.category === 'senior' ? settings.senior_fee : settings.junior_fee;
    if (amount == null) {
      return res.status(400).json({ error: 'The contribution amount has not been announced yet' });
    }

    // Amount for Razorpay must be in the smallest currency unit (paise)
    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: 'reg_' + reg.id,
      notes: { registration_id: reg.id, category: reg.category }
    });

    const { error: updateErr } = await supabaseAdmin
      .from('registrations')
      .update({ razorpay_order_id: order.id, amount })
      .eq('id', reg.id);

    if (updateErr) {
      console.error('create-order: failed to attach order id', updateErr);
      return res.status(500).json({ error: 'Could not start payment' });
    }

    res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      payment_name: settings.payment_name || "Freshers'26"
    });
  } catch (e) {
    console.error('create-order error', e);
    res.status(500).json({ error: 'Could not create payment order' });
  }
};
      
