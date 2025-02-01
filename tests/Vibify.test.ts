import request from 'supertest';
import express from 'express';
import setupCors from '../src/middlewares/setupCors';
import 'jest';

const mockRoutes = express.Router();

// Define the root route
mockRoutes.get('/', (req, res) => {
    res.status(200).send('OK');
});

// Handle unknown routes
mockRoutes.use((req, res) => {
    res.status(404).json({ error: '404: Not found' });
});

const app = express();
app.use(setupCors); // Use the actual setupCors middleware
app.use(express.json());
app.use('/', mockRoutes);

describe('Vibify API', () => {
    it('should return 404 for unknown routes', async () => {
        const response = await request(app).get('/unknown-route');
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: '404: Not found' });
    });

    it('should return 200 for the root route', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
    });

    it('should handle CORS setup correctly', async () => {
        const response = await request(app).options('/');
        expect(response.headers['access-control-allow-origin']).toBe('*');
    });
});