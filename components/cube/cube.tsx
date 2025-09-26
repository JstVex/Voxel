"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { sendMessage, getRecentMessages, subscribeToMessages, unsubscribeFromMessages, getCurrentUser } from '../../lib/messageService';
import { Message, User } from '../../lib/supabase';

// Props interface for the rotating cube
interface RotatingCubeProps {
    size?: number;
    color?: string;
    rotationSpeed?: { x: number; y: number };
    scale?: number;
}

// The rotating cube component
function RotatingCube({
    size = 2,
    color = "#ffffff",
    rotationSpeed = { x: 0.5, y: 0.3 },
    scale = 1
}: RotatingCubeProps) {
    const meshRef = useRef<THREE.Mesh>(null!);

    // Animate the cube rotation and scale
    useFrame((state, delta) => {
        const mesh = meshRef.current;
        if (mesh) {
            mesh.rotation.x += delta * rotationSpeed.x;
            mesh.rotation.y += delta * rotationSpeed.y;

            // Smooth scale animation
            const targetScale = scale;
            mesh.scale.x += (targetScale - mesh.scale.x) * delta * 8;
            mesh.scale.y += (targetScale - mesh.scale.y) * delta * 8;
            mesh.scale.z += (targetScale - mesh.scale.z) * delta * 8;
        }
    });

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial
                color={color}
                metalness={0}
                roughness={0.1}
                emissive="#222222"
            />
            {/* Add wireframe for gray borders */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
                <lineBasicMaterial color="#888888" />
            </lineSegments>
        </mesh>
    );
}

// Props interface for the main component
interface ThreeDCubeProps {
    cubeSize?: number;
    cubeColor?: string;
    rotationSpeed?: { x: number; y: number };
    showControls?: boolean;
    showOverlay?: boolean;
    backgroundColor?: string;
}

// Main component
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

    // Initialize user and load messages
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Get or create user
                const user = await getCurrentUser();
                setCurrentUser(user);

                // Load recent messages
                const recentMessages = await getRecentMessages(20);
                setMessages(recentMessages.reverse()); // Reverse to show oldest first

                setIsLoading(false);
            } catch (error) {
                console.error('Failed to initialize app:', error);
                setIsLoading(false);
            }
        };

        initializeApp();
    }, []);

    // Subscribe to real-time messages
    useEffect(() => {
        if (!currentUser) return;

        const subscription = subscribeToMessages((newMessage) => {
            setMessages(prev => [...prev, newMessage]);

            // Animate cube for any new message (including from others)
            setCubeScale(1.3);
            setTimeout(() => setCubeScale(1), 400);
        });

        return () => {
            unsubscribeFromMessages(subscription);
        };
    }, [currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || isSending) return;

        setIsSending(true);
        try {
            // Send message to database
            await sendMessage(inputText);

            // Clear input
            setInputText('');

            // Note: The message will appear via real-time subscription
        } catch (error) {
            console.error('Failed to send message:', error);
            // Could add error notification here
        } finally {
            setIsSending(false);
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

    if (isLoading) {
        return (
            <div className={`w-full h-screen ${backgroundColor} flex items-center justify-center`}>
                <div className="text-white text-xl">Loading...</div>
            </div>
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
                {/* Enhanced lighting for brighter white */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} />
                <directionalLight position={[-5, -5, -5]} intensity={0.3} />
                <pointLight position={[10, 10, 10]} intensity={0.8} />

                {/* The rotating cube */}
                <RotatingCube
                    size={cubeSize}
                    color={cubeColor}
                    rotationSpeed={rotationSpeed}
                    scale={cubeScale}
                />

                {/* Disabled user controls - cube stays centered */}
                {showControls && (
                    <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        enableRotate={false}
                        autoRotate={false}
                    />
                )}
            </Canvas>

            {/* User info overlay */}
            {showOverlay && currentUser && (
                <div className="absolute top-8 left-8 text-white">
                    <h1 className="text-4xl font-bold mb-2">Anonymous Cube</h1>
                    <p className="text-lg opacity-80">You are: {currentUser.session_nickname}</p>
                    <p className="text-sm opacity-60">{messages.length} total messages</p>
                </div>
            )}

            {/* Messages display */}
            <div className="absolute top-8 right-8 bottom-32 w-80 max-w-sm">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-full flex flex-col">
                    <h3 className="text-white font-semibold mb-4 text-center border-b border-white/20 pb-2">
                        Live Messages
                    </h3>

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
            </div>

            {/* Input textbox at bottom */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isSending ? "Sending..." : "Type a message and press Enter..."}
                        disabled={isSending}
                        className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all disabled:opacity-50"
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
                    Send anonymous messages • Cube reacts to all messages
                </p>
            </div>
        </div>
    );
}