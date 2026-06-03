import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Fetch all markets
    const { data: markets, error: mktErr } = await supabase
      .from('markets')
      .select('*')
      .order('created_at', { ascending: false });

    if (mktErr) throw mktErr;

    // 2. Fetch all options
    const { data: options, error: optErr } = await supabase
      .from('market_options')
      .select('*');

    if (optErr) throw optErr;

    // 3. Build combined layout
    const marketsWithDetails = markets.map(market => {
      const marketOptions = options.filter(o => o.market_id === market.id);
      
      const optionsWithPositions = marketOptions.map(opt => {
        return {
          ...opt,
          userShares: 0,
          userAvgPrice: 0,
          userStake: 0
        };
      });

      return {
        ...market,
        options: optionsWithPositions
      };
    });

    return NextResponse.json({
      success: true,
      markets: marketsWithDetails
    });

  } catch (error: any) {
    console.error('Fetch markets error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
