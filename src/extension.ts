import * as vscode from 'vscode';
import { Client } from './spotify/client';
import { Server } from './server/server';
import { MediaItemProvider, Playlist, Track } from './spotify/playlist';

const server = new Server();
let client: Client | null;

const playBar: {
	previous: vscode.StatusBarItem,
	playPause: vscode.StatusBarItem,
	next: vscode.StatusBarItem,
	currentTrack: vscode.StatusBarItem,
	init: (playing: boolean) => void,
	show: () => void,
	setPlaying: (playState: boolean) => void,
} = {
	previous: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 4),
	playPause: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3),
	next: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2),
	currentTrack: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1),
	async init(playing: boolean) {
	
		this.previous.text = `$(chevron-left)`;
		this.previous.command = 'previous';
	
		this.next.text = `$(chevron-right)`;
		this.next.command = 'next';
	
		this.playPause.command = 'playPause';

		if (playing) {
			this.playPause.text = `$(debug-pause)`;
			this.playPause.tooltip = 'Pause song';
		} else {
			this.playPause.text = `$(debug-start)`;
			this.playPause.tooltip = 'Play song';
		}

		if (client !== null) {
			// todo: update global currentTrack
			this.currentTrack.text = await client.getCurrentTrack();
		}

	},
	show() {
		if (this !== undefined) {
			this.previous.show();
			this.playPause.show();
			this.next.show();
			this.currentTrack.show();
		}
	},
	setPlaying(playState) {
		if (playState) {
			this.playPause.text = `$(debug-pause)`;
			this.playPause.tooltip = 'Pause song';
			return;
		}
			this.playPause.text = `$(debug-start)`;
			this.playPause.tooltip = 'Play song';
	},
};

let currentTrack: Track;
let currentPlaylist: Playlist;

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

	let isPlaying = await _isPlaying();

	playBar.init(isPlaying);
	playBar.show();

	vscode.commands.registerCommand('playPause', async () => {
		if (client === null) {
			throw new Error('Client not initialized');
		}	

		isPlaying = await _isPlaying();

		if (isPlaying) {
			client.pausePlaying();
		} else {
			client.resumePlaying();
		}

		playBar.setPlaying(!isPlaying);

	});

	vscode.commands.registerCommand('next', async () => {
		if (client === null) {
			throw new Error('Client not initialized');
		}
		
		if (currentTrack === undefined) {
			throw new Error('No track playing');
		}
		if (currentTrack.nextTrackId === undefined) {
			return;
		}

		client.resumePlaying(currentTrack.nextTrackId);
		playBar.setPlaying(true);
		const nextTrack = currentPlaylist.getTrackById(currentTrack.nextTrackId)
		if (nextTrack === null) {
			return;
		}
		currentTrack = nextTrack;
		if (typeof currentTrack.label === 'string') {
			playBar.currentTrack.text = currentTrack.label;
		}

	});

	vscode.commands.registerCommand('previous', async () => {
		if (client === null) {
			throw new Error('Client not initialized');
		}
		
		if (currentTrack === undefined) {
			throw new Error('No track playing');
		}
		if (currentTrack.previousTrackId === undefined) {
			return;
		}
		
		if (await client.getPlayingPosition() > 3000) {
			client.resumePlaying(currentTrack.id);
			playBar.setPlaying(true);
			return;
		}

		client.resumePlaying(currentTrack.previousTrackId);

		playBar.setPlaying(true);
		const prevTrack = currentPlaylist.getTrackById(currentTrack.previousTrackId);
		if (prevTrack === null) {
			return;
		}
		currentTrack = prevTrack;
		if (typeof currentTrack.label === 'string') {
			playBar.currentTrack.text = currentTrack.label;
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

		// todo: first 20 items must be retrieved from the playlist read response,
		// the rest of the playlist should be populated now

		const tracks = await client.getTracks(event.selection[0].id);
		currentPlaylist = event.selection[0];

		vscode.window.createTreeView('tracks', {
			treeDataProvider: new MediaItemProvider<Track>(tracks)
		}).onDidChangeSelection(async event => {
			if (!event.selection.length) {
				throw new Error('Invalid selection');
			}
			if (client === null) {
				throw new Error('Client not initialized');
			}
			
			const isPlaying = await _isPlaying();
			await client.resumePlaying(event.selection[0].id);
			if (!isPlaying) {
				playBar.setPlaying(true);
			}

			currentTrack = event.selection[0];
			if (typeof event.selection[0].label === 'string') {
				playBar.currentTrack.text = event.selection[0].label;
			}
		});

		tracks.forEach((track) => {
			currentPlaylist.addTrack(track);
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
