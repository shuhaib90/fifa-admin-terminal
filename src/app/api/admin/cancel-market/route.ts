import { NextResponse } from 'next/server';
import { cancelMarket } from '@/lib/market-settlement';

export async function POST(request: Request) {
  try {
    const { marketId } = await request.json();

    if (!marketId) {
      return NextResponse.json({ success: false, error: 'marketId is required' }, { status: 400 });
    }

    const cancelSuccess = await cancelMarket(marketId);

    if (!cancelSuccess) {
      return NextResponse.json({ success: false, error: 'Failed to cancel market and refund users' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Market successfully cancelled and refunded' });
  } catch (error: any) {
    console.error('Cancel market route error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
