import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { settleMatchMarkets } from '@/lib/market-settlement';
import { broadcastTelegramNotification } from '@/lib/telegram-notifier';
import { broadcastPushNotification } from '@/lib/push-notifier';

export async function POST(request: Request) {
  try {
    const { matchId, homeScore, awayScore, status, minute } = await request.json();

    if (!matchId || status === undefined) {
      return NextResponse.json({ success: false, error: 'Invalid override parameters' }, { status: 400 });
    }

    // 1. Fetch CURRENT match state BEFORE update (to diff for notifications)
    const { data: match, error: mktErr } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_score, away_score, status, minute')
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

    // Snapshot old state for diffing
    const oldStatus = match.status;
    const oldHomeScore = Number(match.home_score || 0);
    const oldAwayScore = Number(match.away_score || 0);

    const newHomeScore = Number(homeScore);
    const newAwayScore = Number(awayScore);

    // 3. Upsert match override directly to public.matches
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        home_score: newHomeScore,
        away_score: newAwayScore,
        status,
        minute: status === 'live' ? Number(minute || 45) : null
      })
      .eq('id', matchId);

    if (updateErr) throw updateErr;

    // 4. Fire Telegram & PWA notifications based on state changes (async, non-blocking)
    (async () => {
      try {
        const minText = minute ? ` - ${minute}'` : '';

        // 4a. Kickoff alert: scheduled/timed → live
        if (oldStatus !== 'live' && status === 'live') {
          const msg = `🏁 *MATCH STARTED!*\n\n*${homeName}* vs *${awayName}* is now live!\n\nFollow the action and predict outcomes on WorldCupX.`;
          await broadcastTelegramNotification(msg);
          await broadcastPushNotification(
            `🔴 LIVE NOW`,
            `${homeName} vs ${awayName}\nKickoff has started.`,
            'match_alerts',
            { url: `/matches?id=${matchId}`, matchId }
          );
        }

        // 4b. Goal alert: home score increased
        if (status === 'live' && newHomeScore > oldHomeScore) {
          const diff = newHomeScore - oldHomeScore;
          const scorerText = diff > 1 ? `(${diff} Goals)` : '';
          const msg = `⚽ *GOAL ALERT!*\n\n*${homeName}* score! ${scorerText}\n\n*${homeName}* *${newHomeScore}* - ${newAwayScore} *${awayName}*${minText}`;
          await broadcastTelegramNotification(msg);
          await broadcastPushNotification(
            `⚽ GOAL!`,
            `${homeName} ${newHomeScore} - ${newAwayScore} ${awayName}${minText}`,
            'goal_alerts',
            { url: `/matches?id=${matchId}`, matchId }
          );
        }

        // 4c. Goal alert: away score increased
        if (status === 'live' && newAwayScore > oldAwayScore) {
          const diff = newAwayScore - oldAwayScore;
          const scorerText = diff > 1 ? `(${diff} Goals)` : '';
          const msg = `⚽ *GOAL ALERT!*\n\n*${awayName}* score! ${scorerText}\n\n*${homeName}* ${newHomeScore} - *${newAwayScore}* *${awayName}*${minText}`;
          await broadcastTelegramNotification(msg);
          await broadcastPushNotification(
            `⚽ GOAL!`,
            `${homeName} ${newHomeScore} - ${newAwayScore} ${awayName}${minText}`,
            'goal_alerts',
            { url: `/matches?id=${matchId}`, matchId }
          );
        }

        // 4d. Full-time alert: any state → finished
        if (oldStatus !== 'finished' && status === 'finished') {
          const msg = `🏁 *MATCH FINISHED!*\n\n*${homeName}* *${newHomeScore}* - *${newAwayScore}* *${awayName}*\n\nAll markets for this match are being settled now. Check your portfolio!`;
          await broadcastTelegramNotification(msg);
          await broadcastPushNotification(
            `🏁 FULL TIME`,
            `${homeName} ${newHomeScore} - ${newAwayScore} ${awayName}\nMatch finished.`,
            'match_alerts',
            { url: `/matches?id=${matchId}`, matchId }
          );
        }
      } catch (notifErr) {
        console.error('Match override notification error (non-fatal):', notifErr);
      }
    })();

    // 5. Trigger settlement if finished
    let settledMarkets = 0;
    if (status === 'finished') {
      const { settledCount } = await settleMatchMarkets(
        Number(matchId),
        newHomeScore,
        newAwayScore,
        homeName,
        awayName
      );
      settledMarkets = settledCount;
    }

    return NextResponse.json({
      success: true,
      overridden: {
        matchId,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        status,
        settledMarkets
      }
    });

  } catch (error: any) {
    console.error('Match override settlement error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
