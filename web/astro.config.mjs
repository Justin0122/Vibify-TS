// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    output: 'static',
    integrations: [vue(), react()],
    server: {
        host: true,
        port: 5432,
    },
    vite: {
        plugins: [tailwindcss()],
    },
});
