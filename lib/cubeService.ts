import { supabase, TheCube } from './supabase';

// Get all cubes ordered by position
export async function getAllCubes(): Promise<TheCube[]> {
    const { data: cubes, error } = await supabase
        .from('cubes')
        .select('*')
        .eq('is_active', true)
        .order('position_index', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch cubes: ${error.message}`);
    }

    return cubes || [];
}

// Get a specific cube by ID
export async function getCubeById(cubeId: string): Promise<TheCube | null> {
    const { data: cube, error } = await supabase
        .from('cubes')
        .select('*')
        .eq('id', cubeId)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch cube: ${error.message}`);
    }

    return cube;
}

// Get cube by position index
export async function getCubeByPosition(position: number): Promise<TheCube | null> {
    const { data: cube, error } = await supabase
        .from('cubes')
        .select('*')
        .eq('position_index', position)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch cube: ${error.message}`);
    }

    return cube;
}

// Get the default cube (Base Cube at position 0)
export async function getDefaultCube(): Promise<TheCube> {
    const cube = await getCubeByPosition(0);
    if (!cube) {
        throw new Error('Default cube not found');
    }
    return cube;
}

// Get cube stats (message count, user count)
export async function getCubeStats(cubeId: string): Promise<{ messageCount: number; userCount: number }> {
    const { data, error } = await supabase
        .rpc('get_cube_stats', { cube_uuid: cubeId });

    if (error) {
        console.warn('Failed to get cube stats:', error);
        return { messageCount: 0, userCount: 0 };
    }

    const stats = data?.[0];
    return {
        messageCount: parseInt(stats?.message_count || '0'),
        userCount: parseInt(stats?.user_count || '0')
    };
}

// Create a new cube
export async function createCube(
    name: string,
    description: string,
    color: string,
    opacity: number = 0.3
): Promise<TheCube> {
    // Get the next position index
    const { data: maxPositionResult } = await supabase
        .from('cubes')
        .select('position_index')
        .order('position_index', { ascending: false })
        .limit(1);

    const nextPosition = (maxPositionResult?.[0]?.position_index || -1) + 1;

    const { data: cube, error } = await supabase
        .from('cubes')
        .insert({
            name,
            description,
            color,
            opacity,
            position_index: nextPosition
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create cube: ${error.message}`);
    }

    return cube!;
}

// Update cube properties
export async function updateCube(
    cubeId: string,
    updates: Partial<Pick<TheCube, 'name' | 'description' | 'color' | 'opacity'>>
): Promise<TheCube> {
    const { data: cube, error } = await supabase
        .from('cubes')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', cubeId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update cube: ${error.message}`);
    }

    return cube!;
}

// Delete a cube (soft delete by setting is_active to false)
export async function deleteCube(cubeId: string): Promise<void> {
    const { error } = await supabase
        .from('cubes')
        .update({ is_active: false })
        .eq('id', cubeId);

    if (error) {
        throw new Error(`Failed to delete cube: ${error.message}`);
    }
}

// Real-time cube subscription
export function subscribeToCubes(callback: (cube: TheCube) => void) {
    console.log('Creating cube subscription...');

    const subscription = supabase
        .channel('public:cubes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'cubes',
                filter: 'is_active=eq.true'
            },
            (payload) => {
                console.log('Cube change received:', payload);
                if (payload.new) {
                    callback(payload.new as TheCube);
                }
            }
        )
        .subscribe((status) => {
            console.log('Cube subscription status:', status);
        });

    return subscription;
}

// Unsubscribe from cube updates
export function unsubscribeFromCubes(subscription: any) {
    if (subscription) {
        supabase.removeChannel(subscription);
    }
}