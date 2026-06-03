import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'not-configured';
  try {
    const parsed = new URL(url);
    return NextResponse.json({ success: true, host: parsed.host });
  } catch (e) {
    return NextResponse.json({ success: true, host: url });
  }
}
