import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { supabase, User } from './supabase';

// Generate a stable browser fingerprint
export async function generateFingerprint(): Promise<string> {
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
    } catch (error) {
        console.warn('Fingerprinting failed, using fallback:', error);
        // Fallback to less reliable but still persistent method
        return generateFallbackFingerprint();
    }
}

// Fallback fingerprint generation
function generateFallbackFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);

    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

// Get or create localStorage backup ID
function getLocalStorageId(): string {
    const key = 'anonymous_user_id';
    let id = localStorage.getItem(key);

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(key, id);
    }

    return id;
}

// Find or create user based on fingerprint and localStorage
export async function getOrCreateUser(): Promise<User> {
    try {
        const fingerprint = await generateFingerprint();
        const localStorageId = getLocalStorageId();

        console.log('Looking for user with fingerprint:', fingerprint.substring(0, 8) + '...');

        // Try to find existing user by fingerprint
        let { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('fingerprint_hash', fingerprint)
            .single();

        if (findError && findError.code !== 'PGRST116') {
            console.error('Error finding user:', findError);
        }

        if (existingUser) {
            console.log('Found existing user:', existingUser.session_nickname || 'No nickname set');
            // Update last seen
            await supabase
                .from('users')
                .update({
                    last_seen: new Date().toISOString(),
                    backup_identifiers: {
                        ...existingUser.backup_identifiers,
                        localStorage: localStorageId
                    }
                })
                .eq('id', existingUser.id);

            return existingUser;
        }

        // Try to find by localStorage ID (backup method)
        const { data: backupUser, error: backupError } = await supabase
            .from('users')
            .select('*')
            .contains('backup_identifiers', { localStorage: localStorageId })
            .single();

        if (backupError && backupError.code !== 'PGRST116') {
            console.error('Error finding backup user:', backupError);
        }

        if (backupUser) {
            console.log('Found backup user:', backupUser.session_nickname || 'No nickname set');
            // Update fingerprint hash (might have changed)
            const { data: updatedUser } = await supabase
                .from('users')
                .update({
                    fingerprint_hash: fingerprint,
                    last_seen: new Date().toISOString()
                })
                .eq('id', backupUser.id)
                .select()
                .single();

            return updatedUser!;
        }

        // Create new user WITHOUT a nickname - they'll set it in the welcome screen
        const newUser = {
            fingerprint_hash: fingerprint,
            backup_identifiers: { localStorage: localStorageId },
            session_nickname: null // No auto-generated nickname
        };

        console.log('Creating new user without nickname');

        const { data: createdUser, error } = await supabase
            .from('users')
            .insert(newUser)
            .select()
            .single();

        if (error) {
            console.error('Supabase error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw new Error(`Failed to create user: ${error.message}`);
        }

        console.log('Successfully created user without nickname');
        return createdUser!;

    } catch (error) {
        console.error('Full error in getOrCreateUser:', error);
        throw error;
    }
}

// Store current user in memory for the session
let currentUser: User | null = null;

export async function getCurrentUser(): Promise<User> {
    if (!currentUser) {
        currentUser = await getOrCreateUser();
    }
    return currentUser;
}

export function clearCurrentUser(): void {
    currentUser = null;
}