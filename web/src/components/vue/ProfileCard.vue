<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../lib/api';

interface Profile {
    userId: string;
    displayName?: string;
    email: string;
    country: string;
    product: string;
    followers?: number;
    externalUrl: string;
    profileImage: string | null;
}

const profile = ref<Profile | null>(null);
const error = ref('');

onMounted(async () => {
    try {
        profile.value = (await api.profile()) as Profile;
    } catch (err) {
        error.value = (err as Error).message;
    }
});
</script>

<template>
    <div v-if="error" class="rounded-lg bg-red-900/40 p-4 text-red-200">{{ error }}</div>
    <div v-else-if="!profile" class="animate-pulse text-muted">Loading profile…</div>
    <div v-else class="flex items-center gap-5 rounded-2xl bg-surface-raised p-6">
        <img v-if="profile.profileImage" :src="profile.profileImage" alt="" class="h-20 w-20 rounded-full object-cover" />
        <div>
            <h2 class="text-xl font-bold">{{ profile.displayName ?? profile.userId }}</h2>
            <p class="text-sm text-muted">{{ profile.email }} · {{ profile.country }}</p>
            <p class="mt-1 text-sm">
                <span class="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand uppercase">{{ profile.product }}</span>
                <span v-if="profile.followers !== undefined" class="ml-2 text-muted">{{ profile.followers }} followers</span>
            </p>
            <a :href="profile.externalUrl" target="_blank" class="mt-1 inline-block text-sm text-brand hover:underline">Open in Spotify ↗</a>
        </div>
    </div>
</template>
