import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { NotificationType } from '../components/Notification';

// This data type will be stored in the state.
interface NotificationData {
    id: string;
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    notifications: NotificationData[];
    addNotification: (type: NotificationType, message: string) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<NotificationData[]>([]);

    const addNotification = useCallback((type: NotificationType, message: string) => {
        // Use a more robust ID to prevent collisions
        const id = `${Date.now()}-${Math.random()}`;
        const newNotification: NotificationData = {
            id,
            message,
            type,
        };
        setNotifications(prev => [...prev, newNotification]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
