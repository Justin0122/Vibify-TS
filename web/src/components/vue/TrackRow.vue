<script setup lang="ts">
import { api } from '../../lib/api';
import { ref } from 'vue';

const props = defineProps<{
    uri: string;
    trackId?: string;
    name: string;
    artist: string;
    album?: string;
    image?: string | null;
    index?: number;
    liked?: boolean;
}>();

const likedState = ref(props.liked ?? false);
const feedback = ref('');

function flash(message: string) {
    feedback.value = message;
    setTimeout(() => (feedback.value = ''), 1500);
}

async function toggleLike() {
    if (!props.trackId) return;
    try {
        if (likedState.value) await api.unlikeTrack(props.trackId);
        else await api.likeTrack(props.trackId);
        likedState.value = !likedState.value;
    } catch (err) {
        flash((err as Error).message);
    }
}

async function play() {
    try {
        await api.play({ uris: [props.uri] });
        flash('▶ playing');
    } catch (err) {
        flash((err as Error).message);
    }
}

async function queue() {
    try {
        await api.addToQueue(props.uri);
        flash('+ queued');
    } catch (err) {
        flash((err as Error).message);
    }
}
</script>

<template>
    <div class="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-hover">
        <span v-if="index !== undefined" class="w-6 text-right text-sm text-muted">{{ index + 1 }}</span>
        <img v-if="image" :src="image" alt="" class="h-10 w-10 rounded object-cover" loading="lazy" />
        <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ name }}</p>
            <p class="truncate text-sm text-muted">{{ artist }}<span v-if="album"> · {{ album }}</span></p>
        </div>
        <span v-if="feedback" class="text-xs text-brand">{{ feedback }}</span>
        <div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button @click="play" title="Play" class="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-black">▶</button>
            <button @click="queue" title="Add to queue" class="rounded-full bg-white/10 px-2.5 py-1 text-xs">＋</button>
            <button
                v-if="trackId"
                @click="toggleLike"
                :title="likedState ? 'Remove from liked' : 'Save to liked'"
                class="rounded-full bg-white/10 px-2.5 py-1 text-xs"
                :class="likedState ? 'text-brand' : ''"
            >
                {{ likedState ? '♥' : '♡' }}
            </button>
        </div>
    </div>
</template>
