import * as vscode from 'vscode';
import { Client } from './spotify';
import { Server } from './server';
import { PlaylistProvider } from './playlist';

const server = new Server();

export function activate(context: vscode.ExtensionContext) {
	let client: Client;

	server.start(
		(message) => vscode.window.showInformationMessage(message),
		(code) => {
			// called after login, on redirect
			client.authorize(code, server.redirectUri);
		}
	);

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.login', () => {
		vscode.window.showInputBox({
			placeHolder: 'Client ID',
			ignoreFocusOut: true,
		}).then(id => {
			if (id === undefined) {
				return;
			}

			vscode.window.showInputBox({
				placeHolder: 'Client Secret',
				ignoreFocusOut: true,
			}).then(async secret => {
				if (secret === undefined) {
					return;
				}
				
				client = new Client(id, secret);
				vscode.env.openExternal(vscode.Uri.parse(client.getAuthUri(server.redirectUri)));
			});
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.playlists.load', async () => {
		const pl = await client.getPlaylists();	
		const prov = new PlaylistProvider(pl);
		vscode.window.createTreeView('playlists', {
			treeDataProvider: prov
		});

	}));
}

export function deactivate() {
	server.stop();
}
