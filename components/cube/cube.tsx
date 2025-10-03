"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getOrCreateUser, getUserCubes } from '../../lib/cubeService';
import { TheCube } from '../../lib/supabase';

// GitHub Sign-In Screen
function GitHubSignIn() {
    return (
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <div className="text-center">
                <div className="mb-8">
                    <h1 className="text-5xl font-bold text-white mb-4">Voxel</h1>
                    <p className="text-xl text-white/80 mb-8">
                        Visualize your GitHub repositories in 3D
                    </p>
                </div>

                <button
                    onClick={() => signIn('github')}
                    className="bg-white text-black px-8 py-4 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-3 mx-auto"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    Sign in with GitHub
                </button>

                <p className="text-white/40 text-sm mt-8">
                    Sign in to visualize your repositories as 3D cubes
                </p>
            </div>
        </div>
    );
}

// User Info Display
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
                onClick={() => signOut()}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors backdrop-blur-sm border border-white/20 text-sm"
            >
                Sign Out
            </button>
        </div>
    );
}

// Cube Navigation Component
function CubeNavigation({
    cubes,
    currentCubeIndex,
    onCubeChange,
    isTransitioning = false
}: {
    cubes: TheCube[];
    currentCubeIndex: number;
    onCubeChange: (cubeIndex: number) => void;
    isTransitioning?: boolean;
}) {
    const canGoLeft = currentCubeIndex > 0;
    const canGoRight = currentCubeIndex < cubes.length - 1;

    return (
        <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 pointer-events-none z-10">
            <div className="flex justify-between items-center px-8">
                <button
                    onClick={() => canGoLeft && onCubeChange(currentCubeIndex - 1)}
                    disabled={!canGoLeft || isTransitioning}
                    className={`pointer-events-auto bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white p-4 rounded-full transition-all backdrop-blur-sm border border-white/20 ${canGoLeft && !isTransitioning ? 'opacity-80 hover:opacity-100' : 'opacity-30'
                        }`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <button
                    onClick={() => canGoRight && onCubeChange(currentCubeIndex + 1)}
                    disabled={!canGoRight || isTransitioning}
                    className={`pointer-events-auto bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white p-4 rounded-full transition-all backdrop-blur-sm border border-white/20 ${canGoRight && !isTransitioning ? 'opacity-80 hover:opacity-100' : 'opacity-30'
                        }`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// 3D Cube Component
interface CubeProps {
    size?: number;
    color?: string;
    rotationSpeed?: { x: number; y: number };
    scale?: number;
    onCubeClick?: () => void;
}

function Cube({
    size = 2,
    color = "#ffffff",
    rotationSpeed = { x: 0.5, y: 0.3 },
    scale = 1,
    onCubeClick
}: CubeProps) {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame((state, delta) => {
        const mesh = meshRef.current;
        if (mesh) {
            mesh.rotation.x += delta * rotationSpeed.x;
            mesh.rotation.y += delta * rotationSpeed.y;

            const targetScale = scale;
            mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8);
        }
    });

    return (
        <group ref={meshRef}>
            <mesh onClick={onCubeClick}>
                <boxGeometry args={[size, size, size]} />
                <meshStandardMaterial
                    color={color}
                    metalness={0}
                    roughness={0.1}
                    transparent
                    opacity={0.3}
                    emissive="#222222"
                    emissiveIntensity={0.1}
                />
            </mesh>

            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
                <lineBasicMaterial color="#ffffff" opacity={0.6} transparent />
            </lineSegments>
        </group>
    );
}

// Main Component
export default function ThreeDCube() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [cubes, setCubes] = useState<TheCube[]>([]);
    const [currentCubeIndex, setCurrentCubeIndex] = useState(0);
    const [currentCube, setCurrentCube] = useState<TheCube | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCubeSwitching, setIsCubeSwitching] = useState(false);

    // Load cubes when session is available
    useEffect(() => {
        const loadCubes = async () => {
            if (!session) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // Get or create user in database
                const user = await getOrCreateUser(
                    {
                        id: session.user?.email || '',
                        login: session.user?.name || '',
                        avatar_url: session.user?.image || ''
                    },
                    session.accessToken || ''
                );

                // Load user's cubes
                const userCubes = await getUserCubes(user.id);

                if (userCubes.length === 0) {
                    router.push('/repos');
                    return;
                }

                setCubes(userCubes);
                setCurrentCube(userCubes[0]);
                setCurrentCubeIndex(0);
            } catch (error) {
                console.error('Failed to load cubes:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadCubes();
    }, [session, router]);

    // Handle cube switching
    const handleCubeChange = (newCubeIndex: number) => {
        if (isCubeSwitching || newCubeIndex === currentCubeIndex) return;

        setIsCubeSwitching(true);
        setCurrentCube(cubes[newCubeIndex]);
        setCurrentCubeIndex(newCubeIndex);

        setTimeout(() => {
            setIsCubeSwitching(false);
        }, 800);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft' && currentCubeIndex > 0) {
                handleCubeChange(currentCubeIndex - 1);
            } else if (event.key === 'ArrowRight' && currentCubeIndex < cubes.length - 1) {
                handleCubeChange(currentCubeIndex + 1);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [currentCubeIndex, cubes.length]);

    // Loading state
    if (status === 'loading' || isLoading) {
        return (
            <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    // Not authenticated
    if (!session) {
        return <GitHubSignIn />;
    }

    // No cubes yet - should redirect to /repos but show loading
    if (cubes.length === 0) {
        return (
            <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Redirecting to repository selection...</div>
            </div>
        );
    }

    const displayColor = currentCube?.color || '#ffffff';
    const displayName = currentCube?.github_repo_name || 'Repository';

    return (
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
            <UserInfo session={session} />

            <Canvas
                camera={{
                    position: [0, 0, 6],
                    fov: 45,
                }}
                className="w-full h-full"
            >
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} />
                <directionalLight position={[-5, -5, -5]} intensity={0.3} />
                <pointLight position={[10, 10, 10]} intensity={0.8} />

                <Cube
                    size={2}
                    color={displayColor}
                    rotationSpeed={{ x: 0.5, y: 0.3 }}
                    scale={1}
                    onCubeClick={() => console.log('Cube clicked - will show commits soon')}
                />

                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    enableRotate={true}
                />
            </Canvas>

            {/* Cube Navigation */}
            {cubes.length > 1 && (
                <CubeNavigation
                    cubes={cubes}
                    currentCubeIndex={currentCubeIndex}
                    onCubeChange={handleCubeChange}
                    isTransitioning={isCubeSwitching}
                />
            )}

            {/* Cube Info */}
            <div className="absolute top-8 left-8 text-white z-20">
                <div className="pointer-events-auto bg-black/20 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
                    <div className="flex items-center space-x-3">
                        <div
                            className="w-4 h-4 rounded-full border border-white/30"
                            style={{ backgroundColor: currentCube?.color }}
                        />
                        <span className="text-white font-medium text-sm">
                            {displayName}
                        </span>
                    </div>
                </div>
                <p className="text-sm opacity-60 mt-2">
                    {currentCube?.language && `${currentCube.language} • `}
                    {currentCube?.description || 'No description'}
                </p>
                {cubes.length > 1 && (
                    <p className="text-sm opacity-60 mt-1">
                        Repository {currentCubeIndex + 1} of {cubes.length}
                    </p>
                )}
            </div>

            {/* Instructions */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center text-white/60 text-sm">
                <p>
                    {cubes.length > 1 ? 'Use ← → to switch repositories • Click cube to view commits' : 'Click the cube to view commits'}
                </p>
            </div>
        </div>
    );
}