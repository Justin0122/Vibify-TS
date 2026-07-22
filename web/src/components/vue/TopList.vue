<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { api } from '../../lib/api';
import TrackRow from './TrackRow.vue';

const tab = ref<'tracks' | 'artists'>('tracks');
const timeRange = ref('medium_term');
const items = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const call = tab.value === 'tracks' ? api.topTracks : api.topArtists;
        const page = (await call({ limit: 50, time_range: timeRange.value })) as any;
        items.value = page.items;
    } catch (err) {
        error.value = (err as Error).message;
    } finally {
        loading.value = false;
    }
}

onMounted(load);
watch([tab, timeRange], load);
</script>

<template>
    <div class="mb-4 flex flex-wrap items-center gap-2">
        <div class="flex rounded-full bg-surface-raised p-1">
            <button
                v-for="option in ['tracks', 'artists']"
                :key="option"
                @click="tab = option as any"
                class="rounded-full px-4 py-1.5 text-sm capitalize"
                :class="tab === option ? 'bg-brand font-semibold text-black' : 'text-muted'"
            >
                {{ option }}
            </button>
        </div>
        <select v-model="timeRange" class="rounded-lg border border-white/10 bg-surface-raised px-3 py-1.5 text-sm">
            <option value="short_term">Last 4 weeks</option>
            <option value="medium_term">Last 6 months</option>
            <option value="long_term">All time</option>
        </select>
    </div>

    <p v-if="error" class="rounded-lg bg-red-900/40 p-4 text-red-200">{{ error }}</p>
    <p v-else-if="loading" class="animate-pulse text-muted">Loading…</p>

    <div v-else-if="tab === 'tracks'">
        <TrackRow
            v-for="(track, i) in items"
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

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        <a
            v-for="artist in items"
            :key="artist.id"
            :href="artist.external_urls?.spotify"
            target="_blank"
            class="rounded-xl bg-surface-raised p-4 text-center transition-colors hover:bg-surface-hover"
        >
            <img
                v-if="artist.images?.[0]"
                :src="artist.images[artist.images.length - 1].url"
                alt=""
                class="mx-auto mb-2 h-24 w-24 rounded-full object-cover"
                loading="lazy"
            />
            <p class="truncate font-medium">{{ artist.name }}</p>
            <p class="truncate text-xs text-muted">{{ artist.genres?.slice(0, 2).join(', ') }}</p>
        </a>
    </div>
</template>
