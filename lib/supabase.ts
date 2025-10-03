import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types for GitHub project
export interface User {
    id: string;
    github_id: string;
    github_username: string;
    github_avatar_url?: string;
    access_token?: string;
    created_at: string;
    last_seen: string;
}

export interface TheCube {
    id: string;
    user_id: string;
    github_repo_id: string;
    github_repo_name: string;
    github_repo_full_name: string;
    github_owner: string;
    repo_url: string;
    description?: string;
    language?: string;
    color: string;
    position_index: number;
    is_active: boolean;
    last_synced?: string;
    created_at: string;
    updated_at: string;
}

export interface Commit {
    id: string;
    cube_id: string;
    commit_hash: string;
    commit_message: string;
    author_name?: string;
    author_email?: string;
    author_avatar_url?: string;
    committed_at: string;
    parent_commits?: string[];
    created_at: string;
}