import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { payoutMarketToWinner } from '@/lib/market-settlement';

export async function POST(request: Request) {
  try {
    const { marketId, resolvedOptionId } = await request.json();

    if (!marketId || !resolvedOptionId) {
      return NextResponse.json({ success: false, error: 'marketId and resolvedOptionId are required' }, { status: 400 });
    }

    // 1. Fetch market details
    const { data: market, error: mktErr } = await supabase
      .from('markets')
      .select('id, question, status')
      .eq('id', marketId)
      .single();

    if (mktErr || !market) {
      return NextResponse.json({ success: false, error: 'Prediction market not found' }, { status: 404 });
    }

    if (market.status === 'resolved') {
      return NextResponse.json({ success: false, error: 'Market has already been resolved' }, { status: 400 });
    }

    // 2. Perform payout distribution
    console.log(`Admin resolving market ${marketId} to option ${resolvedOptionId}`);
    const payoutSuccess = await payoutMarketToWinner(marketId, resolvedOptionId);

    if (!payoutSuccess) {
      return NextResponse.json({ success: false, error: 'Failed to execute payouts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      resolved: {
        marketId,
        resolvedOptionId
      }
    });

  } catch (error: any) {
    console.error('Admin resolve market error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
