import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../api/supabase';
import type { ChatRow, MessageRow } from '../types/chat';

export function useChats() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setChats(data as ChatRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { chats, loading, reloadChats: load };
}

export async function loadMessages(chatId: string) {
  return supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
}
