// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const enterCredentials = vscode.commands.registerCommand('vsc-mediaplayer.enterCredentials', () => {
		vscode.window.showInputBox({
			placeHolder: 'Client ID',
			ignoreFocusOut: true,
		}).then(id => {
			if (id === undefined) {
				return;
			}
			context.secrets.store('id', id);

			vscode.window.showInputBox({
				placeHolder: 'Client Secret',
				ignoreFocusOut: true,
			}).then(secret => {
				if (secret === undefined) {
					return;
				}
				context.secrets.store('secret', secret);
				generateToken(id, secret, context);
			}, error => {
				console.error(error);
			});
		});
	});

	const searchSong = vscode.commands.registerCommand('vsc-mediaplayer.searchSong', () => {

		vscode.window.showInputBox({
			placeHolder: 'Search',
		}).then(term => {
			if (term === undefined) {
				return;
			}

			const items = search(context, term);


		});

	});

	context.subscriptions.push(enterCredentials);
	context.subscriptions.push(searchSong);

}

// This method is called when your extension is deactivated
export function deactivate() { }

async function generateToken(clientId: string, clientSecret: string, context: vscode.ExtensionContext) {
	const urlParams = (new URLSearchParams());
	urlParams.append('grant_type', 'client_credentials');

	const response = await fetch('https://accounts.spotify.com/api/token', {
		headers: {
			'Authorization': 'Basic ' + new (Buffer as any).from(clientId + ':' + clientSecret).toString('base64'),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: urlParams,
		method: "POST"
	});
	
	const result = await response.json() as {
		access_token: string,
		expires_in: number
	};

	if (response.status !== 200) {
		return console.error(`Error: status ${response.status}`);
	}

	context.secrets.store('token', result.access_token);
	context.secrets.store('tokenCreated', `${Date.now()}`);
	context.secrets.store('tokenExpires', `${result.expires_in}`);
}


async function getToken(context: vscode.ExtensionContext) {

	let token = await context.secrets.get('token');
	const created = await context.secrets.get('tokenCreated');

	if (typeof created !== 'string') {
		return; // error
	}

	const expires = await context.secrets.get('tokenExpires');
	if (typeof expires !== 'string') {
		return; // error
	}

	if ((Date.now() - +created) / 1000 > +expires) {
		generateToken(
			await context.secrets.get('id') as string,
			await context.secrets.get('secret') as string,
			context,
		);

		token = await context.secrets.get('token');
	}
	
	return token;
}

async function search(context: vscode.ExtensionContext, term: string) {

	const token = await getToken(context);
	console.log(token);

	const url = new URL('https://api.spotify.com/v1/search');
	url.searchParams.append('q', term);
	url.searchParams.append('type', 'track');

	try {
		const response = await fetch(url, {
			headers: {
				'Authorization': 'Bearer ' + token
			},
			method: 'GET'
		});
		return await response.json();
	} catch (e) {
		console.error(e);
	}

}
