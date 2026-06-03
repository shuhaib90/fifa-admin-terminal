import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { settleMatchMarkets } from '@/lib/market-settlement';

export async function POST(request: Request) {
  try {
    const { matchId, homeScore, awayScore, status, minute } = await request.json();

    if (!matchId || status === undefined) {
      return NextResponse.json({ success: false, error: 'Invalid override parameters' }, { status: 400 });
    }

    // 1. Fetch match to get team IDs
    const { data: match, error: mktErr } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', matchId)
      .single();

    if (mktErr || !match) {
      return NextResponse.json({ success: false, error: 'Match record not found in database. Run sync first.' }, { status: 404 });
    }

    // 2. Fetch team names
    const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', match.home_team_id).single();
    const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', match.away_team_id).single();
    
    const homeName = homeTeam?.name || 'Home';
    const awayName = awayTeam?.name || 'Away';

    // 3. Upsert match override directly to public.matches
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        status,
        minute: status === 'live' ? Number(minute || 45) : null
      })
      .eq('id', matchId);

    if (updateErr) throw updateErr;

    // 4. Trigger settlement if finished
    let settledMarkets = 0;
    if (status === 'finished') {
      const { settledCount } = await settleMatchMarkets(
        Number(matchId),
        Number(homeScore),
        Number(awayScore),
        homeName,
        awayName
      );
      settledMarkets = settledCount;
    }

    return NextResponse.json({
      success: true,
      overridden: {
        matchId,
        homeScore,
        awayScore,
        status,
        settledMarkets
      }
    });

  } catch (error: any) {
    console.error('Match override settlement error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
