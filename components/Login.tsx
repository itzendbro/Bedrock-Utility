import React, { useState } from 'react';

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === 'Akmlogin' && password === 'BU2025@') {
            setError('');
            onLoginSuccess();
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-grid-pattern">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--bg-panel)] rounded-xl shadow-lg border border-[var(--border-primary)]">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)]">🧰 Bedrock Utility</h1>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">Please sign in to continue</p>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-[var(--notification-error-text)] text-center">{error}</p>
                    )}
                    <div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 font-semibold text-white bg-[var(--accent-primary)] rounded-md hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-panel)] focus:ring-[var(--accent-primary)]"
                        >
                            Sign In
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
