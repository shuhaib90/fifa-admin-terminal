import { supabase } from './supabase';
import { sendPushNotification, broadcastPushNotification } from './push-notifier';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8724991357:AAFrAXnLnqwoI8eAZtxYuSza1mSdv8f2tvM';
const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Sends a Telegram notification to a specific user if they have a linked Telegram account and have preferences enabled.
 */
export async function sendTelegramNotification(
  userId: string,
  titleOrMessage: string,
  message?: string,
  category: 'match_alerts' | 'goal_alerts' | 'prediction_alerts' | 'settlement_alerts' | 'community_alerts' | 'daily_digest' = 'settlement_alerts',
  metadata: any = {},
  inlineKeyboard: any = null
): Promise<{ success: boolean; reason?: string }> {
  try {
    // 0. Trigger PWA push notifications in the background (independent of Telegram connectivity)
    try {
      const pushTitle = message ? titleOrMessage : 'WorldCupX Alert';
      const pushBody = message ? message : titleOrMessage;
      const cleanTitle = pushTitle.replace(/\*/g, '');
      const cleanBody = pushBody.replace(/\*/g, '');

      sendPushNotification(userId, cleanTitle, cleanBody, category, metadata).catch((err) => {
        console.error('Error sending PWA push notification from Telegram trigger:', err);
      });
    } catch (pushErr) {
      console.error('PWA push trigger error:', pushErr);
    }

    // 1. Get user's Telegram connection
    const { data: connection, error: connErr } = await supabase
      .from('telegram_connections')
      .select('telegram_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (connErr || !connection) {
      return { success: false, reason: 'User does not have a linked Telegram account' };
    }

    const telegramId = connection.telegram_id;

    // 2. Fetch user's notification preferences (create if missing)
    let { data: prefs, error: prefsErr } = await supabase
      .from('telegram_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsErr) {
      console.error('Error fetching telegram preferences:', prefsErr);
    }

    if (!prefs) {
      const { data: newPrefs, error: insertErr } = await supabase
        .from('telegram_preferences')
        .insert({
          user_id: userId,
          match_alerts: true,
          goal_alerts: 'all',
          prediction_alerts: true,
          settlement_alerts: true,
          favorite_team_alerts: true,
          community_alerts: true,
          daily_digest: true
        })
        .select()
        .single();
      
      if (insertErr) {
        console.error('Error creating default preferences:', insertErr);
      }
      prefs = newPrefs || {
        match_alerts: true,
        goal_alerts: 'all',
        prediction_alerts: true,
        settlement_alerts: true,
        favorite_team_alerts: true,
        community_alerts: true,
        daily_digest: true
      };
    }

    let finalTitle = 'WorldCupX Notification';
    let finalMessage = titleOrMessage;
    let finalCategory = category;

    if (message) {
      finalTitle = titleOrMessage;
      finalMessage = message;
    } else {
      finalMessage = titleOrMessage;
      if (titleOrMessage.includes('GOAL')) {
        finalCategory = 'goal_alerts';
      } else if (titleOrMessage.includes('Won') || titleOrMessage.includes('Lost') || titleOrMessage.includes('Settled') || titleOrMessage.includes('payout')) {
        finalCategory = 'settlement_alerts';
      } else if (titleOrMessage.includes('Match') || titleOrMessage.includes('kicks off') || titleOrMessage.includes('LIVE')) {
        finalCategory = 'match_alerts';
      } else {
        finalCategory = 'settlement_alerts';
      }
    }

    // 3. Verify category preferences
    let isAllowed = true;

    if (finalCategory === 'match_alerts' && !prefs.match_alerts) isAllowed = false;
    else if (finalCategory === 'prediction_alerts' && !prefs.prediction_alerts) isAllowed = false;
    else if (finalCategory === 'settlement_alerts' && !prefs.settlement_alerts) isAllowed = false;
    else if (finalCategory === 'community_alerts' && !prefs.community_alerts) isAllowed = false;
    else if (finalCategory === 'daily_digest' && !prefs.daily_digest) isAllowed = false;
    else if (finalCategory === 'goal_alerts') {
      const mode = prefs.goal_alerts;
      if (mode === 'disabled') {
        isAllowed = false;
      } else if (mode === 'favorites') {
        const matchId = metadata.matchId;
        if (!matchId) {
          isAllowed = false;
        } else {
          const { data: match } = await supabase
            .from('matches')
            .select('home_team_id, away_team_id')
            .eq('id', matchId)
            .maybeSingle();

          const favorites = prefs.favorite_teams || [];
          if (match && favorites.length > 0) {
            const hasFavorite = favorites.includes(match.home_team_id) || favorites.includes(match.away_team_id);
            if (!hasFavorite) {
              isAllowed = false;
            }
          } else {
            isAllowed = false;
          }
        }
      }
    }

    if (isAllowed && prefs.favorite_team_alerts && metadata.matchId && (finalCategory === 'match_alerts' || finalCategory === 'settlement_alerts')) {
      const { data: match } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('id', metadata.matchId)
        .maybeSingle();

      const favorites = prefs.favorite_teams || [];
      if (match && favorites.length > 0) {
        const isFavMatch = favorites.includes(match.home_team_id) || favorites.includes(match.away_team_id);
        metadata.isFavorite = isFavMatch;
      }
    }

    if (!isAllowed) {
      return { success: false, reason: `Muted by user preferences (${finalCategory})` };
    }

    // 4. Create Notification Record in DB (pending state)
    const { data: dbNotif, error: notifErr } = await supabase
      .from('telegram_notifications')
      .insert({
        user_id: userId,
        category: finalCategory,
        title: finalTitle,
        message: finalMessage,
        metadata,
        status: 'pending'
      })
      .select()
      .single();

    if (notifErr || !dbNotif) {
      throw notifErr || new Error('Failed to create db notification');
    }

    // 5. Send message directly to Telegram Bot API
    const body: any = {
      chat_id: telegramId,
      text: message ? `*${titleOrMessage}*\n\n${message}` : titleOrMessage,
      parse_mode: 'Markdown'
    };

    if (inlineKeyboard) {
      body.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    const tgRes = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const tgResult = await tgRes.json();

    if (tgRes.ok && tgResult.ok) {
      await supabase
        .from('telegram_notifications')
        .update({ status: 'delivered', sent_at: new Date().toISOString() })
        .eq('id', dbNotif.id);

      await supabase
        .from('telegram_delivery_logs')
        .insert({
          telegram_id: telegramId,
          notification_id: dbNotif.id,
          status: 'success'
        });

      return { success: true };
    } else {
      const errorMsg = tgResult.description || `HTTP Status ${tgRes.status}`;
      await supabase
        .from('telegram_notifications')
        .update({ status: 'failed' })
        .eq('id', dbNotif.id);

      await supabase
        .from('telegram_delivery_logs')
        .insert({
          telegram_id: telegramId,
          notification_id: dbNotif.id,
          status: 'failed',
          error_message: errorMsg
        });

      return { success: false, reason: `Telegram API error: ${errorMsg}` };
    }
  } catch (err: any) {
    console.error('Error sending telegram notification:', err);
    return { success: false, reason: err.message || 'Internal error' };
  }
}

/**
 * Broadcasts a Telegram notification to all linked Telegram accounts.
 */
export async function broadcastTelegramNotification(
  categoryOrMessage: string,
  title?: string,
  message?: string,
  metadata: any = {},
  inlineKeyboard: any = null
) {
  try {
    // 0. Trigger PWA push broadcast in background
    try {
      const pushTitle = title || 'WorldCupX Alert';
      const pushBody = message || categoryOrMessage;
      const cleanTitle = pushTitle.replace(/\*/g, '');
      const cleanBody = pushBody.replace(/\*/g, '');
      const pushCategory = message ? (categoryOrMessage || 'match_alerts') : 'match_alerts';

      broadcastPushNotification(cleanTitle, cleanBody, pushCategory, metadata).catch((err) => {
        console.error('Error sending PWA push broadcast:', err);
      });
    } catch (pushErr) {
      console.error('PWA push broadcast trigger error:', pushErr);
    }

    const { data: connections, error } = await supabase
      .from('telegram_connections')
      .select('user_id');

    if (error || !connections || connections.length === 0) return;

    let finalCategory: 'match_alerts' | 'prediction_alerts' | 'community_alerts' = 'match_alerts';
    let finalTitle = title || 'WorldCupX Alert';
    let finalMessage = message;

    if (!message) {
      finalMessage = categoryOrMessage;
      if (categoryOrMessage.includes('GOAL') || categoryOrMessage.includes('⚽')) {
        finalCategory = 'match_alerts';
      } else if (categoryOrMessage.includes('Market') || categoryOrMessage.includes('Predict')) {
        finalCategory = 'prediction_alerts';
      }
    } else {
      finalCategory = categoryOrMessage as any;
    }

    for (const conn of connections) {
      await sendTelegramNotification(
        conn.user_id,
        finalTitle,
        finalMessage,
        finalCategory,
        metadata,
        inlineKeyboard
      );
    }
  } catch (err) {
    console.error('Error broadcasting telegram notification:', err);
  }
}

/**
 * Helper to make the HTTP POST request to the Telegram Bot API sendMessage endpoint (raw send).
 */
export async function sendRawTelegramMessage(chatId: string, text: string, inlineKeyboard: any = null) {
  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (inlineKeyboard) {
      body.reply_markup = { inline_keyboard: inlineKeyboard };
    }

    const response = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Telegram sendMessage failed for chat ${chatId}: Status ${response.status} - ${errText}`);
    }
  } catch (err) {
    console.error(`Fetch exception during sendMessage to chat ${chatId}:`, err);
  }
}
