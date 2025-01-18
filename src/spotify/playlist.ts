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

}

export class Track extends vscode.TreeItem {
	id: string;
	isPlayable: boolean;
	
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