import { NextResponse } from 'next/server';
import { notifyAdmins } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    if (!payload.title || !payload.body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    await notifyAdmins(payload);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error triggering notification:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
