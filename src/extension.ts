import * as vscode from 'vscode';
import { Client } from './spotify/client';
import { Server } from './server/server';
import { MediaItemProvider, Playlist, Track } from './spotify/playlist';

const server = new Server();
let client: Client | null;

export function activate(context: vscode.ExtensionContext) {

	server.start(
		(message) => vscode.window.showInformationMessage(message),
		(code) => {
			// called after login, on redirect
			if (client === null) {
				throw new Error('Client not initialized');
			}
			client.authorize(code, server.redirectUri);
		}
	);

	_initClient();

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.login', () => {
		_initClient();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.playlists.load', async () => {
		if (client === null) {
			throw new Error('Client not initialized');
		}		
		
		vscode.window.createTreeView('playlists', {
			treeDataProvider: new MediaItemProvider<Playlist>(await client.getPlaylists())
		}).onDidChangeSelection(async event => {
			if (!event.selection.length) {
				throw new Error('Invalid selection');
			}

			if (client === null) {
				throw new Error('Client not initialized');
			}

			const tracks = await client.getTracks(event.selection[0].id);

			vscode.window.createTreeView('tracks', {
				treeDataProvider: new MediaItemProvider<Track>(tracks)
			});
		});

	}));
}

export function deactivate() {
	server.stop();
}

function _initClient(): void {
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
}