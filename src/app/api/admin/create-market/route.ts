import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { question, category, options, matchId } = await request.json();

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ success: false, error: 'Question and at least 2 options are required' }, { status: 400 });
    }

    // 1. Create prediction market in database
    const { data: newMarket, error: mktErr } = await supabase
      .from('markets')
      .insert({
        match_id: matchId ? Number(matchId) : null,
        question: question.trim(),
        category: category || 'custom',
        status: 'open',
        total_pool: options.length * 100.00,
        volume: 0.00,
        participants: 0
      })
      .select('id')
      .single();

    if (mktErr || !newMarket) {
      console.error('Failed to create custom market:', mktErr);
      return NextResponse.json({ success: false, error: mktErr?.message || 'Failed to create market record' }, { status: 500 });
    }

    // 2. Create option rows with equal pricing (probability splits)
    const prob = Number((100 / options.length).toFixed(2));
    const optionInserts = options.map(name => ({
      market_id: newMarket.id,
      option_name: name.trim(),
      probability: prob,
      total_pool: 100.00,
      shares_purchased: 100.00
    }));

    const { error: optErr } = await supabase
      .from('market_options')
      .insert(optionInserts);

    if (optErr) {
      console.error('Failed to create custom options:', optErr);
      // Clean up the created market row on error
      await supabase.from('markets').delete().eq('id', newMarket.id);
      return NextResponse.json({ success: false, error: optErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      marketId: newMarket.id,
      question,
      optionsCount: options.length
    });

  } catch (error: any) {
    console.error('Admin create market error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
