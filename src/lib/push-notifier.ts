import webpush from 'web-push';
import { supabase } from './supabase';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@worldcupx.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
  console.warn('Warning: VAPID keys not configured. PWA push notifications will fail to send.');
}

interface PushPayload {
  title: string;
  message: string;
  category: string;
  url?: string;
  deliveryLogId?: string;
  silent?: boolean;
}

/**
 * Low-level helper to dispatch push payload to a single subscription endpoint
 */
async function sendRawPush(subscription: any, payload: PushPayload, deliveryLogId: string): Promise<boolean> {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };

  try {
    const res = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        ...payload,
        deliveryLogId
      })
    );

    if (res.statusCode >= 200 && res.statusCode < 300) {
      await supabase
        .from('push_delivery_logs')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', deliveryLogId);
      return true;
    }
    throw new Error(`WebPush returned status code ${res.statusCode}`);
  } catch (err: any) {
    console.error(`WebPush fail for subscription ${subscription.id}:`, err.message || err);

    const isGone = err.statusCode === 410 || err.statusCode === 404 || err.message?.includes('Gone') || err.message?.includes('not found');
    if (isGone) {
      console.log(`Deleting expired push subscription endpoint: ${subscription.id}`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscription.id);
    }

    await supabase
      .from('push_delivery_logs')
      .update({
        status: 'failed',
        error_message: err.message || 'Unknown WebPush error',
        updated_at: new Date().toISOString()
      })
      .eq('id', deliveryLogId);

    return false;
  }
}

/**
 * Checks push preferences for a user to determine if they should receive an alert category
 */
async function isPushAllowed(userId: string, category: string, metadata: any = {}): Promise<boolean> {
  try {
    const { data: prefs, error } = await supabase
      .from('push_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !prefs) {
      return true;
    }

    if (category === 'match_alerts') {
      const mode = prefs.match_alerts;
      if (mode === 'disabled') return false;
      if (mode === 'favorites') {
        const matchId = metadata.matchId;
        if (!matchId) return false;
        
        const { data: match } = await supabase
          .from('matches')
          .select('home_team_id, away_team_id')
          .eq('id', matchId)
          .maybeSingle();

        const favTeams = prefs.favorite_teams || [];
        if (match && favTeams.length > 0) {
          return favTeams.includes(match.home_team_id) || favTeams.includes(match.away_team_id);
        }
        return false;
      }
      if (mode === 'important') {
        const matchId = metadata.matchId;
        if (!matchId) return false;
        
        const { data: match } = await supabase
          .from('matches')
          .select('stage')
          .eq('id', matchId)
          .maybeSingle();
        
        if (match) {
          const isKnockout = match.stage && !match.stage.toLowerCase().includes('group');
          return isKnockout;
        }
        return false;
      }
      return true;
    }

    if (category === 'goal_alerts') {
      const mode = prefs.goal_alerts;
      if (mode === 'disabled') return false;
      if (mode === 'favorites') {
        const matchId = metadata.matchId;
        if (!matchId) return false;

        const { data: match } = await supabase
          .from('matches')
          .select('home_team_id, away_team_id')
          .eq('id', matchId)
          .maybeSingle();

        const favTeams = prefs.favorite_teams || [];
        if (match && favTeams.length > 0) {
          return favTeams.includes(match.home_team_id) || favTeams.includes(match.away_team_id);
        }
        return false;
      }
      return true;
    }

    if (category === 'prediction_alerts') return !!prefs.prediction_alerts;
    if (category === 'settlement_alerts') return !!prefs.settlement_alerts;
    if (category === 'fanzone_alerts') return !!prefs.fanzone_alerts;
    if (category === 'watch_party_alerts') return !!prefs.watch_party_alerts;
    if (category === 'daily_digest') return !!prefs.daily_digest;

    return true;
  } catch (err) {
    console.error('Error verifying push preferences:', err);
    return true;
  }
}

/**
 * Sends a push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  category: string = 'general',
  metadata: any = {}
): Promise<{ success: boolean; sentCount: number; deliveredCount: number }> {
  try {
    const allowed = await isPushAllowed(userId, category, metadata);
    if (!allowed) {
      return { success: false, sentCount: 0, deliveredCount: 0 };
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return { success: false, sentCount: 0, deliveredCount: 0 };
    }

    const { data: pushRecord, error: pushRecErr } = await supabase
      .from('push_notifications')
      .insert({
        title,
        message,
        category,
        sent_count: subscriptions.length
      })
      .select()
      .single();

    if (pushRecErr || !pushRecord) throw pushRecErr || new Error('Could not create notification log');

    let deliveredCount = 0;
    const payload: PushPayload = {
      title,
      message,
      category,
      url: metadata.url || '/'
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        const { data: logRecord } = await supabase
          .from('push_delivery_logs')
          .insert({
            subscription_id: sub.id,
            notification_id: pushRecord.id,
            status: 'pending'
          })
          .select()
          .single();

        if (!logRecord) return;

        const sent = await sendRawPush(sub, payload, logRecord.id);
        if (sent) deliveredCount++;
      })
    );

    await supabase
      .from('push_notifications')
      .update({ delivered_count: deliveredCount })
      .eq('id', pushRecord.id);

    return { success: true, sentCount: subscriptions.length, deliveredCount };
  } catch (err) {
    console.error(`Failed to send push notification to user ${userId}:`, err);
    return { success: false, sentCount: 0, deliveredCount: 0 };
  }
}

/**
 * Broadcasts a push notification to ALL subscribed devices
 */
export async function broadcastPushNotification(
  title: string,
  message: string,
  category: string = 'general',
  metadata: any = {}
): Promise<{ success: boolean; sentCount: number; deliveredCount: number }> {
  try {
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error || !subscriptions || subscriptions.length === 0) {
      return { success: false, sentCount: 0, deliveredCount: 0 };
    }

    const { data: pushRecord, error: pushRecErr } = await supabase
      .from('push_notifications')
      .insert({
        title,
        message,
        category,
        sent_count: subscriptions.length
      })
      .select()
      .single();

    if (pushRecErr || !pushRecord) throw pushRecErr || new Error('Could not create notification log');

    let deliveredCount = 0;
    const payload: PushPayload = {
      title,
      message,
      category,
      url: metadata.url || '/'
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        const { data: logRecord } = await supabase
          .from('push_delivery_logs')
          .insert({
            subscription_id: sub.id,
            notification_id: pushRecord.id,
            status: 'pending'
          })
          .select()
          .single();

        if (!logRecord) return;

        const sent = await sendRawPush(sub, payload, logRecord.id);
        if (sent) deliveredCount++;
      })
    );

    await supabase
      .from('push_notifications')
      .update({ delivered_count: deliveredCount })
      .eq('id', pushRecord.id);

    return { success: true, sentCount: subscriptions.length, deliveredCount };
  } catch (err) {
    console.error('Failed to broadcast push notification:', err);
    return { success: false, sentCount: 0, deliveredCount: 0 };
  }
}
