'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureAppException } from '@/lib/observability';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        captureAppException(error, {
            tags: { scope: 'error-boundary' },
            extra: { componentStack: errorInfo.componentStack },
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black">Something went wrong</h1>
                    <p className="text-muted-foreground max-w-xs">
                        We've encountered an unexpected issue. Don't worry, your offline data is safe.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
