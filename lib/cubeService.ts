import { supabase, TheCube, User } from './supabase';

// Get or create user in database
export async function getOrCreateUser(githubUser: any, accessToken: string): Promise<User> {
    console.log('GitHub user data:', githubUser);

    const githubId = githubUser.id;
    const githubLogin = githubUser.login;

    if (!githubId && !githubLogin) {
        throw new Error('No valid identifier found for GitHub user. Please sign out and sign back in.');
    }

    if (githubId) {
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('github_id', githubId.toString())
            .single();

        if (existingUser) {
            await supabase
                .from('users')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', existingUser.id);

            return existingUser;
        }
    }

    if (githubLogin) {
        const { data: existingUserByLogin, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('github_username', githubLogin)
            .single();

        if (existingUserByLogin) {
            const updateData: any = { last_seen: new Date().toISOString() };
            if (githubId) {
                updateData.github_id = githubId.toString();
            }

            await supabase
                .from('users')
                .update(updateData)
                .eq('id', existingUserByLogin.id);

            return existingUserByLogin;
        }
    }

    if (!githubId || !githubLogin) {
        throw new Error('Cannot create user without GitHub ID and username');
    }

    const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
            github_id: githubId.toString(),
            github_username: githubLogin,
            github_avatar_url: githubUser.avatar_url || githubUser.image,
            access_token: accessToken,
        })
        .select()
        .single();

    if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
    }

    return newUser!;
}

// Save selected repositories as cubes
export async function saveRepositoriesAsCubes(
    userId: string,
    repos: any[]
): Promise<TheCube[]> {
    // Assign colors based on language
    const languageColors: Record<string, string> = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'Java': '#b07219',
        'Go': '#00ADD8',
        'Rust': '#dea584',
        'Ruby': '#701516',
        'PHP': '#4F5D95',
        'C++': '#f34b7d',
        'C': '#555555',
        'Swift': '#ffac45',
        'Kotlin': '#A97BFF',
    };

    const cubesData = repos.map((repo, index) => ({
        user_id: userId,
        github_repo_id: repo.id.toString(),
        github_repo_name: repo.name,
        github_repo_full_name: repo.full_name,
        github_owner: repo.owner.login,
        repo_url: repo.html_url,
        description: repo.description,
        language: repo.language,
        color: languageColors[repo.language] || '#ffffff',
        position_index: index,
        is_active: true,
    }));

    const { data: cubes, error } = await supabase
        .from('cubes')
        .insert(cubesData)
        .select();

    if (error) {
        throw new Error(`Failed to save cubes: ${error.message}`);
    }

    return cubes!;
}

// Get all cubes for a user
export async function getUserCubes(userId: string): Promise<TheCube[]> {
    const { data: cubes, error } = await supabase
        .from('cubes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('position_index', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch cubes: ${error.message}`);
    }

    return cubes || [];
}

// Delete a cube
export async function deleteCube(cubeId: string): Promise<void> {
    const { error } = await supabase
        .from('cubes')
        .update({ is_active: false })
        .eq('id', cubeId);

    if (error) {
        throw new Error(`Failed to delete cube: ${error.message}`);
    }
}