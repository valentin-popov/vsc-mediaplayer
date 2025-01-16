import * as http from 'http';

/**
 * Simple http server listening to the redirect endpoint
 */
export class Server {
	port: number;
	redirectUri: string;

	private server: http.Server | null = null;

	constructor(port: number = 3000) {
		this.port = port;
		this.redirectUri = `http://localhost:${port}/callback`;
	}

	public start(
		confirmation: (message: string) => void,
		callback: (code: string) => void,
	): void {
		if (this.server) {
			throw new Error(`Server is already running on port ${this.port}`);
		}

		this.server = http.createServer((req, res) => {
			if (req.url?.startsWith('/callback')) {
				callback(this._getCode(req, res));
			} else {
				this._handleNotFound(res);
			}
		});

		this.server.listen(this.port, () => {
			confirmation(`Server started on http://localhost:${this.port}`);
		});
	}

	public stop(): void {
		if (this.server) {
			this.server.close(() => {
				console.log(`Server stopped on port ${this.port}`);
			});
			this.server = null;
		} else {
			console.log('Server is not running.');
		}
	}

	private _getCode(req: http.IncomingMessage, res: http.ServerResponse): string{
		res.writeHead(200, { 'Content-Type': 'text/html' });

		const query = (req.url as string).split('?')[1];
		const code = (new URLSearchParams(query)).get('code');

		if (code === null) {
			this._handleNotFound(res);
			return '';
		}

		res.end(this._getSuccessHTMLContent());
		return code;
	}

	private _handleNotFound(res: http.ServerResponse): void {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not Found');
	}

	private _getSuccessHTMLContent(): string {
		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Close Page</title>
			<style>
				body {
					font-family: Arial, sans-serif;
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100vh;
					margin: 0;
					background-color: #f4f4f9;
					text-align: center;
				}
				.container {
					background: #ffffff;
					padding: 20px 40px;
					border-radius: 8px;
					box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
				}
				.tick {
					width: 50px;
					height: 50px;
					margin-bottom: 20px;
				}
				.message {
					font-size: 18px;
					color: #4CAF50;
					font-weight: bold;
				}
			</style>
		</head>
		<body>
			<div class="container">
				<img src="https://img.icons8.com/ios-filled/50/4CAF50/checkmark.png" alt="Green Tick" class="tick" />
				<p class="message">You can now close this page</p>
			</div>
		</body>
		</html>`;
	}
}
