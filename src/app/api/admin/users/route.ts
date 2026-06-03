import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch users joined with wallets and leaderboards
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, username, created_at');

    if (uErr) throw uErr;

    const { data: wallets } = await supabase.from('wallets').select('*');
    const { data: leaderboards } = await supabase.from('leaderboards').select('*');

    const combined = users.map(user => {
      const w = wallets?.find(wallet => wallet.user_id === user.id);
      const l = leaderboards?.find(lb => lb.user_id === user.id);

      return {
        id: user.id,
        username: user.username,
        createdAt: user.created_at,
        balance: w ? Number(w.balance) : 0,
        profit: l ? Number(l.total_profit) : 0,
        winRate: l ? Number(l.win_rate) : 0,
        streak: l ? Number(l.streak) : 0,
        level: l ? l.level : 'Bronze'
      };
    });

    return NextResponse.json({ success: true, users: combined });
  } catch (error: any) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, action, amount } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ success: false, error: 'userId and action are required' }, { status: 400 });
    }

    const { data: wallet, error: wErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (wErr || !wallet) {
      return NextResponse.json({ success: false, error: 'User wallet not found' }, { status: 404 });
    }

    const currentBal = Number(wallet.balance);
    let newBal = currentBal;

    if (action === 'credit') {
      newBal = currentBal + Number(amount || 0);
    } else if (action === 'debit') {
      newBal = Math.max(0, currentBal - Number(amount || 0));
    } else if (action === 'reset') {
      newBal = 1000.00;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid balance adjustment action' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateErr) throw updateErr;

    // Log the transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: action === 'credit' ? 'admin_credit' : action === 'debit' ? 'admin_debit' : 'admin_reset',
      amount: action === 'credit' ? Number(amount) : action === 'debit' ? -Number(amount) : (1000.00 - currentBal),
      created_at: new Date().toISOString()
    });

    // Notify the user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Wallet Balance Adjusted 💰',
      message: `An admin has ${action}ed your wallet. New balance: ${newBal.toFixed(2)} tokens.`,
      read: false
    });

    return NextResponse.json({ success: true, newBalance: newBal });
  } catch (error: any) {
    console.error('Adjust balance error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
