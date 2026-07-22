<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../lib/api';
import TrackRow from './TrackRow.vue';

const items = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
    try {
        const page = (await api.recentTracks({ limit: 50 })) as any;
        items.value = page.items;
    } catch (err) {
        error.value = (err as Error).message;
    } finally {
        loading.value = false;
    }
});

function playedAt(value: string): string {
    return new Date(value).toLocaleString();
}
</script>

<template>
    <p v-if="error" class="rounded-lg bg-red-900/40 p-4 text-red-200">{{ error }}</p>
    <p v-else-if="loading" class="animate-pulse text-muted">Loading…</p>
    <div v-else>
        <div v-for="(item, i) in items" :key="`${item.track.id}-${item.played_at}`" class="flex items-center">
            <div class="flex-1">
                <TrackRow
                    :uri="item.track.uri"
                    :track-id="item.track.id"
                    :name="item.track.name"
                    :artist="item.track.artists?.map((a: any) => a.name).join(', ')"
                    :image="item.track.album?.images?.[2]?.url ?? item.track.album?.images?.[0]?.url"
                    :index="i"
                />
            </div>
            <span class="w-44 shrink-0 pr-3 text-right text-xs text-muted">{{ playedAt(item.played_at) }}</span>
        </div>
    </div>
</template>
