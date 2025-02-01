import * as dotenv from 'dotenv'
import express, { Request, Response } from 'express';
import router from './routes/routes.js'
import setupCors from './middlewares/setupCors.js'

dotenv.config();

const app = express();
app.use(setupCors);
app.use(express.json());
app.use('/', router);

app.use((req: Request, res: Response) => {
    res.status(404).json({ error: '404: Not found' })
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`))