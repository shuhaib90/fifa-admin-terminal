import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    console.log("Starting full database purge of prediction markets and user predictions...");

    // Delete in dependency order
    await supabase.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('market_comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('market_options').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('markets').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Also reset wallet balances back to 1000.00 to make the ecosystem completely fresh
    await supabase.from('wallets').update({ balance: 1000.00 }).neq('user_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('leaderboards').update({ total_profit: 0.00, roi: 0.00, win_rate: 0.00, streak: 0, level: 'Bronze' }).neq('user_id', '00000000-0000-0000-0000-000000000000');

    console.log("Database successfully purged!");
    return NextResponse.json({ success: true, message: 'All live prediction markets, options, transactions, and predictions successfully deleted' });
  } catch (error: any) {
    console.error('Admin clear predictions/markets error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
