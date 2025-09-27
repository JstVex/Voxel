import { supabase, Message } from './supabase';
import { getCurrentUser } from './userIdentity';

// Re-export getCurrentUser for convenience
export { getCurrentUser } from './userIdentity';

// Send a new message or reply
export async function sendMessage(content: string, parentMessageId?: string): Promise<Message> {
    const user = await getCurrentUser();

    const messageData: any = {
        user_id: user.id,
        content: content.trim()
    };

    // Add parent message ID if this is a reply
    if (parentMessageId) {
        messageData.parent_message_id = parentMessageId;
    }

    const { data: message, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      )
    `)
        .single();

    if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
    }

    // Update user activity
    await supabase.rpc('update_user_activity', { user_uuid: user.id });

    return message!;
}

// Get recent messages
export async function getRecentMessages(limit: number = 50): Promise<Message[]> {
    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      )
    `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return messages || [];
}

// Get messages for current user
export async function getUserMessages(): Promise<Message[]> {
    const user = await getCurrentUser();

    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      )
    `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch user messages: ${error.message}`);
    }

    return messages || [];
}

// Get replies for a specific message
export async function getMessageReplies(messageId: string): Promise<Message[]> {
    const { data: replies, error } = await supabase
        .from('messages')
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      )
    `)
        .eq('parent_message_id', messageId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch replies: ${error.message}`);
    }

    return replies || [];
}

// Real-time message subscription
export function subscribeToMessages(callback: (message: Message) => void) {
    console.log('Creating message subscription...');

    const subscription = supabase
        .channel('public:messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'is_deleted=eq.false'
            },
            async (payload) => {
                console.log('Real-time payload received:', payload);

                // Fetch the complete message with user data
                const { data: message, error } = await supabase
                    .from('messages')
                    .select(`
            *,
            users (
              session_nickname,
              fingerprint_hash
            )
          `)
                    .eq('id', payload.new.id)
                    .single();

                if (error) {
                    console.error('Error fetching complete message:', error);
                    return;
                }

                if (message) {
                    console.log('Broadcasting complete message:', message);
                    callback(message);
                }
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
        });

    return subscription;
}

// Unsubscribe from real-time updates
export function unsubscribeFromMessages(subscription: any) {
    if (subscription) {
        supabase.removeChannel(subscription);
    }
}

// Delete a message (soft delete)
export async function deleteMessage(messageId: string): Promise<void> {
    const user = await getCurrentUser();

    const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId)
        .eq('user_id', user.id); // Can only delete own messages

    if (error) {
        throw new Error(`Failed to delete message: ${error.message}`);
    }
}

// Update user nickname
export async function updateNickname(nickname: string): Promise<void> {
    const user = await getCurrentUser();

    const { error } = await supabase
        .from('users')
        .update({ session_nickname: nickname.trim() })
        .eq('id', user.id);

    if (error) {
        throw new Error(`Failed to update nickname: ${error.message}`);
    }
}

// Get online users count (active in last 5 minutes)
export async function getOnlineUsersCount(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', fiveMinutesAgo);

    if (error) {
        console.warn('Failed to get online users count:', error);
        return 0;
    }

    return count || 0;
}