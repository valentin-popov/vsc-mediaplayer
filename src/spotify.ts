import * as querystring from 'querystring';
import { Buffer } from 'buffer';
import { Playlist } from './playlist';

export class Client {
	
	private _clientId: string;
	private _clientSecret: string;
	private _token: Token | null = null;

	constructor(
		id: string,
		secret: string
	) {
		this._clientId = id;
		this._clientSecret = secret;
	};

	public getAuthUri(redirectUri: string): string {
		const scope = 'user-read-private user-read-email';

		return 'https://accounts.spotify.com/authorize?' + querystring.stringify({
			response_type: 'code',
			client_id: this._clientId,
			scope: scope,
			redirect_uri: redirectUri,
		});
	}

	public authorize(
		code: string,
		redirectUri: string,
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
		});
	}

	public async getPlaylists(): Promise<Playlist[]> {

		this._refreshToken();
		const playlists: Playlist[] = [];

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
	
		for (let item of result.items) {
			playlists.push(new Playlist(item.id, item.name));
		}
		return playlists;

	}

	private _refreshToken() {

		if (this._token === undefined || this._token === null) {
			return;
		}

		if ((Date.now().valueOf() - this._token._created.valueOf()) / 1000 < this._token._expires) {
			return;
		}

		const body = new FormData();
		body.set('client_id', this._clientId);
		body.set('refresh_token', this._token?._refreshToken);
		body.set('grant_type', 'refresh_token');

		fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${(Buffer.from(`${this._clientId}:${this._clientSecret}`)).toString('base64')}`
			}, 
			body: body
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
