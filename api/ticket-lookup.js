const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanQuery(value) {
  return String(value || '').trim().replace(/[%_]/g, '').slice(0, 120);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = cleanQuery(req.query?.q);
  if (!q) return res.status(400).json({ error: 'Missing lookup query' });

  try {
    const pattern = `%${q}%`;
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select('name,roll_number,category,amount,payment_status,ticket_status,ticket_id,ticket_qr_token')
      .or(`ticket_id.ilike.${pattern},roll_number.ilike.${pattern},name.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('ticket-lookup query error:', error);
      return res.status(500).json({ error: 'Verification service error' });
    }

    if (!data?.length) return res.status(404).json({ error: 'Registration not found' });

    const row = data[0];
    return res.status(200).json({
      name: row.name || '',
      roll_number: row.roll_number || '',
      category: row.category || '',
      amount: row.amount ?? null,
      payment_status: row.payment_status || 'pending',
      ticket_status: row.ticket_status || '',
      ticket_id: row.ticket_id || '',
      ticket_qr_token: row.ticket_qr_token || ''
    });
  } catch (error) {
    console.error('ticket-lookup error:', error);
    return res.status(500).json({ error: 'Verification service error' });
  }
};
