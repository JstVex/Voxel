'use client'

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Message, User } from '../../lib/supabase';
import { sendMessage } from '../../lib/messageService';

function CameraZoomController({
    targetPosition,
    isZooming,
    onZoomComplete
}: {
    targetPosition: [number, number, number] | null;
    isZooming: boolean;
    onZoomComplete: () => void;
}) {
    const { camera } = useThree();
    const originalPosition = useRef<THREE.Vector3>(new THREE.Vector3(5, 5, 5));
    const [zoomProgress, setZoomProgress] = useState(0);

    useFrame((state, delta) => {
        if (isZooming && targetPosition) {
            const speed = delta * 3;
            const newProgress = Math.min(zoomProgress + speed, 1);
            setZoomProgress(newProgress);

            // Smooth interpolation to target position (closer to the node)
            const zoomPosition = new THREE.Vector3(
                targetPosition[0] + 2, // Offset to not be inside the node
                targetPosition[1] + 1,
                targetPosition[2] + 2
            );

            // Interpolate camera position
            camera.position.lerpVectors(originalPosition.current, zoomPosition, easeInOutCubic(newProgress));

            // Look at the target node
            const lookAtTarget = new THREE.Vector3(...targetPosition);
            const currentLookAt = new THREE.Vector3(0, 0, 0);
            currentLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), lookAtTarget, easeInOutCubic(newProgress));
            camera.lookAt(currentLookAt);

            if (newProgress >= 1) {
                onZoomComplete();
            }
        } else if (!isZooming && zoomProgress > 0) {
            // Zoom back out
            const speed = delta * 3;
            const newProgress = Math.max(zoomProgress - speed, 0);
            setZoomProgress(newProgress);

            if (targetPosition) {
                const zoomPosition = new THREE.Vector3(
                    targetPosition[0] + 2,
                    targetPosition[1] + 1,
                    targetPosition[2] + 2
                );

                camera.position.lerpVectors(originalPosition.current, zoomPosition, easeInOutCubic(newProgress));

                const lookAtTarget = new THREE.Vector3(...targetPosition);
                const currentLookAt = new THREE.Vector3(0, 0, 0);
                currentLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), lookAtTarget, easeInOutCubic(newProgress));
                camera.lookAt(currentLookAt);
            }
        }
    });

    return null;
}

// Easing function for smooth animation
function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface ConnectionLineProps {
    start: [number, number, number];
    end: [number, number, number];
}

function ConnectionLine({ start, end }: ConnectionLineProps) {
    const points = [
        new THREE.Vector3(...start),
        new THREE.Vector3(...end),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    return (
        // @ts-ignore
        <line geometry={geometry}>
            <lineBasicMaterial color="#60a5fa" opacity={0.6} transparent />
        </line>
    );
}

interface NodesProps {
    messages: Message[];
    currentUser: any;
    onExit: () => void;
    isTransitioning?: boolean;
    onStartTransition?: () => void;
}

function MessageNode({
    position,
    message,
    isCurrentUser,
    onNodeClick,
    onNodeHover,
    isZoomedNode
}: {
    position: [number, number, number];
    message: Message;
    isCurrentUser: boolean;
    onNodeClick: (message: Message, position: [number, number, number]) => void;
    onNodeHover: (message: Message | null) => void;
    isZoomedNode: boolean;
}) {
    const nodeRef = useRef<THREE.Mesh>(null!);
    const [isHovered, setIsHovered] = useState(false);

    // Animate the zoomed node to be larger
    useFrame((state, delta) => {
        if (nodeRef.current) {
            const targetScale = isZoomedNode ? 2 : 1; // Make zoomed node twice as big
            nodeRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
        }
    });

    const handlePointerOver = () => {
        if (!isZoomedNode) { // Only show hover on non-zoomed nodes
            setIsHovered(true);
            onNodeHover(message);
        }
    };

    const handlePointerOut = () => {
        setIsHovered(false);
        onNodeHover(null);
    };

    return (
        <mesh
            ref={nodeRef}
            position={position}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={(e) => {
                e.stopPropagation();
                onNodeClick(message, position);
            }}
        >
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial
                color={
                    isZoomedNode
                        ? "#10b981" // Green for zoomed/focused node
                        : isHovered
                            ? "#fbbf24"
                            : isCurrentUser
                                ? "#3b82f6"
                                : "#ffffff"
                }
                emissive={
                    isZoomedNode
                        ? "#065f46"
                        : isHovered
                            ? "#f59e0b"
                            : isCurrentUser
                                ? "#1d4ed8"
                                : "#000000"
                }
                emissiveIntensity={isZoomedNode ? 0.4 : isHovered ? 0.3 : isCurrentUser ? 0.2 : 0}
            />
        </mesh>
    );
}

export default function Nodes({
    messages,
    currentUser,
    onExit,
    isTransitioning = false,
    onStartTransition
}: NodesProps) {
    const [hoveredMessage, setHoveredMessage] = useState<Message | null>(null);
    const [focusedMessage, setFocusedMessage] = useState<Message | null>(null);
    const [focusedPosition, setFocusedPosition] = useState<[number, number, number] | null>(null);
    const [isZooming, setIsZooming] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleExitClick = () => {
        // If we're focused on a node, zoom out first
        if (focusedMessage) {
            handleNodeUnfocus();
            return;
        }

        if (onStartTransition) {
            onStartTransition();
        }
        setTimeout(() => {
            onExit();
        }, 100);
    };

    // Handle Escape key to unfocus or cancel
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (focusedMessage) {
                    handleNodeUnfocus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [focusedMessage]);

    // Generate positions with reply positioning logic
    const generateNodePosition = (index: number, message?: Message): [number, number, number] => {
        // If this is a reply, position it near the parent
        if (message?.parent_message_id) {
            // Find the root parent by traversing up the chain
            let currentMessage = message;
            let depth = 0;
            const maxDepth = 10; // Prevent infinite loops

            while (currentMessage?.parent_message_id && depth < maxDepth) {
                const parentMsg = messages.find(m => m.id === currentMessage.parent_message_id);
                if (!parentMsg) break;
                currentMessage = parentMsg;
                depth++;
            }

            // Now currentMessage is the root parent (top-level message)
            const rootIndex = messages.findIndex(m => m.id === currentMessage.id);
            const rootPos = generateParentPosition(rootIndex);

            // Get all replies to this specific parent, sorted by creation time
            const siblingReplies = messages
                .filter(m => m.parent_message_id === message.parent_message_id)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const replyIndex = siblingReplies.findIndex(m => m.id === message.id);

            console.log(`Reply positioning - Parent: ${message.parent_message_id?.substring(0, 8)}, Reply: ${message.id.substring(0, 8)}, Index: ${replyIndex}, Total: ${siblingReplies.length}, Depth: ${depth}`);

            // Position based on depth from root and sibling index
            const angle = (replyIndex / Math.max(siblingReplies.length, 1)) * Math.PI * 2;
            const distance = 0.6 + (depth * 0.3); // Gradually move outward with depth

            const replyPos: [number, number, number] = [
                rootPos[0] + Math.cos(angle) * distance,
                rootPos[1] + Math.sin(angle) * distance * 0.5,
                rootPos[2] + Math.cos(angle + Math.PI / 4) * distance * 0.3
            ];

            console.log(`Root pos:`, rootPos, `Reply pos:`, replyPos, `Distance: ${distance}`);

            return replyPos;
        }

        // This is a top-level message (no parent)
        return generateParentPosition(index);
    };

    const generateParentPosition = (index: number): [number, number, number] => {
        const seed = index * 12345;
        const random = (offset: number) => {
            const x = Math.sin(seed + offset) * 10000;
            return (x - Math.floor(x)) * 2 - 1;
        };

        const range = 8; // Larger range for inside view
        return [
            random(1) * range,
            random(2) * range,
            random(3) * range
        ];
    };

    const isMyMessage = (message: Message) => {
        return currentUser && message.user_id === currentUser.id;
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString();
    };

    const handleNodeClick = (message: Message, position: [number, number, number]) => {
        setFocusedMessage(message);
        setFocusedPosition(position);
        setIsZooming(true);
        setHoveredMessage(null); // Clear hover when focusing
    };

    const handleNodeUnfocus = () => {
        setIsZooming(false);
        setTimeout(() => {
            setFocusedMessage(null);
            setFocusedPosition(null);
        }, 1000); // Delay to allow zoom out animation
    };

    const handleNodeHover = (message: Message | null) => {
        if (!focusedMessage) { // Only allow hover when not focused on a node
            setHoveredMessage(message);
        }
    };

    const handleZoomComplete = () => {
        // Zoom animation completed
    };

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !focusedMessage || isSending) return;

        setIsSending(true);
        try {
            await sendMessage(replyText.trim(), focusedMessage.id);
            setReplyText('');
            console.log('Reply sent successfully');
            // Keep the focused state so user can see the new reply appear
        } catch (error) {
            console.error('Failed to send reply:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
            <Canvas
                camera={{
                    position: [5, 5, 5],
                    fov: 75,
                }}
                className="w-full h-full"
            >
                {/* Camera zoom controller */}
                <CameraZoomController
                    targetPosition={focusedPosition}
                    isZooming={isZooming}
                    onZoomComplete={handleZoomComplete}
                />

                {/* Lighting for inside view */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <directionalLight position={[-5, -5, -5]} intensity={0.3} />
                <pointLight position={[10, 10, 10]} intensity={0.5} />
                <pointLight position={[-10, -10, -10]} intensity={0.3} />

                {/* Message nodes scattered in 3D space */}
                {messages.map((message, index) => (
                    <MessageNode
                        key={message.id}
                        position={generateNodePosition(index, message)}
                        message={message}
                        isCurrentUser={isMyMessage(message)}
                        onNodeClick={handleNodeClick}
                        onNodeHover={handleNodeHover}
                        isZoomedNode={focusedMessage?.id === message.id}
                    />
                ))}

                {/* Connection lines between replies and parents */}
                {messages
                    .filter(message => message.parent_message_id)
                    .map(reply => {
                        const replyIndex = messages.findIndex(m => m.id === reply.id);
                        const parentIndex = messages.findIndex(m => m.id === reply.parent_message_id);

                        if (parentIndex === -1 || replyIndex === -1) return null;

                        return (
                            <ConnectionLine
                                key={`connection-${reply.id}`}
                                start={generateNodePosition(parentIndex, messages[parentIndex])}
                                end={generateNodePosition(replyIndex, reply)}
                            />
                        );
                    })}

                {/* Free look controls - disabled when zooming */}
                {!isTransitioning && !isZooming && (
                    <OrbitControls
                        enableZoom={true}
                        enablePan={true}
                        enableRotate={true}
                        autoRotate={false}
                        target={[0, 0, 0]}
                        minDistance={2}
                        maxDistance={25}
                        maxPolarAngle={Math.PI}
                        minPolarAngle={0}
                        enableDamping={true}
                        dampingFactor={0.05}
                    />
                )}
            </Canvas>

            {/* Header - different when focused on a node */}
            <div className="absolute top-8 left-8 text-white">
                {focusedMessage ? (
                    <div>
                        <p className="text-md opacity-80">Press ESC to zoom out</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-lg opacity-90">Exploring messages in the base cube</p>
                        <p className="text-sm opacity-60 mt-2">
                            Hover nodes to preview • Click nodes for details
                        </p>
                        <p className="text-sm opacity-60 mt-2">
                            {hoveredMessage ? hoveredMessage.content.slice(0, 100) + (hoveredMessage.content.length > 100 ? '...' : '') : ''}
                        </p>
                    </div>
                )}
            </div>

            {/* Focused Message Display - positioned above the centered node */}
            {focusedMessage && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full pointer-events-none"
                    style={{ marginTop: '-65px' }}>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20 max-w-md pointer-events-auto">
                        <div className="flex flex-col justify-between">
                            <h3 className="text-white text-sm">
                                {focusedMessage.content}
                            </h3>
                            <p className="text-white/80 text-xs">
                                - {isMyMessage(focusedMessage)
                                    ? 'You'
                                    : focusedMessage.users?.session_nickname || 'Anonymous'
                                }
                            </p>
                        </div>

                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit button - changes functionality when focused */}
            {!isTransitioning && (
                <div className="absolute top-8 right-8">
                    <button
                        onClick={handleExitClick}
                        className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors backdrop-blur-sm"
                        title={focusedMessage ? "Zoom out" : "Exit cube view"}
                    >
                        {focusedMessage ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </button>
                </div>
            )}

            {/* Reply Input - only appears when focused on a node */}
            {focusedMessage && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
                    {/* Reply context info */}


                    {/* Reply form - exactly like cube.tsx */}
                    <form onSubmit={handleReplySubmit} className="relative">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={isSending ? "Sending reply..." : "Send a reply"}
                            disabled={isSending}
                            className="w-full py-4 pl-6 pr-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all disabled:opacity-50"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!replyText.trim() || isSending}
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

                    <p className="text-center text-white/60 text-sm mt-2">
                        Replying to {isMyMessage(focusedMessage) ? 'your own message' : (focusedMessage.users?.session_nickname || 'Anonymous')}
                    </p>
                </div>
            )}

            {/* Instructions for empty state */}
            {messages.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                        <h2 className="text-3xl font-bold mb-4">No messages yet</h2>
                        <p className="text-lg opacity-80">
                            Send the first message to populate this space!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}