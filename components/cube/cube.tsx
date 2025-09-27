"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { sendMessage, getRecentMessages, subscribeToMessages, unsubscribeFromMessages, getCurrentUser } from '../../lib/messageService';
import { Message, User } from '../../lib/supabase';
import Nodes from './nodes';
import WelcomeScreen from '../welcomeScreen';

function TransitionOverlay({ isTransitioning, isEntering }: any) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isTransitioning) {
            setProgress(0);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 4;
                });
            }, 16);

            return () => clearInterval(interval);
        }
    }, [isTransitioning]);

    if (!isTransitioning) return null;

    // Create zoom effect and fade to black
    const scale = 1 + (progress / 100) * 3;
    const opacity = Math.min(progress / 100, 0.9);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
                className="absolute inset-0 bg-gradient-radial from-transparent to-black/80"
                style={{
                    transform: `scale(${scale})`,
                    opacity: opacity
                }}
            />

            {progress > 50 && (
                <div
                    className="absolute inset-0 bg-black"
                    style={{
                        opacity: (progress - 70) / 30
                    }}
                />
            )}
        </div>
    );
}

function needsOnboarding(user: any): boolean {
    return !user?.session_nickname || user.session_nickname.trim() === '';
}

interface CubeProps {
    size?: number;
    color?: string;
    rotationSpeed?: { x: number; y: number };
    scale?: number;
    messages?: Message[];
    onCubeClick?: () => void;
}

function Cube({
    size = 2,
    color = "#ffffff",
    rotationSpeed = { x: 0.5, y: 0.3 },
    scale = 1,
    messages = [],
    onCubeClick
}: CubeProps) {
    const meshRef = useRef<THREE.Mesh>(null!);

    const generateNodePosition = (index: number, cubeSize: number): [number, number, number] => {
        const seed = index * 12345;
        const random = (offset: number) => {
            const x = Math.sin(seed + offset) * 10000;
            return (x - Math.floor(x)) * 2 - 1;
        };

        const margin = 0.3;
        const range = (cubeSize / 2) - margin;

        return [
            random(1) * range,
            random(2) * range,
            random(3) * range
        ];
    };

    useFrame((state, delta) => {
        const mesh = meshRef.current;
        if (mesh) {
            mesh.rotation.x += delta * rotationSpeed.x;
            mesh.rotation.y += delta * rotationSpeed.y;

            const targetScale = scale;
            mesh.scale.x += (targetScale - mesh.scale.x) * delta * 8;
            mesh.scale.y += (targetScale - mesh.scale.y) * delta * 8;
            mesh.scale.z += (targetScale - mesh.scale.z) * delta * 8;
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

            {/* Wireframe edges */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
                <lineBasicMaterial color="#ffffff" opacity={0.6} transparent />
            </lineSegments>

            {messages.map((message, index) => (
                <mesh
                    key={message.id}
                    position={generateNodePosition(index, size)}
                >
                    <sphereGeometry args={[0.06, 8, 8]} />
                    <meshStandardMaterial color="#ffffff" />
                </mesh>
            ))}
        </group>
    );
}

interface ThreeDCubeProps {
    cubeSize?: number;
    cubeColor?: string;
    rotationSpeed?: { x: number; y: number };
    showControls?: boolean;
    showOverlay?: boolean;
    backgroundColor?: string;
}

export default function ThreeDCube({
    cubeSize = 2,
    cubeColor = "#ffffff",
    rotationSpeed = { x: 0.5, y: 0.3 },
    showControls = false,
    showOverlay = true,
    backgroundColor = "bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
}: ThreeDCubeProps) {
    const [inputText, setInputText] = useState('');
    const [cubeScale, setCubeScale] = useState(1);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isInsideView, setIsInsideView] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);

    // Initialize user and load messages
    useEffect(() => {
        const initializeApp = async () => {
            try {
                const user = await getCurrentUser();
                setCurrentUser(user);

                if (needsOnboarding(user)) {
                    setShowWelcome(true);
                    setIsLoading(false);
                    return;
                }

                const recentMessages = await getRecentMessages();
                setMessages(recentMessages.reverse());

                setIsLoading(false);
            } catch (error) {
                console.error('Failed to initialize app:', error);
                setIsLoading(false);
            }
        };

        initializeApp();
    }, []);

    // real-time messages
    useEffect(() => {
        if (!currentUser) return;

        console.log('Setting up real-time subscription for user:', currentUser.session_nickname);

        const subscription = subscribeToMessages((newMessage) => {
            console.log('Received new message via subscription:', newMessage);
            setMessages(prev => {
                const exists = prev.some(msg => msg.id === newMessage.id);
                if (exists) {
                    console.log('Message already exists, skipping...');
                    return prev;
                }

                console.log('Adding new message to state');
                return [...prev, newMessage];
            });

            setCubeScale(1.25);
            setTimeout(() => setCubeScale(1), 400);
        });

        console.log('Subscription created:', subscription);

        return () => {
            console.log('Cleaning up subscription');
            unsubscribeFromMessages(subscription);
        };
    }, [currentUser]);

    const handleWelcomeComplete = async () => {
        setShowWelcome(false);
        setIsLoading(true);

        try {
            const { clearCurrentUser, getCurrentUser: refreshUser } = await import('../../lib/userIdentity');
            clearCurrentUser();

            // Get the updated user data
            const updatedUser = await refreshUser();
            setCurrentUser(updatedUser);

            // Load messages
            const recentMessages = await getRecentMessages(100);
            setMessages(recentMessages.reverse());
        } catch (error) {
            console.error('Failed to load messages after welcome:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCubeClick = () => {
        if (isTransitioning) return;

        console.log('Cube clicked - starting simple transition');
        setIsTransitioning(true);

        // After transition animation completes, switch to inside view
        setTimeout(() => {
            setIsInsideView(true);
            setIsTransitioning(false);
            console.log('Transition completed - now inside view');
        }, 1600);
    };

    const handleExitInsideView = () => {
        if (isTransitioning) return;

        console.log('Starting transition from inside view');
        setIsTransitioning(true);
        setIsInsideView(false);

        setTimeout(() => {
            setIsTransitioning(false);
            console.log('Exit transition completed');
        }, 1600);
    };

    const handleStartExitTransition = () => {
        setIsTransitioning(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || isSending) return;

        setIsSending(true);
        try {
            const sentMessage = await sendMessage(inputText);
            console.log('Message sent successfully:', sentMessage);

            setInputText('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const refreshMessages = async () => {
        setIsRefreshing(true);
        try {
            const recentMessages = await getRecentMessages(20);
            setMessages(recentMessages.reverse());
            console.log('Messages refreshed manually');
        } catch (error) {
            console.error('Failed to refresh messages:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isMyMessage = (message: Message) => {
        return currentUser && message.user_id === currentUser.id;
    };

    if (showWelcome && currentUser) {
        return (
            <WelcomeScreen
                currentUser={currentUser}
                onComplete={handleWelcomeComplete}
            />
        );
    }

    if (isLoading) {
        return (
            <div className={`w-full h-screen ${backgroundColor} flex items-center justify-center`}>
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (isInsideView) {
        return (
            <Nodes
                messages={messages}
                currentUser={currentUser}
                onExit={handleExitInsideView}
                isTransitioning={isTransitioning}
                onStartTransition={handleStartExitTransition}
            />
        );
    }

    return (
        <div className={`w-full h-screen ${backgroundColor} relative`}>
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
                    size={cubeSize}
                    color={cubeColor}
                    rotationSpeed={rotationSpeed}
                    scale={cubeScale}
                    messages={messages}
                    onCubeClick={handleCubeClick}
                />

                {showControls && !isTransitioning && (
                    <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        enableRotate={false}
                        autoRotate={false}
                    />
                )}
            </Canvas>

            {showOverlay && currentUser && (
                <div className="absolute top-8 left-8 text-white">
                    <h1 className="text-4xl font-bold mb-2">The Base Cube</h1>
                    <p className="text-lg opacity-80">Welcome back {currentUser.session_nickname}</p>
                    <p className="text-sm opacity-60">{messages.length} total messages</p>
                </div>
            )}

            {/* Messages display - only show when outside */}
            {/* <div className="absolute top-8 right-8 bottom-32 w-80 max-w-sm">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-2">
                        <h3 className="text-white font-semibold">Live Messages</h3>
                        <button
                            onClick={refreshMessages}
                            disabled={isRefreshing}
                            className="text-white/60 hover:text-white transition-colors p-1"
                            title="Refresh messages"
                        >
                            {isRefreshing ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`p-3 rounded-lg text-sm ${isMyMessage(message)
                                    ? 'bg-blue-500/30 text-blue-100 ml-4'
                                    : 'bg-white/10 text-white/90 mr-4'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-xs opacity-75">
                                        {isMyMessage(message) ? 'You' : message.users?.session_nickname || 'Anonymous'}
                                    </span>
                                    <span className="text-xs opacity-60">
                                        {formatTime(message.created_at)}
                                    </span>
                                </div>
                                <div>{message.content}</div>
                            </div>
                        ))}

                        {messages.length === 0 && (
                            <div className="text-center text-white/60 py-8">
                                No messages yet. Be the first to say something!
                            </div>
                        )}
                    </div>
                </div>
            </div> */}

            {isTransitioning && (
                <TransitionOverlay
                    isTransitioning={isTransitioning}
                    isEntering={!isInsideView}
                />
            )}

            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isSending ? "Sending..." : "Add a message"}
                        disabled={isSending}
                        className="w-full py-4 pl-6 pr-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isSending}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors"
                    >
                        {isSending ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </form>

                {/* Instructions */}
                <p className="text-center text-white/60 text-sm mt-2">
                    Click the cube to explore nodes
                </p>
            </div>
        </div>
    );
}