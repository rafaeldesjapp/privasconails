import { NextResponse } from 'next/server';
import { notifyAdmins } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const { title, body, url } = await request.json();
    
    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    await notifyAdmins({ title, body, url });
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error triggering notification:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
