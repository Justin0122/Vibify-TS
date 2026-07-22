<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../lib/api';
import { $auth } from '../../stores/auth';

const userId = ref('');

onMounted(() => {
    if ($auth.get().userId && $auth.get().apiToken) window.location.href = '/dashboard';
});

function login() {
    if (!userId.value.trim()) return;
    window.location.href = api.authorizeUrl(userId.value.trim());
}
</script>

<template>
    <div class="mx-auto mt-24 max-w-sm rounded-2xl bg-surface-raised p-8 shadow-xl">
        <h1 class="mb-1 text-2xl font-bold text-brand">Vibify</h1>
        <p class="mb-6 text-sm text-muted">Pick any handle to identify yourself, then log in with Spotify.</p>
        <form @submit.prevent="login" class="flex flex-col gap-3">
            <input
                v-model="userId"
                placeholder="your-handle"
                class="rounded-lg border border-white/10 bg-surface px-4 py-2.5 outline-none focus:border-brand"
            />
            <button
                type="submit"
                class="rounded-lg bg-brand px-4 py-2.5 font-semibold text-black transition-colors hover:bg-brand-dark"
            >
                Continue with Spotify
            </button>
        </form>
    </div>
</template>
