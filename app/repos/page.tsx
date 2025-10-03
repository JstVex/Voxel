'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { fetchUserRepositories } from '@/lib/githubService';
import { getOrCreateUser, saveRepositoriesAsCubes } from '@/lib/cubeService';
import { useRouter } from 'next/navigation';

function UserInfo({ session }: { session: any }) {
    return (
        <div className="absolute top-8 right-8 flex items-center gap-4 z-20">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                {session.user?.image && (
                    <img
                        src={session.user.image}
                        alt="Profile"
                        className="w-8 h-8 rounded-full"
                    />
                )}
                <span className="text-white text-sm">{session.user?.name}</span>
            </div>
            <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors backdrop-blur-sm border border-white/20 text-sm"
            >
                Sign Out
            </button>
        </div>
    );
}

export default function RepositoriesPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [repos, setRepos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (session?.accessToken) {
            loadRepositories();
        }
    }, [session]);

    const loadRepositories = async () => {
        try {
            setLoading(true);
            const repositories = await fetchUserRepositories(session!.accessToken!);
            setRepos(repositories);
        } catch (error) {
            console.error('Failed to load repositories: ', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleRepo = (repoId: number) => {
        const newSelected = new Set(selectedRepos);
        if (newSelected.has(repoId)) {
            newSelected.delete(repoId);
        } else {
            newSelected.add(repoId);
        }
        setSelectedRepos(newSelected);
    };

    const handleVisualize = async () => {
        try {
            setLoading(true);

            // Get selected repository objects
            const selectedRepoObjects = repos.filter(repo => selectedRepos.has(repo.id));

            // Get or create user in database
            const user = await getOrCreateUser(
                {
                    id: session!.user!.id,
                    login: session!.user!.name,
                    avatar_url: session!.user!.image
                },
                session!.accessToken!
            );

            // Save repositories as cubes
            await saveRepositoriesAsCubes(user.id, selectedRepoObjects);

            // Navigate to cubes view
            router.push('/');
        } catch (error) {
            console.error('Failed to save repositories:', error);
            alert('Failed to save repositories. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading your repositories...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">

            {session && <UserInfo session={session} />}

            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <p className="text-white/60">Select repositories to visualize as 3D cubes</p>
                    <h1 className="text-4xl font-bold text-white mb-2">Your Repositories</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {repos.map((repo) => (
                        <div
                            key={repo.id}
                            onClick={() => toggleRepo(repo.id)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedRepos.has(repo.id)
                                ? 'bg-white/20 border-white/40'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-white font-semibold">{repo.name}</h3>
                                {selectedRepos.has(repo.id) && (
                                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>

                            <p className="text-white/60 text-sm mb-3 line-clamp-2">
                                {repo.description || 'No description'}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-white/40">
                                {repo.language && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                        {repo.language}
                                    </span>
                                )}
                                <span>⭐ {repo.stargazers_count}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedRepos.size > 0 && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2">
                        <button
                            onClick={handleVisualize}
                            className="bg-white text-black px-8 py-4 rounded-full font-medium hover:bg-gray-100 transition-colors shadow-lg"
                        >
                            Visualize {selectedRepos.size} {selectedRepos.size === 1 ? 'Repository' : 'Repositories'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}