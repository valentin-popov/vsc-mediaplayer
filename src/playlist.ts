import * as vscode from 'vscode';

export class PlaylistProvider implements vscode.TreeDataProvider<Playlist> {
	data: Playlist[] = [];

	onDidChangeTreeData?: vscode.Event<void | Playlist | Playlist[] | null | undefined> | undefined;
	
	getTreeItem(element: Playlist): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	getChildren(): vscode.ProviderResult<Playlist[]> {

		return this.data;
	}

	constructor(playlists: Playlist[]) {
		this.data = playlists;
	}
}


export class Playlist extends vscode.TreeItem {
	id: string;
	name: string;

	constructor(
		id: string,
		label: string
	) {
		super(label);
		this.id = id;
		this.name = label;
		this.tooltip = 'test tooltip';
		this.description = 'test description';
	}

}
