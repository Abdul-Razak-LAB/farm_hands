'use client';

import { useState } from 'react';
import { MicrophoneIcon, StopIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/layout/auth-provider';
import { useOfflineAction } from '@/hooks/use-offline-sync';

export function DailyUpdate() {
    const { farmId } = useAuth();
    const [summary, setSummary] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const { mutateAsync: queueDailyUpdate } = useOfflineAction('updates', 'DAILY_UPDATE_SUBMITTED');

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Speech recognition not supported in this browser.');
            return;
        }
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    setSummary(prev => prev + event.results[i][0].transcript);
                }
            }
        };

        recognition.start();
        (window as any)._recognition = recognition;
    };

    const stopListening = () => {
        if ((window as any)._recognition) {
            (window as any)._recognition.stop();
        }
        setIsRecording(false);
    };

    const handleSubmit = async () => {
        if (!farmId || !summary) return;

        await queueDailyUpdate({
            summary,
            date: new Date().toISOString(),
            farmId,
            idempotencyKey: crypto.randomUUID(),
        });

        setSummary('');
        alert('Update queued for sync!');
    };

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Daily Update</h1>

            <div className="bg-card border rounded-2xl p-6 flex flex-col items-center gap-6 shadow-sm">
                <button
                    onClick={isRecording ? stopListening : startListening}
                    className={`h-24 w-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-destructive animate-pulse scale-110' : 'bg-primary'
                        }`}
                >
                    {isRecording ? (
                        <StopIcon className="h-10 w-10 text-destructive-foreground" />
                    ) : (
                        <MicrophoneIcon className="h-10 w-10 text-primary-foreground" />
                    )}
                </button>
                <p className="text-sm font-medium text-muted-foreground">
                    {isRecording ? 'Listening... Speak clearly' : 'Tap to start voice update'}
                </p>
            </div>

            <div className="space-y-4">
                <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Transcription will appear here... you can also type manually."
                    className="w-full h-40 p-4 rounded-xl border bg-background resize-none focus:ring-2 focus:ring-primary outline-none text-sm leading-relaxed"
                />

                <button
                    onClick={handleSubmit}
                    disabled={!summary}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    Submit Daily Update
                </button>
            </div>
        </div>
    );
}
