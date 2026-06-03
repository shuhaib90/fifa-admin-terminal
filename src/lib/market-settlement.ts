import { supabase } from './supabase';

export async function payoutMarketToWinner(marketId: string, winningOptionId: string): Promise<boolean> {
  try {
    // 1. Fetch market details
    const { data: marketRecord } = await supabase
      .from('markets')
      .select('question, total_pool')
      .eq('id', marketId)
      .single();

    const question = marketRecord?.question || 'Prediction Market';
    const totalPool = marketRecord ? Number(marketRecord.total_pool) : 0.00;

    // 2. Fetch winning option details
    const { data: winOpt } = await supabase
      .from('market_options')
      .select('option_name, shares_purchased')
      .eq('id', winningOptionId)
      .single();

    const winningOptionName = winOpt?.option_name || 'Winning Option';
    const winShares = winOpt ? Number(winOpt.shares_purchased) : 0.00;

    if (totalPool > 0 && winShares > 0) {
      // 3. Fetch all user positions for the winning option
      const { data: userPositions } = await supabase
        .from('positions')
        .select('id, user_id, shares_count, stake')
        .eq('option_id', winningOptionId)
        .gt('shares_count', 0);

      if (userPositions && userPositions.length > 0) {
        for (const pos of userPositions) {
          const shares = Number(pos.shares_count);
          const payoutAmount = Number(((shares / winShares) * totalPool).toFixed(2));

          // Update user wallet balance
          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', pos.user_id)
            .single();

          const currentBal = wallet ? Number(wallet.balance) : 0.00;
          const newBal = currentBal + payoutAmount;

          await supabase
            .from('wallets')
            .update({ balance: newBal, updated_at: new Date().toISOString() })
            .eq('user_id', pos.user_id);

          // Log Transaction
          await supabase.from('transactions').insert({
            user_id: pos.user_id,
            type: 'payout',
            amount: payoutAmount,
            market_id: marketId,
            option_id: winningOptionId,
            shares_count: shares,
            price_per_share: 1.00
          });

          // Send Notification
          await supabase.from('notifications').insert({
            user_id: pos.user_id,
            title: 'Prediction Won ✅',
            message: `You won ${payoutAmount.toFixed(2)} tokens on "${winningOptionName}" for the market: "${question}"`,
            read: false
          });

          // Update leaderboard & streak
          const profit = payoutAmount - Number(pos.stake);
          const { data: lb } = await supabase
            .from('leaderboards')
            .select('total_profit, streak')
            .eq('user_id', pos.user_id)
            .single();

          if (lb) {
            const newProfit = Number(lb.total_profit) + profit;
            const nextStreak = profit > 0 ? (lb.streak + 1) : 0;
            
            // Recalculate badge level
            let level = 'Bronze';
            if (newProfit > 1000) level = 'Silver';
            if (newProfit > 3000) level = 'Gold';
            if (newProfit > 8000) level = 'Diamond';
            if (newProfit > 20000) level = 'Legend';

            await supabase
              .from('leaderboards')
              .update({
                total_profit: newProfit,
                streak: nextStreak,
                level,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', pos.user_id);

            // Achievements checks
            const { count: payoutsCount } = await supabase
              .from('transactions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', pos.user_id)
              .eq('type', 'payout');

            const wins = payoutsCount || 0;
            if (wins >= 10) {
              await supabase.from('achievements').insert({ user_id: pos.user_id, achievement_type: '10_wins' }).select().maybeSingle();
            }
            if (wins >= 100) {
              await supabase.from('achievements').insert({ user_id: pos.user_id, achievement_type: '100_wins' }).select().maybeSingle();
            }
            if (wins >= 5 && level === 'Legend') {
              await supabase.from('achievements').insert({ user_id: pos.user_id, achievement_type: 'prediction_master' }).select().maybeSingle();
            }
          }
        }
      }

      // Notify losers
      const { data: losingPositions } = await supabase
        .from('positions')
        .select('user_id, option_id, stake')
        .eq('market_id', marketId)
        .neq('option_id', winningOptionId)
        .gt('shares_count', 0);

      if (losingPositions && losingPositions.length > 0) {
        for (const lpos of losingPositions) {
          const { data: optDetail } = await supabase
            .from('market_options')
            .select('option_name')
            .eq('id', lpos.option_id)
            .single();

          const lOptName = optDetail?.option_name || 'Your Option';

          await supabase.from('notifications').insert({
            user_id: lpos.user_id,
            title: 'Prediction Lost ❌',
            message: `Your prediction on "${lOptName}" for "${question}" lost. You lost ${Number(lpos.stake).toFixed(2)} tokens.`,
            read: false
          });
        }
      }
    }

    // 4. Create settlement log
    await supabase.from('settlements').insert({
      market_id: marketId,
      resolved_option_id: winningOptionId,
      total_payout: totalPool
    });

    // 5. Update market status
    const { error } = await supabase
      .from('markets')
      .update({
        status: 'resolved',
        resolved_option_id: winningOptionId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', marketId);

    return !error;
  } catch (e) {
    console.error(`Error in payoutMarketToWinner for market ${marketId}:`, e);
    return false;
  }
}

export async function cancelMarket(marketId: string): Promise<boolean> {
  try {
    const { data: marketRecord } = await supabase
      .from('markets')
      .select('question, status')
      .eq('id', marketId)
      .single();

    if (!marketRecord) return false;
    if (marketRecord.status === 'cancelled') return true;

    // Fetch all user positions on this market to refund
    const { data: userPositions } = await supabase
      .from('positions')
      .select('user_id, stake, option_id')
      .eq('market_id', marketId)
      .gt('shares_count', 0);

    if (userPositions && userPositions.length > 0) {
      for (const pos of userPositions) {
        const refundAmount = Number(pos.stake);
        if (refundAmount > 0) {
          // Get current wallet balance
          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', pos.user_id)
            .single();

          const currentBal = wallet ? Number(wallet.balance) : 0.00;
          await supabase
            .from('wallets')
            .update({ balance: currentBal + refundAmount, updated_at: new Date().toISOString() })
            .eq('user_id', pos.user_id);

          // Log refund transaction
          await supabase.from('transactions').insert({
            user_id: pos.user_id,
            type: 'refund',
            amount: refundAmount,
            market_id: marketId,
            option_id: pos.option_id,
            shares_count: 0,
            price_per_share: 1.00
          });

          // Notify user
          await supabase.from('notifications').insert({
            user_id: pos.user_id,
            title: 'Prediction Refunded ℹ️',
            message: `Market was cancelled. Your prediction on "${marketRecord.question}" was refunded: +${refundAmount.toFixed(2)} tokens.`,
            read: false
          });
        }
      }
    }

    // Delete positions
    await supabase.from('positions').delete().eq('market_id', marketId);

    // Update market status to cancelled
    const { error } = await supabase
      .from('markets')
      .update({
        status: 'cancelled',
        resolved_at: new Date().toISOString()
      })
      .eq('id', marketId);

    return !error;
  } catch (e) {
    console.error('Cancel market error:', e);
    return false;
  }
}

export async function reopenMarket(marketId: string): Promise<boolean> {
  try {
    const { data: marketRecord } = await supabase
      .from('markets')
      .select('question, status, resolved_option_id')
      .eq('id', marketId)
      .single();

    if (!marketRecord || marketRecord.status !== 'resolved') return false;

    // Find all payouts that occurred
    const { data: payouts } = await supabase
      .from('transactions')
      .select('user_id, amount, option_id')
      .eq('market_id', marketId)
      .eq('type', 'payout');

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        const payoutVal = Number(p.amount);

        // Deduct from wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', p.user_id)
          .single();

        const currentBal = wallet ? Number(wallet.balance) : 0.00;
        await supabase
          .from('wallets')
          .update({ balance: Math.max(0, currentBal - payoutVal), updated_at: new Date().toISOString() })
          .eq('user_id', p.user_id);

        // Add deduction log
        await supabase.from('transactions').insert({
          user_id: p.user_id,
          type: 'payout_reversal',
          amount: -payoutVal,
          market_id: marketId,
          option_id: p.option_id,
          shares_count: 0,
          price_per_share: 1.00
        });

        // Notify user
        await supabase.from('notifications').insert({
          user_id: p.user_id,
          title: 'Prediction Reopened ⚠️',
          message: `The market "${marketRecord.question}" was reopened by an admin for correction. Settle amount of ${payoutVal.toFixed(2)} tokens was reverted.`,
          read: false
        });
      }
    }

    // Delete settlements entries
    await supabase.from('settlements').delete().eq('market_id', marketId);

    // Update market status back to open
    const { error } = await supabase
      .from('markets')
      .update({
        status: 'open',
        resolved_option_id: null,
        resolved_at: null
      })
      .eq('id', marketId);

    return !error;
  } catch (e) {
    console.error('Reopen market error:', e);
    return false;
  }
}

export async function settleMatchMarkets(
  matchId: number,
  homeScore: number,
  awayScore: number,
  homeTeamName: string,
  awayTeamName: string
): Promise<{ settledCount: number }> {
  let settledCount = 0;

  // Fetch all unresolved markets for this match
  const { data: openMarkets } = await supabase
    .from('markets')
    .select('id, category, status, question')
    .eq('match_id', matchId)
    .neq('status', 'resolved');

  if (!openMarkets || openMarkets.length === 0) {
    return { settledCount };
  }

  for (const oMarket of openMarkets) {
    const { data: options } = await supabase
      .from('market_options')
      .select('id, option_name')
      .eq('market_id', oMarket.id);

    if (!options || options.length === 0) continue;

    let winningOptionId: string | null = null;

    if (oMarket.category === 'match_winner') {
      if (homeScore > awayScore) {
        winningOptionId = options.find(o => o.option_name === homeTeamName)?.id || options[0].id;
      } else if (homeScore < awayScore) {
        winningOptionId = options.find(o => o.option_name === awayTeamName)?.id || options[options.length - 1].id;
      } else {
        winningOptionId = options.find(o => o.option_name === 'Draw' || o.option_name === 'Draw?') ?.id || options[1].id;
      }
    } else if (oMarket.category === 'total_goals') {
      const totalGoals = homeScore + awayScore;
      if (totalGoals > 2.5) {
        winningOptionId = options.find(o => o.option_name.includes('Over'))?.id || options[0].id;
      } else {
        winningOptionId = options.find(o => o.option_name.includes('Under'))?.id || options[1].id;
      }
    } else if (oMarket.category === 'both_teams_score') {
      const btts = homeScore > 0 && awayScore > 0;
      if (btts) {
        winningOptionId = options.find(o => o.option_name === 'Yes')?.id || options[0].id;
      } else {
        winningOptionId = options.find(o => o.option_name === 'No')?.id || options[1].id;
      }
    } else if (oMarket.category === 'will_another_goal') {
      // If finished, check if goals > 0. If match was live and finished, it's resolved.
      // Settle "No" for another goal since match is now finished.
      winningOptionId = options.find(o => o.option_name === 'No')?.id || options[1].id;
    } else if (oMarket.category === 'next_team_score') {
      // Settle as "No More Goals" at the end of the match if open
      winningOptionId = options.find(o => o.option_name.includes('No') || o.option_name.includes('No More'))?.id || options[options.length - 1].id;
    } else if (oMarket.category === 'next_goal_scorer') {
      winningOptionId = options.find(o => o.option_name.includes('No') || o.option_name.includes('No More'))?.id || options[options.length - 1].id;
    } else if (oMarket.category === 'will_red_card') {
      // Settle red card at full time (No, unless a red card was registered in events)
      // For simplicity, default to No unless events are checkable
      winningOptionId = options.find(o => o.option_name === 'No')?.id || options[1].id;
    }

    if (winningOptionId) {
      const res = await payoutMarketToWinner(oMarket.id, winningOptionId);
      if (res) {
        settledCount++;
      }
    }
  }

  return { settledCount };
}
