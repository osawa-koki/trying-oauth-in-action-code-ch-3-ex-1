import express from 'express';
import request from 'sync-request';
import url from 'url';
import qs from 'qs';
import querystring from 'querystring';
import cons from 'consolidate';
import randomstring from 'randomstring';
import _ from 'underscore';
import * as _string from 'underscore.string';
import { Request, Response } from 'express';

Object.assign(_, { string: _string });

const app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
const authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information

/*
 * Add the client information in here
 */
const client = {
	"client_id": "",
	"client_secret": "",
	"redirect_uris": ["http://localhost:9000/callback"]
};

const protectedResource = 'http://localhost:9002/resource';

let state: string | null = null;

let access_token: string | null = null;
let scope: string | null = null;

app.get('/', function (req: Request, res: Response) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req: Request, res: Response){
	/*
	 * Send the user to the authorization server
	 */
});

app.get('/callback', function(req: Request, res: Response){
	/*
	 * Parse the response from the authorization server and get a token
	 */
});

app.get('/fetch_resource', function(req: Request, res: Response) {
	/*
	 * Use the access token to call the resource server
	 */
});

const buildUrl = function(base: string, options: Record<string, any>, hash?: string) {
	const newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	_.each(options, function(value: any, key: string) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}

	return url.format(newUrl);
};

const encodeClientCredentials = function(clientId: string, clientSecret: string) {
	return Buffer.from(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

const server = app.listen(9000, 'localhost', function () {
	const host = server.address() as { address: string; port: number };
	const port = host.port;
	console.log('OAuth Client is listening at http://%s:%s', host.address, port);
});
