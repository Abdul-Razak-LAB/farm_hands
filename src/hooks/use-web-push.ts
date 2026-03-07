'use client';

import { useState, useCallback, useMemo } from 'react';
import { useIntegrationStatus } from '@/hooks/use-integration-status';
import { reportIntegrationDegraded } from '@/lib/observability';

type PushPublicKeyResponse = {
    publicKey: string;
};

type ApiEnvelope<T> = {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
};

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

function isIosDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalonePwa() {
    const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const mediaStandalone = window.matchMedia('(display-mode: standalone)').matches;
    return iosStandalone || mediaStandalone;
}

function normalizePushError(error: unknown) {
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
            return 'Notification permission was denied. Enable notifications in browser settings and retry.';
        }
        if (error.name === 'AbortError') {
            return 'Push setup was interrupted. Retry once network is stable.';
        }
        if (error.name === 'InvalidStateError') {
            return 'Service worker is not active yet. Reload and try again.';
        }
        if (error.name === 'NotSupportedError') {
            return 'Push is not supported in this browser context.';
        }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'Push could not be enabled. In-app alerts will continue.';
}

export function useWebPush() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const statusQuery = useIntegrationStatus();

    const isSupported = useMemo(() => (
        typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    ), []);

    const integrationAvailable = statusQuery.data?.push ?? false;

    const subscribe = useCallback(async (farmId?: string) => {
        if (!isSupported) {
            setMessage('Push is unavailable on this browser. In-app alerts will be used.');
            reportIntegrationDegraded('push', 'PushManager unavailable in this browser');
            return;
        }

        if (!integrationAvailable) {
            setMessage('Push integration is unavailable: configure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server, then restart the app. In-app alerts will be used.');
            reportIntegrationDegraded('push', 'Backend reported push unavailable');
            return;
        }

        if (isIosDevice() && !isStandalonePwa()) {
            setMessage('On iOS, install to Home Screen first, then enable notifications.');
            return;
        }

        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
            setMessage('Push requires HTTPS on this device. Open the secure app URL and retry.');
            return;
        }

        setIsSubscribing(true);
        setMessage(null);

        try {
            if (typeof Notification === 'undefined') {
                throw new Error('Notification API is unavailable in this browser.');
            }

            if (Notification.permission === 'denied') {
                throw new Error('Notification permission is blocked for this site.');
            }

            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    throw new Error('Notification permission not granted.');
                }
            }

            const keyResponse = await fetch('/api/push/public-key');
            const keyJson = (await keyResponse.json()) as ApiEnvelope<PushPublicKeyResponse>;

            if (!keyJson.success || !keyJson.data?.publicKey) {
                throw new Error(keyJson.error?.message || 'Push key unavailable');
            }

            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                registration = await navigator.serviceWorker.register('/sw.js');
            }

            await navigator.serviceWorker.ready;

            const existingSubscription = await registration.pushManager.getSubscription();
            const subscription = existingSubscription
                ?? await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(keyJson.data.publicKey),
                });

            const subscribeResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    farmId,
                    subscription,
                }),
            });
            const subscribeJson = (await subscribeResponse.json()) as ApiEnvelope<{ subscribed: boolean }>;

            if (!subscribeJson.success) {
                throw new Error(subscribeJson.error?.message || 'Unable to persist push subscription');
            }

            setIsSubscribed(true);
            setMessage('Notifications enabled.');
        } catch (error) {
            const normalizedError = normalizePushError(error);
            reportIntegrationDegraded('push', normalizedError);
            setMessage(normalizedError);
        } finally {
            setIsSubscribing(false);
        }
    }, [integrationAvailable, isSupported]);

    return {
        isSubscribed,
        isSupported,
        isSubscribing,
        integrationAvailable,
        message,
        subscribe,
    };
}
