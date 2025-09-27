import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase project URL and anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Present' : 'Missing');
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface User {
    id: string;
    fingerprint_hash: string;
    backup_identifiers: Record<string, any>;
    created_at: string;
    last_seen: string;
    message_count: number;
    session_nickname?: string;
}

export interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    is_deleted: boolean;
    parent_message_id?: string | null;
    reply_count: number;
    users?: {
        session_nickname?: string;
        fingerprint_hash: string;
    };
}