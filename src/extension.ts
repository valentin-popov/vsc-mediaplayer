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
			client.authorize(
				code, 
				server.redirectUri,
				() => {
					_loadPlaylists();
					_selectPlaybackDevice();
				}
			);
		}
	);

	_initClient();
	_showPlaybar();

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.login', _initClient));
	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.devices.select', _selectPlaybackDevice));
	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.playlists.load', _loadPlaylists));
}

export function deactivate() {
	server.stop();
}

function _showPlaybar() {

	// toggle status for play/pause
	let paused = true;
	const playPauseIcon = [`$(debug-start)`, `$(debug-pause)`];
	const playPauseTooltip = ['Play song', 'Pause song'];
	let playPauseIndex = 0;

	const previous = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
	previous.text = `$(chevron-left)`;
	previous.command = 'previous';
	previous.show();

	const play = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
	play.text = playPauseIcon[playPauseIndex];
	play.tooltip = playPauseTooltip[playPauseIndex];

	play.command = 'playPause';

	vscode.commands.registerCommand('playPause', () => {
		paused = !paused;
		playPauseIndex = 1 - playPauseIndex;
		play.text = playPauseIcon[playPauseIndex];
		play.tooltip = playPauseTooltip[playPauseIndex];

	});
	play.show();

	const next = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	next.text = `$(chevron-right)`;
	next.command = 'next';
	next.show();

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

async function _loadPlaylists(): Promise<void> {
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
}

async function _selectPlaybackDevice() {
	if (client === null) {
		throw new Error('Client not initialized');
	}

	const devices = await client.getAvailableDevices();
	if (devices.length === 0) {
		throw new Error('No active Spotify devices');
	}

	vscode.window.showQuickPick(devices, {
		placeHolder: "Pick a device",
		canPickMany: false, 
	}).then(device => {
		if (device === undefined) {
			throw new Error('No Spotify device selected');
		}

		if (client === null) {
			throw new Error('Client not initialized');
		}
		client.currentDeviceId = device.id;
	});
	
}
