import * as querystring from 'querystring';
import { Buffer } from 'buffer';
import { Playlist, Track } from './playlist';

type TrackResponse = {
	items: {
		track: {
			id: string,
			name: string,
			is_playable: boolean
		},
	}[]
};

type Device = {
	id: string;
	label: string;
	type: string;
	isRestricted: boolean;
};

export class Client {
	
	private _clientId: string;
	private _clientSecret: string;
	private _token: Token | null = null;
	public currentDeviceId: string = '';

	constructor(
		id: string,
		secret: string
	) {
		this._clientId = id;
		this._clientSecret = secret;
	};

	public getAuthUri(redirectUri: string): string {

		return 'https://accounts.spotify.com/authorize?' + querystring.stringify({
			response_type: 'code',
			client_id: this._clientId,
			scope: this._getAuthScopes(),
			redirect_uri: redirectUri,
		});
	}

	public authorize(
		code: string,
		redirectUri: string,
		callback?: () => void
	): void {

		fetch('https://accounts.spotify.com/api/token?' + querystring.stringify({
			code: code,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		}), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${(Buffer.from(`${this._clientId}:${this._clientSecret}`)).toString('base64')}`
			}, 
		}).then(async res => {
			if (res.status !== 200) {
				throw new Error();
			}

			const resultBody = await res.json() as {
				access_token: string,
				token_type: string,
				scope: string,
				expires_in: number,
				refresh_token: string
			};
			
			this._token = new Token(
				resultBody.access_token,
				resultBody.refresh_token,
				resultBody.scope,
				resultBody.expires_in
			);
			
			if (callback) {
				callback();
			}
		});
	}

	public async getPlaylists(): Promise<Playlist[]> {

		this._refreshToken();
	
		const res = await fetch('https://api.spotify.com/v1/me/playlists', {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			}
		});

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}

		const result = await res.json() as {
			items: {
				name: string,
				id: string
			}[]
		};
	
		if (result.items.length === 0) {
			return [];
		}

		const playlists: Playlist[] = [
			new Playlist('liked', 'Liked Songs')
		];

		for (let item of result.items) {
			playlists.push(new Playlist(item.id, item.name));
		}
		return playlists;

	}

	public async getTracks(playlistId: string): Promise<Track[]> {
		this._refreshToken();

		if (playlistId === 'liked') {
			return this._getLikedTracks();
		}

		const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			}
		});

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}

		const result = await res.json() as TrackResponse;
		if (result.items.length === 0) {
			return [];
		}

		const tracks: Track[] = [];
		for (let item of result.items) {
			tracks.push(new Track(item.track.id, item.track.name, item.track.is_playable));
		}
		return tracks;
	}

	public async getAvailableDevices(): Promise<Device[]> {
		this._refreshToken();
		
		const res = await fetch(`https://api.spotify.com/v1/me/player/devices`, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			}
		});

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}

		const result = await res.json() as {
			devices: {
				id: string,
				name: string,
				type: string,
				is_restricted: boolean,
			}[]

		};

		if (result.devices.length === 0) {
			return [];
		}

		const devices: Device[] = [];
		for (let item of result.devices) {
			devices.push({
				id: item.id,
				label: item.name,
				type: item.type,
				isRestricted: item.is_restricted			
			});
		}
		return devices;
	} 

	private async _getLikedTracks(): Promise<Track[]> {
		const res = await fetch(`https://api.spotify.com/v1/me/tracks`, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			}
		});

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}
		const result = await res.json() as TrackResponse;
		
		if (result.items.length === 0) {
			return [];
		}

		const tracks: Track[] = [];
		for (let item of result.items) {
			tracks.push(new Track(item.track.id, item.track.name, item.track.is_playable));
		}
		return tracks;

	}

	private _refreshToken() {

		if (this._token === undefined || this._token === null) {
			return;
		}

		if ((Date.now().valueOf() - this._token._created.valueOf()) / 1000 < this._token._expires) {
			return;
		}

		const queryParams = querystring.stringify({
			client_id: this._clientId,
			refresh_token: this._token._refreshToken,
			grant_type: 'refresh_token'
		});

		fetch(`https://accounts.spotify.com/api/token?${queryParams}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${(Buffer.from(`${this._clientId}:${this._clientSecret}`)).toString('base64')}`
			}, 
		}).then(async res => {
			if (res.status !== 200) {
				throw new Error();
			}

			const resultBody = await res.json() as {
				access_token: string,
				token_type: string,
				scope: string,
				expires_in: number,
				refresh_token: string
			};
			
			this._token = new Token(
				resultBody.access_token,
				resultBody.refresh_token ?? this._token?._refreshToken,
				resultBody.scope,
				resultBody.expires_in
			);
		});
		
	}

	private _getAuthScopes(): string {
		return 'user-read-private user-library-read user-read-playback-state';
	}

}

class Token {
	_accessToken: string;
	_refreshToken: string;
	_scope: string;
	_expires: number;
	_created: number;

	constructor(
		accessToken: string,
		refreshToken: string,
		scope: string,
		expires: number	
	) {
		this._accessToken = accessToken;
		this._refreshToken = refreshToken;
		this._scope = scope;
		this._expires = expires;
		this._created = Date.now();
	}

}
