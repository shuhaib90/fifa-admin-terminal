import { NextResponse } from 'next/server';
import { reopenMarket } from '@/lib/market-settlement';

export async function POST(request: Request) {
  try {
    const { marketId } = await request.json();

    if (!marketId) {
      return NextResponse.json({ success: false, error: 'marketId is required' }, { status: 400 });
    }

    const reopenSuccess = await reopenMarket(marketId);

    if (!reopenSuccess) {
      return NextResponse.json({ success: false, error: 'Failed to reopen market and revert payouts' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Market successfully reopened and payouts reverted' });
  } catch (error: any) {
    console.error('Reopen market route error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
