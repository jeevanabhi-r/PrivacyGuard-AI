import { supabase } from '@/lib/supabase';

export type PrivacyActionCategory =
  | 'Account Security'
  | 'Social Media Privacy'
  | 'Location Privacy'
  | 'App Permissions'
  | 'Browser Safety'
  | 'Other';

export type PrivacyActionPriority = 'High' | 'Medium' | 'Low';

export interface PrivacyAction {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: PrivacyActionCategory;
  priority: PrivacyActionPriority;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export const PRIVACY_ACTION_CATEGORIES: PrivacyActionCategory[] = [
  'Account Security',
  'Social Media Privacy',
  'Location Privacy',
  'App Permissions',
  'Browser Safety',
  'Other',
];

export const PRIVACY_ACTION_PRIORITIES: PrivacyActionPriority[] = ['High', 'Medium', 'Low'];

export async function fetchPrivacyActions(): Promise<{
  data: PrivacyAction[] | null;
  error: Error | null;
}> {
  if (!supabase) {
    return { data: null, error: new Error('Database client not configured') };
  }

  const { data, error } = await supabase
    .from('privacy_actions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: (data as PrivacyAction[]) || [], error: null };
}

export async function createPrivacyAction(payload: {
  userId: string;
  title: string;
  description?: string | null;
  category: PrivacyActionCategory;
  priority: PrivacyActionPriority;
}): Promise<{ data: PrivacyAction | null; error: Error | null }> {
  if (!supabase) {
    return { data: null, error: new Error('Database client not configured') };
  }

  const title = payload.title.trim();
  if (!title) {
    return { data: null, error: new Error('Action title is required.') };
  }

  const description = payload.description?.trim() ? payload.description.trim() : null;

  const { data, error } = await supabase
    .from('privacy_actions')
    .insert({
      user_id: payload.userId,
      title,
      description,
      category: payload.category,
      priority: payload.priority,
      completed: false,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as PrivacyAction, error: null };
}

export async function updatePrivacyAction(
  actionId: string,
  payload: {
    title: string;
    description?: string | null;
    category: PrivacyActionCategory;
    priority: PrivacyActionPriority;
  },
): Promise<{ data: PrivacyAction | null; error: Error | null }> {
  if (!supabase) {
    return { data: null, error: new Error('Database client not configured') };
  }

  const title = payload.title.trim();
  if (!title) {
    return { data: null, error: new Error('Action title is required.') };
  }

  const description = payload.description?.trim() ? payload.description.trim() : null;

  const { data, error } = await supabase
    .from('privacy_actions')
    .update({
      title,
      description,
      category: payload.category,
      priority: payload.priority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as PrivacyAction, error: null };
}

export async function togglePrivacyActionComplete(
  actionId: string,
  completed: boolean,
): Promise<{ data: PrivacyAction | null; error: Error | null }> {
  if (!supabase) {
    return { data: null, error: new Error('Database client not configured') };
  }

  const { data, error } = await supabase
    .from('privacy_actions')
    .update({
      completed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as PrivacyAction, error: null };
}

export async function deletePrivacyAction(
  actionId: string,
): Promise<{ success: boolean; error: Error | null }> {
  if (!supabase) {
    return { success: false, error: new Error('Database client not configured') };
  }

  const { error } = await supabase.from('privacy_actions').delete().eq('id', actionId);

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, error: null };
}
