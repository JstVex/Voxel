"use client";

import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface RotatingCubeProps {
    size?: number;
    color?: string;
    rotationSpeed?: { x: number; y: number };
    scale?: number;
}

function RotatingCube({
    size = 2,
    color = "#ffffff",
    rotationSpeed = { x: 0.5, y: 0.3 },
    scale = 1
}: RotatingCubeProps) {
    const meshRef = useRef<THREE.Mesh>(null!);


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
        <mesh ref={meshRef}>
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial
                color={color}
                metalness={0}
                roughness={0.1}
                emissive="#222222"
            />

            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
                <lineBasicMaterial color="#888888" />
            </lineSegments>
        </mesh>
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
    const [messages, setMessages] = useState<string[]>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            setMessages(prev => [...prev, inputText]);

            setCubeScale(1.5);
            setTimeout(() => setCubeScale(1), 500);

            setInputText('');
        }
    };

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


                <RotatingCube
                    size={cubeSize}
                    color={cubeColor}
                    rotationSpeed={rotationSpeed}
                    scale={cubeScale}
                />

                {showControls && (
                    <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        enableRotate={false}
                        autoRotate={false}
                    />
                )}
            </Canvas>

            {showOverlay && (
                <div className="absolute top-8 left-8 text-white">
                    <h1 className="text-4xl font-bold mb-2">3D Cube Demo</h1>
                    <p className="text-lg opacity-80">Built with React Three Fiber</p>
                </div>
            )}

            {messages.length > 0 && (
                <div className="absolute top-8 right-8 max-w-sm">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 max-h-40 overflow-y-auto">
                        <h3 className="text-white font-semibold mb-2">Messages:</h3>
                        {messages.slice(-3).map((msg, index) => (
                            <div key={index} className="text-white/80 text-sm mb-1 p-2 bg-white/5 rounded">
                                {msg}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message and press Enter..."
                        className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>

                <p className="text-center text-white/60 text-sm mt-2">
                    Enter a message
                </p>
            </div>
        </div>
    );
}