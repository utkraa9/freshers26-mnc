const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sydxhbamuobtimsqnzyu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CkwLvVJdxPGbi5YjR9B24Q_7dMyN-To';

function clientForToken(token) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function requireOrganizer(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Unauthorized');

  const supabase = clientForToken(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('Unauthorized');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,approved')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile?.approved || !['organizer','admin'].includes(profile.role)) {
    throw new Error('Forbidden');
  }

  return { supabase, profile };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { supabase } = await requireOrganizer(req);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('expenses')
        .select('id,date,expense_name,category,amount,notes,created_at')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('expenses GET:', error);
        return res.status(500).json({ error: error.message || 'Could not load expenses' });
      }

      const expenses = (data || []).map(item => ({ ...item, expense: item.expense_name }));
      return res.status(200).json({ expenses });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const expense = String(body.expense || body.expense_name || '').trim();
      const category = String(body.category || 'Other').trim();
      const amount = Number(body.amount);
      const date = String(body.date || new Date().toISOString().slice(0, 10));
      const notes = String(body.notes || '').trim();

      if (!expense || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Enter a valid expense name and positive amount' });
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({ expense_name: expense, category, amount, date, notes })
        .select('id,date,expense_name,category,amount,notes,created_at')
        .single();

      if (error) {
        console.error('expenses POST:', error);
        return res.status(500).json({ error: error.message || 'Could not save expense' });
      }

      return res.status(201).json({ expense: { ...data, expense: data.expense_name } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error.message === 'Forbidden' ? 'Forbidden' : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return res.status(status).json({ error: message });
  }
};
