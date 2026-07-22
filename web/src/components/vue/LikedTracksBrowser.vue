<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../../lib/api';
import TrackRow from './TrackRow.vue';

const items = ref<any[]>([]);
const total = ref(0);
const offset = ref(0);
const limit = 50;
const loading = ref(false);
const error = ref('');
const syncStatus = ref('');

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const page = (await api.likedTracks({ limit, offset: offset.value })) as any;
        items.value = page.items;
        total.value = page.total;
    } catch (err) {
        error.value = (err as Error).message;
    } finally {
        loading.value = false;
    }
}

const pageNum = computed(() => Math.floor(offset.value / limit) + 1);
const pageCount = computed(() => Math.max(Math.ceil(total.value / limit), 1));

function go(delta: number) {
    offset.value = Math.max(offset.value + delta * limit, 0);
    load();
}

async function sync() {
    try {
        const res = await api.startSync();
        syncStatus.value = res.message;
        poll();
    } catch (err) {
        syncStatus.value = (err as Error).message;
    }
}

async function poll() {
    const status = await api.syncStatus();
    if (status.state === 'running') {
        syncStatus.value = `Syncing… ${status.processed}/${status.total}`;
        setTimeout(poll, 1500);
    } else {
        syncStatus.value = status.state === 'done' ? `Sync done (${status.processed} new)` : (status.message ?? status.state);
    }
}

onMounted(load);
</script>

<template>
    <div class="mb-4 flex items-center gap-3">
        <span class="text-sm text-muted">{{ total }} liked tracks</span>
        <button @click="sync" class="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-surface-hover">Sync to DB</button>
        <span v-if="syncStatus" class="text-sm text-brand">{{ syncStatus }}</span>
        <div class="ml-auto flex items-center gap-2 text-sm">
            <button @click="go(-1)" :disabled="offset === 0" class="rounded-full bg-white/10 px-3 py-1 disabled:opacity-30">‹</button>
            <span class="text-muted">{{ pageNum }} / {{ pageCount }}</span>
            <button @click="go(1)" :disabled="offset + limit >= total" class="rounded-full bg-white/10 px-3 py-1 disabled:opacity-30">›</button>
        </div>
    </div>

    <p v-if="error" class="rounded-lg bg-red-900/40 p-4 text-red-200">{{ error }}</p>
    <p v-else-if="loading" class="animate-pulse text-muted">Loading…</p>
    <div v-else>
        <TrackRow
            v-for="(item, i) in items"
            :key="item.track.id"
            :uri="item.track.uri"
            :track-id="item.track.id"
            :name="item.track.name"
            :artist="item.track.artists?.map((a: any) => a.name).join(', ')"
            :album="item.track.album?.name"
            :image="item.track.album?.images?.[2]?.url ?? item.track.album?.images?.[0]?.url"
            :index="offset + i"
            :liked="true"
        />
    </div>
</template>
