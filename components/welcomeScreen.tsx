'use client'

import React, { useState } from 'react';
import { updateNickname } from '../lib/messageService';

interface WelcomeScreenProps {
    currentUser: any;
    onComplete: () => void;
}

export default function WelcomeScreen({ currentUser, onComplete }: WelcomeScreenProps) {
    const [nickname, setNickname] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showThankYou, setShowThankYou] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await updateNickname(nickname.trim());
            setShowThankYou(true);

            // Show thank you for 2.5 seconds, then start fade transition
            setTimeout(() => {
                setIsTransitioning(true);
                // Complete transition after fade
                setTimeout(() => {
                    onComplete();
                }, 1500); // 1.5 second fade duration
            }, 2500);
        } catch (error) {
            console.error('Failed to update nickname:', error);
            setIsSubmitting(false);
        }
    };

    if (showThankYou) {
        return (
            <div className={`w-full h-screen bg-black flex items-center justify-center transition-all duration-1500 ease-out ${isTransitioning ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                }`}>
                <div className="text-center">
                    <div className="mb-8">
                        <div className="w-20 h-20 mx-auto bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center mb-8 border border-white/10">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </div>
                        <h1 className="text-5xl font-light text-white mb-6 tracking-wide">
                            Welcome, {nickname}
                        </h1>
                        <p className="text-lg text-white/60 font-light">
                            Entering The Base Cube
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-black flex items-center justify-center">
            <div className="max-w-lg w-full mx-6">
                <div className="text-center">
                    <div className="mb-12">
                        {/* <div className="w-16 h-16 mx-auto bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center mb-8 border border-white/10">
                            <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                        </div> */}
                        <h1 className="text-3xl font-light text-white mb-2 tracking-wide">
                            What should we call you?
                        </h1>
                        <p className="text-white/40 text-sm font-light">
                            This will be your identity for the upcoming experience
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="relative">
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="Your nickname"
                                disabled={isSubmitting}
                                className="w-full px-6 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-white text-lg text-center placeholder-white/30 outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition-all disabled:opacity-50 font-light tracking-wide"
                                autoFocus
                                maxLength={20}
                                required
                            />
                        </div>

                        {/* <button
                            type="submit"
                            disabled={!nickname.trim() || isSubmitting}
                            className="w-full py-4 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-light text-lg transition-all rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30 tracking-wide"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                                    Preparing your space
                                </div>
                            ) : (
                                'Continue'
                            )}
                        </button> */}
                    </form>

                    {/* <div className="mt-12">
                        <p className="text-xs text-white/20 font-light">
                            Press Enter or click Continue
                        </p>
                    </div> */}
                </div>
            </div>
        </div>
    );
}