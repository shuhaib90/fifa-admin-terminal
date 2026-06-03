'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { initialMatches, Match, Team } from '@/lib/data';
import { 
  Sliders, RefreshCw, Send, Plus, Award, AlertTriangle, 
  Play, Loader2, RotateCcw, XCircle, Users, BarChart3, 
  TrendingUp, Award as BadgeIcon, DollarSign, Activity, Flame, ShieldAlert, Trash2
} from 'lucide-react';

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

interface DBUser {
  id: string;
  username: string;
  createdAt: string;
  balance: number;
  profit: number;
  winRate: number;
  streak: number;
  level: string;
}

export default function AdminPage() {
  const [activeSidebar, setActiveSidebar] = useState<'markets' | 'users' | 'analytics'>('markets');
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Score Overrides State
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [homeScoreInput, setHomeScoreInput] = useState<number>(0);
  const [awayScoreInput, setAwayScoreInput] = useState<number>(0);
  const [matchStatus, setMatchStatus] = useState<'scheduled' | 'live' | 'finished'>('scheduled');
  const [matchMinute, setMatchMinute] = useState<number>(45);

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

  // Users Management State
  const [usersList, setUsersList] = useState<DBUser[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<number>(100);
  const [debitAmount, setDebitAmount] = useState<number>(100);
  const [adjustingBalance, setAdjustingBalance] = useState<boolean>(false);

  // Sync state
  const [syncingApi, setSyncingApi] = useState<boolean>(false);
  const [clearingAllPredictions, setClearingAllPredictions] = useState<boolean>(false);

  const handleClearAllPredictions = async () => {
    const confirmClear = window.confirm(
      "DANGER: Are you absolutely sure you want to DELETE ALL user prediction data?\n\nThis will wipe out all user prediction history from the database! This action cannot be undone."
    );
    if (!confirmClear) return;

    setClearingAllPredictions(true);
    try {
      const res = await fetch('/api/admin/clear-predictions', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert("All user predictions have been successfully deleted from the database!");
      } else {
        alert(`Failed to delete predictions: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setClearingAllPredictions(false);
    }
  };

  const currentMatch = matches.find(m => m.id === selectedMatchId);
  const getTeamName = (id: number) => teams.find(t => t.id === id)?.name || 'Unknown';
  const getTeamFlag = (id: number) => teams.find(t => t.id === id)?.flag_url || '🏳️';

  // Fetch matches, teams, and markets
  const fetchData = async () => {
    setLoadingData(true);
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
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoadingData(false);
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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users || []);
        if (data.users && data.users.length > 0 && !selectedUserId) {
          setSelectedUserId(data.users[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMarketsList();
  }, []);

  useEffect(() => {
    if (activeSidebar === 'users') {
      fetchUsers();
    }
  }, [activeSidebar]);

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

  // Quick Match simulator actions
  const handleQuickSimulator = async (action: 'goal_home' | 'goal_away' | 'yellow_home' | 'yellow_away' | 'red_home' | 'red_away' | 'end_match') => {
    const matchToUpdate = matches.find(m => m.id === selectedMatchId);
    if (!matchToUpdate) return;

    try {
      let nextHomeScore = homeScoreInput;
      let nextAwayScore = awayScoreInput;
      let nextStatus = matchStatus;
      let details = '';
      let type: 'goal' | 'card' | 'sub' = 'goal';

      if (action === 'goal_home') {
        nextHomeScore += 1;
        setHomeScoreInput(nextHomeScore);
        details = 'Goal for Home Team';
        type = 'goal';
      } else if (action === 'goal_away') {
        nextAwayScore += 1;
        setAwayScoreInput(nextAwayScore);
        details = 'Goal for Away Team';
        type = 'goal';
      } else if (action === 'yellow_home') {
        details = 'Yellow Card for Home Team';
        type = 'card';
      } else if (action === 'yellow_away') {
        details = 'Yellow Card for Away Team';
        type = 'card';
      } else if (action === 'red_home') {
        details = 'Red Card for Home Team';
        type = 'card';
      } else if (action === 'red_away') {
        details = 'Red Card for Away Team';
        type = 'card';
      } else if (action === 'end_match') {
        nextStatus = 'finished';
        setMatchStatus('finished');
      }

      // Log the event in matches
      const newEvent = {
        time: matchMinute,
        type,
        team_id: action.includes('home') ? matchToUpdate.home_team_id : matchToUpdate.away_team_id,
        detail: details || 'Match Simulation Update',
      };

      const updatedEvents = [...(matchToUpdate.events || []), newEvent];

      // Call API
      const res = await fetch('/api/admin/override-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatchId,
          homeScore: nextHomeScore,
          awayScore: nextAwayScore,
          status: nextStatus,
          minute: matchMinute
        })
      });
      const data = await res.json();
      if (data.success) {
        // Also update events in matches table
        await supabase
          .from('matches')
          .update({ events: updatedEvents })
          .eq('id', selectedMatchId);

        alert(`Simulation: "${details || 'Status set to Finished'}" executed!`);
        await fetchData();
        await fetchMarketsList();
      } else {
        alert(`Failed to simulate event: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Simulation failed: ${e.message}`);
    }
  };

  // Adjust User Balance form submit
  const handleAdjustBalance = async (action: 'credit' | 'debit' | 'reset', val?: number) => {
    if (!selectedUserId) return;
    setAdjustingBalance(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          action,
          amount: val || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Wallet balance successfully adjusted! New balance: ${data.newBalance.toFixed(2)} WCX`);
        await fetchUsers();
      } else {
        alert(`Failed to adjust wallet balance: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error adjusting wallet balance: ${e.message}`);
    } finally {
      setAdjustingBalance(false);
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

  // Trigger manual API Sync on main app
  const handleApiForceSync = async () => {
    setSyncingApi(true);
    try {
      const res = await fetch('/api/admin/sync');
      const data = await res.json();
      if (data.success) {
        alert(`Live Sync triggered successfully!\nMatches updated: ${data.syncStats?.matchesUpserted || 0}\nPrediction markets created: ${data.syncStats?.marketsCreated || 0}`);
        await fetchData();
        await fetchMarketsList();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error running Sync: ${e.message}`);
    } finally {
      setSyncingApi(false);
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
  const selectedUser = usersList.find(u => u.id === selectedUserId);

  // Platform Analytics computation
  const totalUsers = usersList.length || 1;
  const totalTokenSupply = usersList.reduce((sum, u) => sum + u.balance, 0);
  const totalPoolStakes = allMarkets.reduce((sum, m) => sum + Number(m.total_pool || 0), 0);
  const openMarketsCount = allMarkets.filter(m => m.status === 'open').length;
  const closedMarketsCount = allMarkets.filter(m => m.status === 'closed').length;
  const resolvedMarketsCount = allMarkets.filter(m => m.status === 'resolved').length;
  const cancelledMarketsCount = allMarkets.filter(m => m.status === 'cancelled').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-mono">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-zinc-900 border-b-4 md:border-b-0 md:border-r-4 border-black p-6 flex flex-col justify-between shrink-0 text-left">
        <div className="space-y-8">
          <div onClick={() => window.location.reload()} className="cursor-pointer">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase" style={{ textShadow: '2px 2px 0px #000' }}>
              WCX <span className="text-[#FF3366]">Terminal</span>
            </h1>
            <span className="text-[9px] text-[#B6FF3B] font-black uppercase tracking-widest block mt-1">Admin Console</span>
          </div>

          <nav className="flex flex-col gap-2">
            {[
              { id: 'markets', label: 'Market Control', icon: Sliders },
              { id: 'users', label: 'User Managers', icon: Users },
              { id: 'analytics', label: 'Platform Stats', icon: BarChart3 }
            ].map(item => {
              const isActive = activeSidebar === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSidebar(item.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    isActive 
                      ? 'bg-[#FF3366] text-white shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]' 
                      : 'bg-zinc-950 text-zinc-450 hover:text-white border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-8 border-t border-zinc-800 space-y-4 hidden md:block">
          <button 
            onClick={handleApiForceSync}
            disabled={syncingApi}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-950 border-2 border-black hover:border-[#B6FF3B] text-[10px] text-zinc-400 hover:text-[#B6FF3B] shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 font-black uppercase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingApi ? 'animate-spin' : ''}`} />
            <span>{syncingApi ? 'Syncing...' : 'Force API Sync'}</span>
          </button>
          <span className="text-[8px] text-zinc-650 font-bold block text-center uppercase">v1.2 Sandbox Settle</span>
        </div>
      </aside>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 overflow-y-auto">
        
        {/* HEADER BAR */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-zinc-900 border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_#000] text-left">
          <div>
            <h2 className="text-lg font-black text-white uppercase leading-none">
              {activeSidebar === 'markets' ? 'Markets Dashboard' : activeSidebar === 'users' ? 'User Ecosystem Controller' : 'Ecosystem Insights'}
            </h2>
            <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mt-1 block">
              {activeSidebar === 'markets' ? 'Control scores & resolve payouts' : activeSidebar === 'users' ? 'Adjust virtual credits & follow states' : 'Overall platform supply & trade volumes'}
            </span>
          </div>

          <button 
            onClick={handleApiForceSync}
            disabled={syncingApi}
            className="sm:hidden w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-950 border-2 border-black text-[10px] text-zinc-400 shadow-[2px_2px_0px_#000] font-black uppercase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingApi ? 'animate-spin' : ''}`} />
            <span>Force API Sync</span>
          </button>
        </header>

        {/* DANGER ZONE / SYSTEM ACTIONS */}
        <div className="bg-red-500/10 border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-4 text-left">
          <div>
            <h4 className="text-xs font-black text-red-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <AlertTriangle className="w-4 h-4" /> Danger Zone / Database Reset
            </h4>
            <p className="text-[10px] text-zinc-400 font-bold mt-1 max-w-xl font-mono">
              Fully erase all user predictions from the Supabase database. This will reset the prediction history of all users.
            </p>
          </div>
          <button
            onClick={handleClearAllPredictions}
            disabled={clearingAllPredictions}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white border-2 border-black font-black text-xs tracking-wider uppercase transition-all shadow-[2.5px_2.5px_0px_#000] hover:translate-x-[-1.5px] hover:translate-y-[-1.5px] hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50 font-mono"
          >
            {clearingAllPredictions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Erase All Predictions</>}
          </button>
        </div>

        {loadingData ? (
          <p className="text-center font-black animate-pulse text-zinc-400 py-24">Connecting to Database...</p>
        ) : (
          <>
            {/* VIEW 1: MARKETS CONTROL */}
            {activeSidebar === 'markets' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                
                {/* Score override simulator */}
                <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-5 shadow-[5px_5px_0px_#000]">
                  <h3 className="font-black text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-2.5 text-[#FF3366]">
                    <Sliders className="w-4.5 h-4.5" /> Score Override & Live Simulator
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Select Match Card</label>
                    <select 
                      value={selectedMatchId}
                      onChange={(e) => handleSelectMatch(parseInt(e.target.value))}
                      className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-2 text-xs text-white font-black outline-none focus:border-[#FF3366] shadow-[2px_2px_0px_#000] transition-all"
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
                      {/* Match Scoreboard inputs */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-center bg-zinc-950 p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                          <span className="text-md block">{getTeamFlag(currentMatch.home_team_id)}</span>
                          <label className="block text-[8px] font-black text-zinc-400 uppercase truncate">{getTeamName(currentMatch.home_team_id)}</label>
                          <input 
                            type="number" 
                            min="0"
                            value={homeScoreInput}
                            onChange={(e) => setHomeScoreInput(parseInt(e.target.value) || 0)}
                            className="w-12 h-9 text-center rounded-xl bg-zinc-900 border-2 border-black font-black text-white text-sm focus:border-[#FF3366] outline-none mt-1 shadow-[1.5px_1.5px_0px_#000]"
                          />
                        </div>
                        
                        <div className="space-y-1.5 text-center bg-zinc-950 p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                          <span className="text-md block">{getTeamFlag(currentMatch.away_team_id)}</span>
                          <label className="block text-[8px] font-black text-zinc-400 uppercase truncate">{getTeamName(currentMatch.away_team_id)}</label>
                          <input 
                            type="number" 
                            min="0"
                            value={awayScoreInput}
                            onChange={(e) => setAwayScoreInput(parseInt(e.target.value) || 0)}
                            className="w-12 h-9 text-center rounded-xl bg-zinc-900 border-2 border-black font-black text-white text-sm focus:border-[#FF3366] outline-none mt-1 shadow-[1.5px_1.5px_0px_#000]"
                          />
                        </div>
                      </div>

                      {/* Status select */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Match Status</label>
                          <select 
                            value={matchStatus}
                            onChange={(e) => setMatchStatus(e.target.value as any)}
                            className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-2 text-xs text-white font-black outline-none focus:border-[#FF3366] shadow-[1.5px_1.5px_0px_#000] transition-all"
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="live">Live</option>
                            <option value="finished">Finished</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Match Minute</label>
                          <input 
                            type="number" 
                            min="1"
                            max="120"
                            value={matchMinute}
                            onChange={(e) => setMatchMinute(parseInt(e.target.value) || 45)}
                            className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-1.5 text-xs font-black text-white outline-none focus:border-[#FF3366] shadow-[1.5px_1.5px_0px_#000] transition-all"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleUpdateScores}
                        className="w-full bg-[#FF3366] text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[3px_3px_0px_#000] hover:translate-x-[-1.5px] hover:translate-y-[-1.5px] hover:shadow-[4.5px_4.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Save Match Status & Score
                      </button>

                      {/* QUICK SIMULATOR PANEL */}
                      <div className="border-t border-zinc-800 pt-4 space-y-3">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Quick Simulation Actions</label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button 
                            onClick={() => handleQuickSimulator('goal_home')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-emerald-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            ⚽ +1 Home Goal
                          </button>
                          <button 
                            onClick={() => handleQuickSimulator('goal_away')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-emerald-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            ⚽ +1 Away Goal
                          </button>
                          <button 
                            onClick={() => handleQuickSimulator('yellow_home')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-yellow-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            🟨 Home Card
                          </button>
                          <button 
                            onClick={() => handleQuickSimulator('yellow_away')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-yellow-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            🟨 Away Card
                          </button>
                          <button 
                            onClick={() => handleQuickSimulator('red_home')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-red-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            🟥 Home Red Card
                          </button>
                          <button 
                            onClick={() => handleQuickSimulator('red_away')}
                            className="py-2 px-3 bg-zinc-950 border border-black hover:border-red-400 text-[10px] text-zinc-350 hover:text-white rounded-lg flex items-center justify-center gap-1 shadow transition-all uppercase font-black"
                          >
                            🟥 Away Red Card
                          </button>
                        </div>
                        <button 
                          onClick={() => handleQuickSimulator('end_match')}
                          className="w-full py-2 bg-zinc-950 border-2 border-black hover:border-[#FF3366] text-[#FF3366] hover:text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-[2px_2px_0px_#000]"
                        >
                          ⏱️ End Match (Trigger Settlements)
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Create Custom Prediction Market */}
                <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-5 shadow-[5px_5px_0px_#000]">
                  <h3 className="font-black text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-2.5 text-[#B6FF3B]">
                    <Plus className="w-4.5 h-4.5" /> Deploy Prediction Market
                  </h3>

                  <form onSubmit={handleCreateCustomMarket} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Market Question</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Will Mbappe score a header in the semi-final?"
                        value={customQuestion}
                        onChange={(e) => setCustomQuestion(e.target.value)}
                        className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2 text-xs font-black text-white outline-none focus:border-[#B6FF3B] shadow-[1.5px_1.5px_0px_#000]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Category</label>
                        <select 
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-2 text-xs text-white font-black outline-none focus:border-[#B6FF3B] shadow-[1.5px_1.5px_0px_#000] transition-all"
                        >
                          <option value="custom">Custom Specials</option>
                          <option value="player_special">Player Performance</option>
                          <option value="match_winner">Match Outcome</option>
                          <option value="total_goals">Goals</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Match Ref (Optional)</label>
                        <select 
                          value={customMatchRef}
                          onChange={(e) => setCustomMatchRef(e.target.value)}
                          className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-2 text-xs text-white font-black outline-none focus:border-[#B6FF3B] shadow-[1.5px_1.5px_0px_#000] transition-all"
                        >
                          <option value="">None / General Tournament</option>
                          {matches.map(m => (
                            <option key={m.id} value={m.id}>
                              Match #{m.id} ({getTeamName(m.home_team_id)} vs {getTeamName(m.away_team_id)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Outcomes (Comma-separated)</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Yes, No, Cancelled"
                        value={customOptionsText}
                        onChange={(e) => setCustomOptionsText(e.target.value)}
                        className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3.5 py-2 text-xs font-black text-white outline-none focus:border-[#B6FF3B] shadow-[1.5px_1.5px_0px_#000]"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={creatingMarket}
                      className="w-full bg-[#B6FF3B] text-black border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[3px_3px_0px_#000] hover:translate-x-[-1.5px] hover:translate-y-[-1.5px] hover:shadow-[4.5px_4.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {creatingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Deploy Custom Prediction</>}
                    </button>
                  </form>
                </div>

                {/* Settle & Manage prediction Markets */}
                <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-6 lg:col-span-2 shadow-[5px_5px_0px_#000]">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b-2 border-black pb-3">
                    <h3 className="font-black text-white text-xs uppercase tracking-wider flex items-center gap-2 text-yellow-450">
                      <Award className="w-4.5 h-4.5" /> Manage & Settle Predictions
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
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Select Prediction Contract</label>
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
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Choose Winning Outcome</label>
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
                                  className="bg-yellow-400 text-black border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  {settlingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-3.5 h-3.5 fill-current" /> Settle Market</>}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleCancelMarket}
                                  disabled={cancellingMarket}
                                  className="bg-red-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  {cancellingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-3.5 h-3.5" /> Cancel & Refund</>}
                                </button>
                              </div>
                            </form>
                          )}

                          {selectedMarket.status === 'resolved' && (
                            <div className="space-y-4">
                              <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl text-xs space-y-2 shadow-[2px_2px_0px_#000]">
                                <p className="font-black text-zinc-400 font-sans">RESOLUTION DETAILS</p>
                                <p className="font-bold">Winning Option UUID: <span className="text-[#B6FF3B]">{selectedMarket.resolved_option_id}</span></p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                  type="button"
                                  onClick={handleReopenMarket}
                                  disabled={reopeningMarket}
                                  className="bg-purple-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  {reopeningMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5" /> Reopen Market</>}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleCancelMarket}
                                  disabled={cancellingMarket}
                                  className="bg-red-650 text-white border-2 border-black font-black text-xs tracking-wider uppercase py-3 rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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

            {/* VIEW 2: USER MANAGEMENT */}
            {activeSidebar === 'users' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                
                {/* Search & Users list */}
                <div className="lg:col-span-1 bg-zinc-900 border-3 border-black rounded-2xl p-5 space-y-4 shadow-[4px_4px_0px_#000]">
                  <h3 className="font-black text-white text-xs uppercase tracking-wider border-b-2 border-black pb-2">Users List</h3>
                  
                  <input 
                    type="text"
                    placeholder="Search username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-black rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-[#FF3366]"
                  />

                  {loadingUsers ? (
                    <p className="text-xs text-zinc-500 animate-pulse text-center py-4">Loading users...</p>
                  ) : usersList.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">No users registered.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto no-scrollbar">
                      {usersList
                        .filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                        .map(u => (
                          <div 
                            key={u.id}
                            onClick={() => setSelectedUserId(u.id)}
                            className={`p-3 rounded-xl border-2 border-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] flex justify-between items-center ${
                              selectedUserId === u.id ? 'bg-[#FF3366] text-white' : 'bg-zinc-950 hover:bg-black'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-black uppercase">{u.username}</p>
                              <span className={`text-[8px] font-bold uppercase block mt-0.5 ${selectedUserId === u.id ? 'text-zinc-200' : 'text-zinc-550'}`}>
                                Level: {u.level} • Streak: {u.streak} 🔥
                              </span>
                            </div>
                            <span className="text-xs font-black">{u.balance.toFixed(0)} WCX</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Adjust User balances */}
                <div className="lg:col-span-2 space-y-6">
                  {selectedUser ? (
                    <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-6 shadow-[5px_5px_0px_#000]">
                      <div className="flex justify-between items-center border-b-2 border-black pb-2.5">
                        <h3 className="font-black text-white text-xs uppercase tracking-wider">
                          Adjust Wallet: <span className="text-[#FF3366]">{selectedUser.username}</span>
                        </h3>
                        <span className="text-[10px] font-black text-[#B6FF3B] uppercase">{selectedUser.balance.toFixed(2)} WCX</span>
                      </div>

                      {/* User Stats Overview */}
                      <div className="grid grid-cols-3 gap-3 text-center bg-zinc-950 p-4 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                        <div>
                          <span className="text-[8px] text-zinc-500 font-black uppercase">Net Profits</span>
                          <p className={`text-xs font-black mt-1 ${selectedUser.profit >= 0 ? 'text-[#B6FF3B]' : 'text-red-400'}`}>
                            {selectedUser.profit >= 0 ? '+' : ''}{selectedUser.profit.toFixed(0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 font-black uppercase">Rank Tier</span>
                          <p className="text-xs font-black text-white mt-1 uppercase">{selectedUser.level}</p>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 font-black uppercase">Signup Date</span>
                          <p className="text-[9px] font-bold text-zinc-400 mt-1">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Adjust Actions */}
                      <div className="space-y-4 pt-2">
                        {/* Credit */}
                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-black">
                          <div className="flex-1 text-left">
                            <span className="text-[8px] text-zinc-500 font-black uppercase block">Credit Wallet</span>
                            <p className="text-[10px] font-bold text-zinc-350">Add free tokens to user wallet</p>
                          </div>
                          <input 
                            type="number"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                            className="w-20 bg-zinc-900 border-2 border-black rounded-lg text-center font-black text-xs h-8 text-white outline-none"
                          />
                          <button 
                            onClick={() => handleAdjustBalance('credit', creditAmount)}
                            disabled={adjustingBalance}
                            className="bg-[#B6FF3B] text-black border border-black font-black text-[10px] px-3.5 h-8 rounded-lg uppercase transition-all shadow-[1.5px_1.5px_0px_#000]"
                          >
                            Credit
                          </button>
                        </div>

                        {/* Debit */}
                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-black">
                          <div className="flex-1 text-left">
                            <span className="text-[8px] text-zinc-500 font-black uppercase block">Debit Wallet</span>
                            <p className="text-[10px] font-bold text-zinc-350">Deduct tokens from user wallet</p>
                          </div>
                          <input 
                            type="number"
                            value={debitAmount}
                            onChange={(e) => setDebitAmount(parseInt(e.target.value) || 0)}
                            className="w-20 bg-zinc-900 border-2 border-black rounded-lg text-center font-black text-xs h-8 text-white outline-none"
                          />
                          <button 
                            onClick={() => handleAdjustBalance('debit', debitAmount)}
                            disabled={adjustingBalance}
                            className="bg-red-500 text-white border border-black font-black text-[10px] px-3.5 h-8 rounded-lg uppercase transition-all shadow-[1.5px_1.5px_0px_#000]"
                          >
                            Debit
                          </button>
                        </div>

                        {/* Reset Balance */}
                        <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-black">
                          <div className="text-left">
                            <span className="text-[8px] text-zinc-550 font-black uppercase block">Reset Wallet Balance</span>
                            <p className="text-[10px] font-bold text-zinc-400">Revert user credits to default 1,000</p>
                          </div>
                          <button 
                            onClick={() => handleAdjustBalance('reset')}
                            disabled={adjustingBalance}
                            className="bg-zinc-900 hover:bg-black border-2 border-black font-black text-[10px] px-4 py-1.5 rounded-lg text-zinc-300 hover:text-white uppercase transition-all shadow-[2px_2px_0px_#000]"
                          >
                            Reset to 1K
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-900 border-3 border-black rounded-2xl py-20 text-center text-zinc-500 font-bold shadow-[4px_4px_0px_#000]">
                      Select a user from the list to adjust wallet credits.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* VIEW 3: PLATFORM STATS / ANALYTICS */}
            {activeSidebar === 'analytics' && (
              <div className="space-y-6 text-left">
                
                {/* Summary Widgets Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Registered Users', val: totalUsers, icon: Users, color: 'text-indigo-400' },
                    { label: 'Circulating Tokens', val: `${totalTokenSupply.toFixed(0)} WCX`, icon: DollarSign, color: 'text-emerald-400' },
                    { label: 'Active Open Pools', val: `${totalPoolStakes.toFixed(0)} WCX`, icon: TrendingUp, color: 'text-cyan-400' },
                    { label: 'Prediction Contracts', val: allMarkets.length, icon: Activity, color: 'text-rose-400' }
                  ].map((w, idx) => (
                    <div key={idx} className="bg-zinc-900 border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_#000] space-y-2 flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest leading-none">{w.label}</span>
                        <w.icon className={`w-4 h-4 ${w.color}`} />
                      </div>
                      <p className="text-lg font-black text-white mt-1">{w.val}</p>
                    </div>
                  ))}
                </div>

                {/* Detailed Markets distribution */}
                <div className="bg-zinc-900 border-3 border-black rounded-2xl p-6 space-y-4 shadow-[5px_5px_0px_#000]">
                  <h3 className="font-black text-white text-xs uppercase tracking-wider border-b-2 border-black pb-2">Prediction Contracts Analytics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                      <span className="block font-black text-lg text-cyan-400">{openMarketsCount}</span>
                      <span className="text-[8px] text-zinc-500 font-black uppercase">Active Open</span>
                    </div>
                    <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                      <span className="block font-black text-lg text-[#FF3366]">{closedMarketsCount}</span>
                      <span className="text-[8px] text-zinc-550 font-black uppercase">Closed Pending</span>
                    </div>
                    <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                      <span className="block font-black text-lg text-emerald-400">{resolvedMarketsCount}</span>
                      <span className="text-[8px] text-zinc-500 font-black uppercase">Settled Paid</span>
                    </div>
                    <div className="bg-zinc-950 p-4 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                      <span className="block font-black text-lg text-zinc-500">{cancelledMarketsCount}</span>
                      <span className="text-[8px] text-zinc-550 font-black uppercase">Cancelled Refunded</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </main>

    </div>
  );
}
