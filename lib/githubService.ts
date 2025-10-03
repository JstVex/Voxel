interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
    owner: {
        login: string;
        avatar_url: string;
    };
}

export async function fetchUserRepositories(accessToken: string): Promise<GitHubRepo[]> {
    try {
        const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const repos = await response.json();
        return repos;
    } catch (error) {
        console.error('Failed to fetch repositories:', error);
        throw error;
    }
}

export async function fetchRepositoryCommits(
    owner: string,
    repo: string,
    accessToken: string,
    page: number = 1,
    perPage: number = 100
) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const commits = await response.json();
        return commits;
    } catch (error) {
        console.error('Failed to fetch commits:', error);
        throw error;
    }
}