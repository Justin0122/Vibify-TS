<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../lib/api';

const years = ref<number[]>([]);
const months = ref<number[]>([]);
const selectedYear = ref<number | null>(null);
const selectedMonth = ref<number | null>(null);
const playlists = ref<any[]>([]);
const status = ref('');
const busy = ref(false);

const monthName = (month: number) => new Date(2000, month - 1).toLocaleString('default', { month: 'long' });

onMounted(async () => {
    try {
        years.value = await api.likedYears();
        const page = (await api.playlists({ limit: 50 })) as any;
        playlists.value = page.items ?? [];
    } catch (err) {
        status.value = (err as Error).message;
    }
});

async function pickYear(year: number) {
    selectedYear.value = year;
    selectedMonth.value = null;
    months.value = await api.likedMonths(year);
}

async function createOne() {
    if (!selectedYear.value || !selectedMonth.value) return;
    busy.value = true;
    status.value = 'Creating…';
    try {
        const created = (await api.createPlaylist({ month: selectedMonth.value, year: selectedYear.value })) as any;
        status.value = created.alreadyExisted ? `Already exists: ${created.name}` : `Created: ${created.name} (${created.trackCount} tracks)`;
    } catch (err) {
        status.value = (err as Error).message;
    } finally {
        busy.value = false;
    }
}

async function createAll() {
    busy.value = true;
    status.value = 'Creating playlists for every liked month — this can take a while…';
    try {
        const created = (await api.createMonthlyPlaylists()) as any[];
        const fresh = created.filter(p => !p.alreadyExisted).length;
        status.value = `Done: ${created.length} months processed, ${fresh} new playlists`;
    } catch (err) {
        status.value = (err as Error).message;
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="rounded-2xl bg-surface-raised p-6">
        <h2 class="mb-1 text-lg font-semibold">Monthly playlist generator</h2>
        <p class="mb-4 text-sm text-muted">
            Builds "Liked Songs from &lt;month&gt;" playlists from your synced liked-tracks history. Run "Sync to DB" on the Liked page first.
        </p>

        <div class="mb-3 flex flex-wrap gap-2">
            <button
                v-for="year in years"
                :key="year"
                @click="pickYear(year)"
                class="rounded-full px-3 py-1.5 text-sm"
                :class="selectedYear === year ? 'bg-brand font-semibold text-black' : 'bg-white/10'"
            >
                {{ year }}
            </button>
        </div>
        <div v-if="months.length" class="mb-4 flex flex-wrap gap-2">
            <button
                v-for="month in months"
                :key="month"
                @click="selectedMonth = month"
                class="rounded-full px-3 py-1.5 text-sm"
                :class="selectedMonth === month ? 'bg-brand font-semibold text-black' : 'bg-white/10'"
            >
                {{ monthName(month) }}
            </button>
        </div>

        <div class="flex gap-3">
            <button
                @click="createOne"
                :disabled="busy || !selectedMonth"
                class="rounded-lg bg-brand px-4 py-2 font-semibold text-black disabled:opacity-40"
            >
                Create playlist
            </button>
            <button @click="createAll" :disabled="busy" class="rounded-lg bg-white/10 px-4 py-2 disabled:opacity-40">
                Create for all months
            </button>
        </div>
        <p v-if="status" class="mt-3 text-sm text-brand">{{ status }}</p>
    </div>

    <div class="mt-6">
        <h3 class="mb-2 font-semibold">Your playlists</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <a
                v-for="playlist in playlists"
                :key="playlist.id"
                :href="playlist.external_urls?.spotify"
                target="_blank"
                class="rounded-xl bg-surface-raised p-3 transition-colors hover:bg-surface-hover"
            >
                <img
                    v-if="playlist.images?.[0]"
                    :src="playlist.images[0].url"
                    alt=""
                    class="mb-2 aspect-square w-full rounded-lg object-cover"
                    loading="lazy"
                />
                <p class="truncate text-sm font-medium">{{ playlist.name }}</p>
                <p class="text-xs text-muted">{{ playlist.items?.total ?? playlist.tracks?.total ?? 0 }} tracks</p>
            </a>
        </div>
    </div>
</template>
