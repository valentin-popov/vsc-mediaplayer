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
					// _selectPlaybackDevice();
					_showPlaybar();

				}
			);
		}
	);

	_initClient();

	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.login', _initClient));
	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.devices.select', _selectPlaybackDevice));
	context.subscriptions.push(vscode.commands.registerCommand('vsc-spotify.playlists.load', _loadPlaylists));
}

export function deactivate() {
	server.stop();
}

async function _showPlaybar() {

	const playIcon = `$(debug-start)`, pauseIcon = `$(debug-pause)`;
	const playTooltip  = 'Play song', pauseTooltip = 'Pause song';

	const previous = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
	const play = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
	const next = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

	previous.text = `$(chevron-left)`;
	previous.command = 'previous';

	next.text = `$(chevron-right)`;
	next.command = 'next';

	play.text = playIcon;
	play.tooltip = playTooltip;
	play.command = 'playPause';

	if (await _isPlaying()) {
		play.text = pauseIcon;
		play.tooltip = pauseIcon;
	}

	play.show();
	next.show();
	previous.show();

	vscode.commands.registerCommand('playPause', async () => {
		if (client === null) {
			throw new Error('Client not initialized');
		}	

		const isPlaying = await _isPlaying();

		if (isPlaying) {
			client.pausePlaying();
			play.tooltip = playTooltip;
			play.text = playIcon;
		} else {
			client.resumePlaying();
			play.tooltip = pauseTooltip;
			play.text = pauseIcon;
		}

	});
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
		}).onDidChangeSelection(async event => {
			if (!event.selection.length) {
				throw new Error('Invalid selection');
			}
			if (client === null) {
				throw new Error('Client not initialized');
			}
			
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

async function _isPlaying(): Promise<boolean> {
	if (client === null) {
		throw new Error('Client not initialized');
	}

	let isPlaying = false;
	try {
		isPlaying = await client.isPlaying();
	} catch (exc) {
		if (exc instanceof Error && exc.cause === 'missing_player') {
			vscode.window.showErrorMessage('No open Spotify device');
			return false;
		}
	}
	return isPlaying;
}
