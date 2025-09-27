import { supabase, Message } from './supabase';
import { getCurrentUser } from './userIdentity';
import { getDefaultCube } from './cubeService';

// Re-export getCurrentUser for convenience
export { getCurrentUser } from './userIdentity';

// Send a new message or reply to a specific cube
export async function sendMessage(content: string, parentMessageId?: string, cubeId?: string): Promise<Message> {
    const user = await getCurrentUser();

    // If no cube ID provided, use the default cube
    let targetCubeId = cubeId;
    if (!targetCubeId) {
        if (parentMessageId) {
            // If replying, get the parent message's cube
            const { data: parentMessage } = await supabase
                .from('messages')
                .select('cube_id')
                .eq('id', parentMessageId)
                .single();

            targetCubeId = parentMessage?.cube_id;
        }

        if (!targetCubeId) {
            // Fall back to default cube
            const defaultCube = await getDefaultCube();
            targetCubeId = defaultCube.id;
        }
    }

    const messageData: any = {
        user_id: user.id,
        cube_id: targetCubeId,
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
      ),
      cubes (
        name,
        color
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

// Get recent messages for a specific cube
export async function getRecentMessages(limit: number = 50, cubeId?: string): Promise<Message[]> {
    let query = supabase
        .from('messages')
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      ),
      cubes (
        name,
        color
      )
    `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

    // Filter by cube if specified
    if (cubeId) {
        query = query.eq('cube_id', cubeId);
    }

    const { data: messages, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return messages || [];
}

// Get messages for current user (optionally filtered by cube)
export async function getUserMessages(cubeId?: string): Promise<Message[]> {
    const user = await getCurrentUser();

    let query = supabase
        .from('messages')
        .select(`
      *,
      users (
        session_nickname,
        fingerprint_hash
      ),
      cubes (
        name,
        color
      )
    `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    // Filter by cube if specified
    if (cubeId) {
        query = query.eq('cube_id', cubeId);
    }

    const { data: messages, error } = await query;

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
      ),
      cubes (
        name,
        color
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

// Real-time message subscription (optionally filtered by cube)
export function subscribeToMessages(callback: (message: Message) => void, cubeId?: string) {
    console.log('Creating message subscription...', cubeId ? `for cube ${cubeId}` : 'for all cubes');

    let filter = 'is_deleted=eq.false';
    if (cubeId) {
        filter += `.and(cube_id=eq.${cubeId})`;
    }

    const subscription = supabase
        .channel(`public:messages${cubeId ? `:${cubeId}` : ''}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: filter
            },
            async (payload) => {
                console.log('Real-time payload received:', payload);

                // Fetch the complete message with user and cube data
                const { data: message, error } = await supabase
                    .from('messages')
                    .select(`
            *,
            users (
              session_nickname,
              fingerprint_hash
            ),
            cubes (
              name,
              color
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

// Get online users count (active in last 5 minutes) - optionally for a specific cube
export async function getOnlineUsersCount(cubeId?: string): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    if (cubeId) {
        // Get users who have posted in this cube recently
        const { count, error } = await supabase
            .from('messages')
            .select('user_id', { count: 'exact', head: true })
            .eq('cube_id', cubeId)
            .gte('created_at', fiveMinutesAgo)
            .eq('is_deleted', false);

        if (error) {
            console.warn('Failed to get cube-specific online users count:', error);
            return 0;
        }

        return count || 0;
    } else {
        // Get all recently active users
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
}