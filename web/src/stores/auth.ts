import { persistentMap } from '@nanostores/persistent';
import { computed } from 'nanostores';

export const $auth = persistentMap<{ userId: string; apiToken: string }>('vibify:', {
    userId: '',
    apiToken: '',
});

export const $isLoggedIn = computed($auth, auth => Boolean(auth.userId && auth.apiToken));

export function logout(): void {
    $auth.set({ userId: '', apiToken: '' });
    window.location.href = '/';
}

export function requireAuth(): boolean {
    if (!$auth.get().userId || !$auth.get().apiToken) {
        window.location.href = '/';
        return false;
    }
    return true;
}
