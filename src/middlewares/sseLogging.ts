import {NextFunction, Request, Response} from 'express';
import boxen from 'boxen';
import chalk from 'chalk';
import terminalImage from 'terminal-image';
import terminalLink from 'terminal-link';
import got from 'got';
import imageType from 'image-type';
import {log} from "@/types/spotify";

const colors = {
    title: chalk.bold.green,
    label: chalk.cyan,
    value: chalk.white,
    error: chalk.red.bold,
    warning: chalk.yellow.italic,
    success: chalk.green,
    info: chalk.blue,
    debug: chalk.gray.italic
};

interface RequestWithLog extends Request {
    log?: log;
    lastStartMessage?: string;
    logBuffer?: string[];
}

const sseLoggingMiddleware = (req: RequestWithLog, res: Response, next: NextFunction) => {
    req.logBuffer = []; // Initialize log buffer
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    req.log = async (message: string, type: string, images: boolean | undefined) => {
        if (type === 'image' && images) {
            try {
                const response = await got(message, {responseType: 'buffer'} as any);
                const imageBuffer = response.body;
                const typeInfo = await imageType(imageBuffer);

                if (!typeInfo) {
                    req.log?.("Could not determine image type", "error");
                    return;
                }

                const image = await terminalImage.buffer(imageBuffer, {height: '100%'});
                res.write(`\n${image}\n`);
            } catch (error) {
                req.log?.(`Error fetching or processing image: ${(error as Error).message}`, "error");
            }
            return;
        }

        let formattedMessage;

        if (type === 'start') {
            req.lastStartMessage = message;
            req.logBuffer = []; // Reset buffer when a new start message is sent

            formattedMessage = boxen(colors.title(message), {
                padding: 1,
                borderStyle: 'double',
                borderColor: 'green'
            });

            res.write(`${formattedMessage}\n`);
        } else if (type === 'update-start' && req.lastStartMessage) {
            formattedMessage = boxen(colors.title(message), {
                padding: 1,
                borderStyle: 'double',
                borderColor: 'green'
            });

            if (!res.writableEnded) {
                const linesToClear = (req.logBuffer?.length ?? 0) + 5;
                res.write(`\x1B[${linesToClear}A`);
                res.write(`\x1B[2K\r`.repeat(linesToClear));

                res.write(`${formattedMessage}\n`);
                req.logBuffer?.forEach(log => res.write(log + '\n'));
            }
            return;
        } else {
            if (colors[type as keyof typeof colors]) {
                formattedMessage = colors[type as keyof typeof colors](message);
            } else {
                const [label, ...rest] = message.split(':');
                formattedMessage = colors.label(label) + (rest.length ? ': ' + colors.value(rest.join(':').trim()) : '');
            }

            // Make URLs clickable (not supported in all terminals)
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            formattedMessage = formattedMessage.replace(urlRegex, url => terminalLink(url, url));

            req.logBuffer?.push(formattedMessage); // Save log to buffer
            if (!res.writableEnded) {
                res.write(`${formattedMessage}\n`);
            }
        }
    };

    next();
};

export default sseLoggingMiddleware;