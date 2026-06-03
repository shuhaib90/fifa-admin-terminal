'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { initialMatches, Match, Team } from '@/lib/data';
import { Sliders, RefreshCw, Send, Plus, Award, AlertTriangle, Play, Loader2, RotateCcw, XCircle } from 'lucide-react';

interface DBMarket {
  id: string;
  question: string;
  category: string;
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  resolved_option_id: string | null;
  total_pool: number;
  options: {
    id: string;
    option_name: string;
    probability: number;
  }[];
}

export default function AdminPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);

  // Score Overrides State
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [homeScoreInput, setHomeScoreInput] = useState<number>(0);
  const [awayScoreInput, setAwayScoreInput] = useState<number>(0);
  const [matchStatus, setMatchStatus] = useState<'scheduled' | 'live' | 'finished'>('scheduled');
  const [matchMinute, setMatchMinute] = useState<number>(45);

  // New Event Forms
  const [eventType, setEventType] = useState<'goal' | 'yellow' | 'red' | 'sub'>('goal');
  const [eventTime, setEventTime] = useState<number>(15);
  const [eventDetail, setEventDetail] = useState<string>('');
  const [eventAssist, setEventAssist] = useState<string>('');
  const [eventTeamId, setEventTeamId] = useState<number>(0);

  // Create Custom Prediction Market State
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('custom');
  const [customOptionsText, setCustomOptionsText] = useState<string>('Yes, No');
  const [customMatchRef, setCustomMatchRef] = useState<string>('');
  const [creatingMarket, setCreatingMarket] = useState<boolean>(false);

  // Settle Markets State
  const [allMarkets, setAllMarkets] = useState<DBMarket[]>([]);
  const [adminMarketTab, setAdminMarketTab] = useState<'open' | 'closed' | 'resolved' | 'cancelled'>('open');
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [selectedWinningOptionId, setSelectedWinningOptionId] = useState<string>('');
  const [settlingMarket, setSettlingMarket] = useState<boolean>(false);
  const [cancellingMarket, setCancellingMarket] = useState<boolean>(false);
  const [reopeningMarket, setReopeningMarket] = useState<boolean>(false);
  const [loadingMarkets, setLoadingMarkets] = useState<boolean>(false);

  const currentMatch = matches.find(m => m.id === selectedMatchId);
  const getTeamName = (id: number) => teams.find(t => t.id === id)?.name || 'Unknown';
  const getTeamFlag = (id: number) => teams.find(t => t.id === id)?.flag_url || '🏳️';

  // Fetch matches, teams, and markets
  const fetchData = async () => {
    setLoadingMatches(true);
    try {
      const { data: matchData } = await supabase.from('matches').select('*').order('kickoff_time', { ascending: true });
      const { data: teamData } = await supabase.from('teams').select('*');
      
      setMatches(matchData || []);
      setTeams(teamData || []);

      if (matchData && matchData.length > 0 && selectedMatchId === 0) {
        setSelectedMatchId(matchData[0].id);
        setHomeScoreInput(matchData[0].home_score || 0);
        setAwayScoreInput(matchData[0].away_score || 0);
        setMatchStatus(matchData[0].status || 'scheduled');
        setMatchMinute(matchData[0].minute || 45);
        setEventTeamId(matchData[0].home_team_id);
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoadingMatches(false);
    }
  };

  const fetchMarketsList = async () => {
    setLoadingMarkets(true);
    try {
      const res = await fetch('/api/markets');
      const data = await res.json();
      if (data.success) {
        setAllMarkets(data.markets || []);
      }
    } catch (e) {
      console.error('Failed to load markets', e);
    } finally {
      setLoadingMarkets(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMarketsList();
  }, []);

  // Update selected market on tab or markets list change
  useEffect(() => {
    const tabMarkets = allMarkets.filter(m => m.status === adminMarketTab);
    if (tabMarkets.length > 0) {
      setSelectedMarketId(tabMarkets[0].id);
      if (tabMarkets[0].options && tabMarkets[0].options.length > 0) {
        setSelectedWinningOptionId(tabMarkets[0].options[0].id);
      } else {
        setSelectedWinningOptionId('');
      }
    } else {
      setSelectedMarketId('');
      setSelectedWinningOptionId('');
    }
  }, [adminMarketTab, allMarkets]);

  const handleSelectMatch = (id: number) => {
    setSelectedMatchId(id);
    const m = matches.find(match => match.id === id);
    if (m) {
      setHomeScoreInput(m.home_score || 0);
      setAwayScoreInput(m.away_score || 0);
      setMatchStatus(m.status || 'scheduled');
      setMatchMinute(m.minute || 45);
      setEventTeamId(m.home_team_id);
    }
  };

  // Sync Score overrides to database
  const handleUpdateScores = async () => {
    try {
      const res = await fetch('/api/admin/override-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatchId,
          homeScore: homeScoreInput,
          awayScore: awayScoreInput,
          status: matchStatus,
          minute: matchMinute
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.overridden.settledMarkets > 0) {
          alert(`Successfully updated scores and SETTLED ${data.overridden.settledMarkets} prediction markets!`);
        } else {
          alert(`Successfully updated scores in database for Match #${selectedMatchId}!`);
        }
        await fetchData();
        await fetchMarketsList();
      } else {
        alert(`Database sync returned error: ${data.error}`);
      }
    } catch (e) {
      alert(`Scores update failed to sync with the database.`);
    }
  };

  const handleAddEvent = async () => {
    if (!eventDetail.trim()) {
      alert("Please provide match event details!");
      return;
    }

    try {
      // Append event to JSONB array in Supabase matches
      const matchToUpdate = matches.find(m => m.id === selectedMatchId);
      if (!matchToUpdate) return;

      const newEvent = {
        time: eventTime,
        type: eventType,
        team_id: eventTeamId,
        detail: eventDetail.trim(),
        assist: eventAssist.trim() || undefined
      };

      const updatedEvents = [...(matchToUpdate.events || []), newEvent];

      // Update home/away score automatically if it's a goal
      let nextHomeScore = homeScoreInput;
      let nextAwayScore = awayScoreInput;
      if (eventType === 'goal') {
        if (eventTeamId === matchToUpdate.home_team_id) {
          nextHomeScore += 1;
          setHomeScoreInput(nextHomeScore);
        } else {
          nextAwayScore += 1;
          setAwayScoreInput(nextAwayScore);
        }
      }

      const { error } = await supabase
        .from('matches')
        .update({
          events: updatedEvents,
          home_score: nextHomeScore,
          away_score: nextAwayScore
        })
        .eq('id', selectedMatchId);

      if (error) throw error;

      alert(`Match event logged successfully!`);
      setEventDetail('');
      setEventAssist('');
      await fetchData();
    } catch (e: any) {
      alert(`Failed to log match event: ${e.message}`);
    }
  };

  // Create Custom Prediction Market
  const handleCreateCustomMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMarket(true);

    if (!customQuestion.trim()) {
      alert('Market question cannot be empty');
      setCreatingMarket(false);
      return;
    }

    const optionsList = customOptionsText
      .split(',')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (optionsList.length < 2) {
      alert('Prediction market must have at least 2 comma-separated options');
      setCreatingMarket(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/create-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: customQuestion.trim(),
          category: customCategory,
          options: optionsList,
          matchId: customMatchRef ? parseInt(customMatchRef) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Custom prediction market created successfully and live on exchange!');
        setCustomQuestion('');
        setCustomOptionsText('Yes, No');
        setCustomMatchRef('');
        await fetchMarketsList();
      } else {
        alert(`Failed to create market: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error creating market: ${err.message}`);
    } finally {
      setCreatingMarket(false);
    }
  };

  // Settle Market
  const handleSettleMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettlingMarket(true);

    if (!selectedMarketId || !selectedWinningOptionId) {
      alert('Please select a market and the winning option');
      setSettlingMarket(false);
      return;
    }

    const mkt = allMarkets.find(m => m.id === selectedMarketId);
    const opt = mkt?.options.find(o => o.id === selectedWinningOptionId);
    
    const confirmSettle = window.confirm(
      `Are you sure you want to resolve the market:\n"${mkt?.question}"\n\nWinning Outcome: "${opt?.option_name}"?\nThis will distribute tokens and payouts instantly!`
    );

    if (!confirmSettle) {
      setSettlingMarket(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/resolve-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: selectedMarketId,
          resolvedOptionId: selectedWinningOptionId
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Market settled successfully. Payouts distributed and user wallets updated!');
        await fetchMarketsList();
      } else {
        alert(`Failed to settle market: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error settling market: ${err.message}`);
    } finally {
      setSettlingMarket(false);
    }
  };

  // Cancel/Refund Market
  const handleCancelMarket = async () => {
    if (!selectedMarketId) return;

    const mkt = allMarkets.find(m => m.id === selectedMarketId);
    const confirmCancel = window.confirm(
      `CRITICAL: Are you sure you want to CANCEL the market:\n"${mkt?.question}"?\n\nThis will REFUND all stakes to user wallets immediately. This cannot be undone!`
    );

    if (!confirmCancel) return;

    setCancellingMarket(true);
    try {
      const res = await fetch('/api/admin/cancel-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: selectedMarketId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Market cancelled and all predictor stakes have been refunded!');
        await fetchMarketsList();
      } else {
        alert(`Failed to cancel market: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error cancelling market: ${e.message}`);
    } finally {
      setCancellingMarket(false);
    }
  };

  // Reopen resolved market
  const handleReopenMarket = async () => {
    if (!selectedMarketId) return;

    const mkt = allMarkets.find(m => m.id === selectedMarketId);
    const confirmReopen = window.confirm(
      `REVERT SETTLEMENT: Are you sure you want to REOPEN the market:\n"${mkt?.question}"?\n\nThis will REVERT all payouts and deduct distributed tokens from winners' wallets. Use for correcting errors!`
    );

    if (!confirmReopen) return;

    setReopeningMarket(true);
    try {
      const res = await fetch('/api/admin/reopen-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: selectedMarketId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Market successfully reopened and all payouts have been reverted.');
        await fetchMarketsList();
      } else {
        alert(`Failed to reopen market: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error reopening market: ${e.message}`);
    } finally {
      setReopeningMarket(false);
    }
  };

  const handleMarketSelectChange = (marketId: string) => {
    setSelectedMarketId(marketId);
    const mkt = allMarkets.find(m => m.id === marketId);
    if (mkt && mkt.options.length > 0) {
      setSelectedWinningOptionId(mkt.options[0].id);
    } else {
      setSelectedWinningOptionId('');
    }
  };

  const currentTabMarkets = allMarkets.filter(m => m.status === adminMarketTab);
  const selectedMarket = allMarkets.find(m => m.id === selectedMarketId);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-mono">
      
      {/* HEADER */}
      <header className="space-y-4 text-left border-b-4 border-black pb-6">
        <h1 
          className="text-4xl font-black text-white tracking-tight uppercase"
          style={{ textShadow: '3px 3px 0px #000' }}
        >
          WorldCupX <span className="text-[#FF3366]" style={{ WebkitTextStroke: '1.2px #000' }}>Admin Terminal</span>
        </h1>
        <p className="text-xs text-zinc-400 font-bold bg-zinc-900 border-2 border-black p-4 rounded-xl shadow-[3px_3px_0px_#000]">
          Centralized terminal to override matches, simulate in-play match events, launch sandbox markets, and settle prediction contracts.
        </p>
      </header>

      {loadingMatches ? (
        <p className="text-center font-black animate-pulse text-zinc-400 py-24">Connecting to Supabase Database...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          
          {/* PANEL 1: SCORE OVERRIDES */}
          <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-6 shadow-[5px_5px_0px_#000]">
            <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3 text-[#FF3366]">
              <Sliders className="w-5 h-5" /> Score Override & Live Simulator
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select Match Card</label>
              <select 
                value={selectedMatchId}
                onChange={(e) => handleSelectMatch(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-white font-black outline-none focus:border-[#FF3366] shadow-[2px_2px_0px_#000] transition-all"
              >
                {matches.map(m => (
                  <option key={m.id} value={m.id} className="bg-zinc-950 text-white">
                    Match #{m.id} ({getTeamName(m.home_team_id)} vs {getTeamName(m.away_team_id)} - Status: {String(m.status).toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {currentMatch && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-center bg-zinc-950 p-4 rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                    <span className="text-lg block">{getTeamFlag(currentMatch.home_team_id)}</span>
                    <label className="block text-[8px] font-black text-zinc-400 uppercase truncate">{getTeamName(currentMatch.home_team_id)} Score</label>
                    <input 
                      type="number" 
                      min="0"
                      value={homeScoreInput}
                      onChange={(e) => setHomeScoreInput(parseInt(e.target.value) || 0)}
                      className="w-16 h-10 text-center rounded-xl bg-zinc-900 border-2 border-black font-black text-white text-md focus:border-[#FF3366] outline-none mt-1 shadow-[2px_2px_0px_#000]"
                    />
                  </div>
                  
                  <div className="space-y-2 text-center bg-zinc-950 p-4 rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                    <span className="text-lg block">{getTeamFlag(currentMatch.away_team_id)}</span>
                    <label className="block text-[8px] font-black text-zinc-400 uppercase truncate">{getTeamName(currentMatch.away_team_id)} Score</label>
                    <input 
                      type="number" 
                      min="0"
                      value={awayScoreInput}
                      onChange={(e) => setAwayScoreInput(parseInt(e.target.value) || 0)}
                      className="w-16 h-10 text-center rounded-xl bg-zinc-900 border-2 border-black font-black text-white text-md focus:border-[#FF3366] outline-none mt-1 shadow-[2px_2px_0px_#000]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Match Status</label>
                    <select 
                      value={matchStatus}
                      onChange={(e) => setMatchStatus(e.target.value as any)}
                      className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-white font-black outline-none focus:border-[#FF3366] shadow-[2px_2px_0px_#000] transition-all"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="finished">Finished</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Match Minute (if Live)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="120"
                      value={matchMinute}
                      onChange={(e) => setMatchMinute(parseInt(e.target.value) || 45)}
                      className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2 text-xs font-black text-white outline-none focus:border-[#FF3366] shadow-[2px_2px_0px_#000] transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleUpdateScores}
                  className="w-full bg-[#FF3366] text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3.5 rounded-xl shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Save Match Status & Score
                </button>
              </>
            )}
          </div>

          {/* PANEL 2: CREATE CUSTOM PREDICTION */}
          <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-6 shadow-[5px_5px_0px_#000]">
            <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3 text-[#B6FF3B]">
              <Plus className="w-5 h-5" /> Create Sandbox Prediction Market
            </h3>

            <form onSubmit={handleCreateCustomMarket} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Market Question</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Will Lionel Messi score a goal in the tournament?"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-black text-white outline-none focus:border-[#B6FF3B] shadow-[2px_2px_0px_#000]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</label>
                  <select 
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-white font-black outline-none focus:border-[#B6FF3B] shadow-[2px_2px_0px_#000] transition-all"
                  >
                    <option value="custom">Custom Specials</option>
                    <option value="player_special">Player Performance</option>
                    <option value="match_winner">Match Outcome</option>
                    <option value="total_goals">Goals</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Match Ref (Optional)</label>
                  <select 
                    value={customMatchRef}
                    onChange={(e) => setCustomMatchRef(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-white font-black outline-none focus:border-[#B6FF3B] shadow-[2px_2px_0px_#000] transition-all"
                  >
                    <option value="">None / Tournament General</option>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>
                        Match #{m.id} ({getTeamName(m.home_team_id)} vs {getTeamName(m.away_team_id)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Outcomes (Comma-separated)</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Yes, No, Cancelled"
                  value={customOptionsText}
                  onChange={(e) => setCustomOptionsText(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-black text-white outline-none focus:border-[#B6FF3B] shadow-[2px_2px_0px_#000]"
                />
              </div>

              <button 
                type="submit"
                disabled={creatingMarket}
                className="w-full bg-[#B6FF3B] text-black border-2 border-black font-black text-xs tracking-wider uppercase py-3.5 rounded-xl shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creatingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Deploy Custom Prediction</>}
              </button>
            </form>
          </div>

          {/* PANEL 3: RESOLVE & MANAGE prediction MARKETS */}
          <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-6 lg:col-span-2 shadow-[5px_5px_0px_#000]">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b-2 border-black pb-3">
              <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2 text-yellow-400">
                <Award className="w-5 h-5" /> Manage & Settle Predictions
              </h3>
              
              <div className="flex gap-1 overflow-x-auto">
                {(['open', 'closed', 'resolved', 'cancelled'] as const).map(tabName => (
                  <button
                    key={tabName}
                    onClick={() => setAdminMarketTab(tabName)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border-2 border-black transition-all ${
                      adminMarketTab === tabName
                        ? 'bg-yellow-400 text-black shadow-[1.5px_1.5px_0px_#000]'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border-zinc-800'
                    }`}
                  >
                    {tabName}
                  </button>
                ))}
              </div>
            </div>

            {loadingMarkets ? (
              <p className="text-xs text-zinc-500 animate-pulse text-center py-6 font-bold">Loading prediction contracts...</p>
            ) : currentTabMarkets.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center border-2 border-dashed border-black rounded-xl bg-zinc-950 font-bold">
                No {adminMarketTab} prediction markets found.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select Prediction Contract</label>
                  <select 
                    value={selectedMarketId}
                    onChange={(e) => handleMarketSelectChange(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-white font-black outline-none focus:border-yellow-400 shadow-[2px_2px_0px_#000] transition-all"
                  >
                    {currentTabMarkets.map(m => (
                      <option key={m.id} value={m.id} className="bg-zinc-950 text-white">
                        [{m.category.toUpperCase()}] {m.question} (Pool: {m.total_pool.toFixed(0)} tokens)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMarket && (
                  <>
                    {(selectedMarket.status === 'open' || selectedMarket.status === 'closed') && (
                      <form onSubmit={handleSettleMarket} className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Choose Winning Outcome</label>
                          <div className="flex flex-wrap gap-3">
                            {selectedMarket.options.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedWinningOptionId(opt.id)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${
                                  selectedWinningOptionId === opt.id
                                    ? 'bg-yellow-400 text-black border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-zinc-950 border-black text-zinc-400 hover:text-white shadow-[1px_1px_0px_#000]'
                                }`}
                              >
                                {opt.option_name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            type="submit"
                            disabled={settlingMarket}
                            className="bg-yellow-400 text-black border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {settlingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-3.5 h-3.5 fill-current" /> Settle Market</>}
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelMarket}
                            disabled={cancellingMarket}
                            className="bg-red-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {cancellingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-3.5 h-3.5" /> Cancel & Refund</>}
                          </button>
                        </div>
                      </form>
                    )}

                    {selectedMarket.status === 'resolved' && (
                      <div className="space-y-4">
                        <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl text-xs space-y-2 shadow-[2px_2px_0px_#000]">
                          <p className="font-black text-zinc-400">RESOLUTION DETAILS</p>
                          <p className="font-bold">Winning Option UUID: <span className="text-[#B6FF3B]">{selectedMarket.resolved_option_id}</span></p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={handleReopenMarket}
                            disabled={reopeningMarket}
                            className="bg-purple-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {reopeningMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5" /> Reopen Market</>}
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelMarket}
                            disabled={cancellingMarket}
                            className="bg-red-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {cancellingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-3.5 h-3.5" /> Cancel & Refund</>}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedMarket.status === 'cancelled' && (
                      <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl text-center text-xs text-zinc-500 font-bold shadow-[2px_2px_0px_#000]">
                        This market was cancelled and all stakes have been fully refunded to predictors.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
