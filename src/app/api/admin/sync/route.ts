import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Hitting the main application's sync endpoint to centralize logic.
    // In local dev, the main app typically runs on port 3000.
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';
    console.log(`Admin Terminal: Triggering live sync on main app at ${mainAppUrl}...`);

    const res = await fetch(`${mainAppUrl}/api/markets/sync`, {
      method: 'GET',
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`Main app returned status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Trigger sync error:', error);
    return NextResponse.json({ success: false, error: `Failed to trigger sync: ${error.message}` }, { status: 500 });
  }
}
