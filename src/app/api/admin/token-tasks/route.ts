import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: List all token tasks
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('token_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, tasks: data || [] });
  } catch (err: any) {
    console.error('Token tasks GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Create a new token task
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title, description, type, action_url, action_label,
      reward_amount, quiz_question, quiz_options, quiz_answer_index,
      is_active, is_repeatable, repeat_cooldown_hours
    } = body;

    if (!title || !description || !type) {
      return NextResponse.json({ success: false, error: 'title, description, and type are required' }, { status: 400 });
    }

    if (type === 'quiz') {
      if (!quiz_question || !quiz_options || quiz_answer_index === undefined) {
        return NextResponse.json({ success: false, error: 'Quiz tasks require quiz_question, quiz_options, and quiz_answer_index' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('token_tasks')
      .insert({
        title,
        description,
        type,
        action_url: action_url || null,
        action_label: action_label || 'Complete Task',
        reward_amount: Number(reward_amount) || 50,
        quiz_question: quiz_question || null,
        quiz_options: quiz_options || null,
        quiz_answer_index: quiz_answer_index !== undefined ? Number(quiz_answer_index) : null,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        is_repeatable: is_repeatable || false,
        repeat_cooldown_hours: repeat_cooldown_hours || 24,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, task: data });
  } catch (err: any) {
    console.error('Token tasks POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Update an existing token task
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Task id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('token_tasks')
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, task: data });
  } catch (err: any) {
    console.error('Token tasks PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a token task
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Task id is required' }, { status: 400 });
    }

    // Delete all claims first (FK constraint)
    await supabase.from('token_task_claims').delete().eq('task_id', id);

    const { error } = await supabase.from('token_tasks').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Token tasks DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
