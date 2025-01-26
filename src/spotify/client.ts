import * as querystring from 'querystring';
import { Buffer } from 'buffer';
import { Playlist, Track } from './playlist';

type TrackResponse = {
	items: {
		track: TrackItem
	}[],
	next: string | null
};

type TrackItem = {
	id: string,
	name: string,
	is_playable: boolean
};

type Device = {
	id: string;
	label: string;
	type: string;
	isRestricted: boolean;
};

type DeviceResponse = {
	id: string,
	name: string,
	type: string,
	is_restricted: boolean,
};

type CurrentlyPlayingItem = {
	item: {
		name: string
	},
	progress_ms: number | null
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
	
		let fetchUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
	
		const playlists: Playlist[] = [
			new Playlist('liked', 'Liked Songs')
		];

		while(true) {

			const res = await fetch(fetchUrl, {
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
				}[],
				next: string
			};

			result.items.forEach(item => {
				playlists.push(new Playlist(item.id, item.name));
			});

			if (result.next === null) {
				break;
			}

			fetchUrl = `${result.next}&limit=50`;

		}

		return playlists;

	}

	public async getTracks(playlistId: string): Promise<Track[]> {
		this._refreshToken();

		const tracks: Track[] = [];

		const res = await this._fetchTracks(playlistId);
		for (let i = 0; i < res.length; i++) {
		
			const track = new Track(
				res[i].track.id,
				res[i].track.name, 
				res[i].track.is_playable,
			);
	
			if (i < res.length - 1) {
				track.nextTrackId = res[i + 1].track.id;
			}
	
			if (i > 0) {
				track.previousTrackId = res[i - 1].track.id;
			}
	
			tracks.push(track);

		}

		return tracks;
	}

	private async _fetchTracks(playlistId: string): Promise<{track: TrackItem}[]> {

		let fetchUrl: string | null = playlistId === 'liked' ?
			'https://api.spotify.com/v1/me/tracks?limit=50': 
			`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
		
		let tracks: {
			track: TrackItem
		}[] = [];

		while(true) {

			const res = await fetch(fetchUrl, {
				headers: {
					'Authorization': `Bearer ${this._token?._accessToken}`
				}
			});
	
			if (res.status !== 200) {
				throw new Error(`Error: status ${res.status}`);
			}
	
			const result = await res.json() as TrackResponse;

			tracks.push(...result.items);
			if (result.next === null) {
				break;
			}

			fetchUrl = `${result.next}&limit=50`;

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
			devices: DeviceResponse[]
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

	public async isPlaying(): Promise<boolean> {
		this._refreshToken();
		
		const res = await fetch(`https://api.spotify.com/v1/me/player`, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			}
		});

		if (res.status === 204) {
			throw new Error(`Error: status ${res.status}`, {
				cause: 'missing_player'
			});
		}

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}
		const result = await res.json() as {
			device:	DeviceResponse,
			is_playing: boolean,
		};

		this.currentDeviceId = result.device.id;
		return result.is_playing;
	}

	public async resumePlaying(trackId?: string, playlistId?: string): Promise<void> {
		this._refreshToken();
		
		let url = 'https://api.spotify.com/v1/me/player/play';

		if (this.currentDeviceId !== '') {
			url = `${url}?${this.currentDeviceId}`;
		}

		const options: RequestInit = {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			},
			method: 'PUT'
		};

		let body: {
			uris?: string[],
			context_uri?: string
		} = {};

		if (trackId !== undefined) {
			body.uris = [`spotify:track:${trackId}`];
		}

		if (playlistId !== undefined) {
			body.context_uri = `spotify:playlist:${playlistId}`;
		}
		
		if (body.uris || body.context_uri) {
			options.body = JSON.stringify(body);
		}

		const res = await fetch(url, options);

		if (res.status > 204) {
			throw new Error(`Error: status ${res.status}`);
		}

	}

	public async pausePlaying(): Promise<void> {
		this._refreshToken();
		
		let url = 'https://api.spotify.com/v1/me/player/pause';

		if (this.currentDeviceId !== '') {
			url = `${url}?device_id=${this.currentDeviceId}`;
		}

		const res = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			},
			method: 'PUT'
		});

		if (res.status > 204) {
			throw new Error(`Error: status ${res.status}`);
		}
		
	}

	public async getCurrentTrack(): Promise<string> {

		// todo: return item
		const result = await this._getCurrentlyPlaying();
		return result.item.name;
	}

	public async getPlayingPosition(): Promise<number> {
		const currentItem = this._getCurrentlyPlaying();
		return (await currentItem).progress_ms ?? 0;
	}

	private async _getCurrentlyPlaying(): Promise<CurrentlyPlayingItem> {
		this._refreshToken();
		
		const res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
			headers: {
				'Authorization': `Bearer ${this._token?._accessToken}`
			},
		});

		if (res.status !== 200) {
			throw new Error(`Error: status ${res.status}`);
		}
		return await res.json() as CurrentlyPlayingItem;
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
		return 'user-read-private user-library-read user-read-playback-state user-modify-playback-state';
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
