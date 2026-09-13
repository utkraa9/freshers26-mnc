const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireOrganizer(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Unauthorized');

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id,role,approved')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile?.approved || !['organizer','admin'].includes(profile.role)) {
    throw new Error('Forbidden');
  }

  return profile;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await requireOrganizer(req);

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('expenses')
        .select('id,date,expense,category,amount,notes,created_at')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('expenses GET:', error);
        return res.status(500).json({ error: 'Could not load expenses' });
      }
      return res.status(200).json({ expenses: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const expense = String(body.expense || '').trim();
      const category = String(body.category || 'Other').trim();
      const amount = Number(body.amount);
      const date = String(body.date || new Date().toISOString().slice(0,10));
      const notes = String(body.notes || '').trim();

      if (!expense || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Enter a valid expense name and positive amount' });
      }

      const { data, error } = await supabaseAdmin
        .from('expenses')
        .insert({ expense, category, amount, date, notes })
        .select('id,date,expense,category,amount,notes,created_at')
        .single();

      if (error) {
        console.error('expenses POST:', error);
        return res.status(500).json({ error: 'Could not save expense' });
      }
      return res.status(201).json({ expense: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error.message === 'Forbidden' ? 'Forbidden' : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return res.status(status).json({ error: message });
  }
};
