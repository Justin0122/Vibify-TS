<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../lib/api';
import TrackRow from './TrackRow.vue';

const query = ref('');
const type = ref('track');
const results = ref<any | null>(null);
const loading = ref(false);
const error = ref('');

let debounce: ReturnType<typeof setTimeout>;

function onInput() {
    clearTimeout(debounce);
    debounce = setTimeout(run, 400);
}

async function run() {
    if (!query.value.trim()) {
        results.value = null;
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        results.value = await api.search(query.value.trim(), type.value, { limit: 10 });
    } catch (err) {
        error.value = (err as Error).message;
    } finally {
        loading.value = false;
    }
}

async function playAlbum(uri: string) {
    try {
        await api.play({ context_uri: uri });
    } catch (err) {
        error.value = (err as Error).message;
    }
}
</script>

<template>
    <div class="mb-4 flex gap-2">
        <input
            v-model="query"
            @input="onInput"
            placeholder="Search Spotify…"
            class="flex-1 rounded-lg border border-white/10 bg-surface-raised px-4 py-2.5 outline-none focus:border-brand"
        />
        <select v-model="type" @change="run" class="rounded-lg border border-white/10 bg-surface-raised px-3 py-2 text-sm">
            <option value="track">Tracks</option>
            <option value="artist">Artists</option>
            <option value="album">Albums</option>
            <option value="playlist">Playlists</option>
        </select>
    </div>

    <p v-if="error" class="rounded-lg bg-red-900/40 p-4 text-red-200">{{ error }}</p>
    <p v-else-if="loading" class="animate-pulse text-muted">Searching…</p>

    <template v-else-if="results">
        <div v-if="results.tracks">
            <TrackRow
                v-for="(track, i) in results.tracks.items"
                :key="track.id"
                :uri="track.uri"
                :track-id="track.id"
                :name="track.name"
                :artist="track.artists?.map((a: any) => a.name).join(', ')"
                :album="track.album?.name"
                :image="track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url"
                :index="i"
            />
        </div>

        <div v-if="results.artists" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div v-for="artist in results.artists.items" :key="artist.id" class="rounded-xl bg-surface-raised p-4 text-center">
                <img
                    v-if="artist.images?.length"
                    :src="artist.images[artist.images.length - 1].url"
                    alt=""
                    class="mx-auto mb-2 h-24 w-24 rounded-full object-cover"
                    loading="lazy"
                />
                <p class="truncate font-medium">{{ artist.name }}</p>
                <a :href="artist.external_urls?.spotify" target="_blank" class="text-xs text-brand hover:underline">Open ↗</a>
            </div>
        </div>

        <div v-if="results.albums || results.playlists" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div
                v-for="item in (results.albums ?? results.playlists).items.filter(Boolean)"
                :key="item.id"
                class="rounded-xl bg-surface-raised p-3"
            >
                <img
                    v-if="item.images?.[0]"
                    :src="item.images[0].url"
                    alt=""
                    class="mb-2 aspect-square w-full rounded-lg object-cover"
                    loading="lazy"
                />
                <p class="truncate text-sm font-medium">{{ item.name }}</p>
                <p class="truncate text-xs text-muted">{{ item.artists?.map((a: any) => a.name).join(', ') ?? item.owner?.display_name }}</p>
                <button @click="playAlbum(item.uri)" class="mt-2 w-full rounded-full bg-brand px-2 py-1 text-xs font-bold text-black">
                    ▶ Play
                </button>
            </div>
        </div>
    </template>
</template>
