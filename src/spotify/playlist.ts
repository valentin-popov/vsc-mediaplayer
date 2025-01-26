import * as vscode from 'vscode';

export class MediaItemProvider<Type extends vscode.TreeItem> implements vscode.TreeDataProvider<Type> {
	
	private _data: Type[] = [];
	
	constructor(items: Type[]) {
		this._data = items;
	}

	getTreeItem(element: Type): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(): vscode.ProviderResult<Type[]> {
		return this._data;
	}

}

export class Playlist extends vscode.TreeItem {
	id: string;

	constructor(
		id: string,
		label: string
	) {
		super(label);
		this.id = id;
	}

	private _list: Record<string, Track> | null = null;

	public get list(): Record<string, Track> {
		if (this._list === null) {
			return {
				'': new Track('', '', false)
			};
		}
		return this._list;
	}

	public getTrackById(id: string): Track | null {
		if (this._list === null) {
			return null;
		}
		return this._list[id];
	}

	public addTrack(track: Track) {
		if (this._list === null) {
			this._list = {
				[track.id]: track
			};
		}
		this._list[track.id] = track; 
	}
}

export class Track extends vscode.TreeItem {
	id: string;
	isPlayable: boolean;
	nextTrackId?: string;
	previousTrackId?:string;
	
	constructor(
		id: string,
		label: string,
		isPlayable: boolean
	) {
		super(label);
		this.id = id;
		this.isPlayable = isPlayable;
	}

}
