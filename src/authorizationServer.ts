import express from 'express';
import url from 'url';
import bodyParser from 'body-parser';
import randomstring from 'randomstring';
import cons from 'consolidate';
import querystring from 'querystring';
import _ from 'underscore';
import * as _string from 'underscore.string';
import { Request, Response } from 'express';
import nosql from 'nosql';

const db = nosql.load('database.nosql');

Object.assign(_, { string: _string });

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/authorizationServer');
app.set('json spaces', 4);

// authorization server information
const authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

interface Client {
	client_id: string;
	client_secret: string;
	redirect_uris: string[];
	scope: string;
}

// client information
const clients: Client[] = [
	{
		"client_id": "oauth-client-1",
		"client_secret": "oauth-client-secret-1",
		"redirect_uris": ["http://localhost:9000/callback"],
		"scope": "foo bar"
	}
];

interface CodeInfo {
	authorizationEndpointRequest: any;
	scope: string[];
	user: string;
}

interface UrlWithQuery extends url.UrlWithParsedQuery {
	query: Record<string, string | string[]>;
}

const codes: Record<string, CodeInfo> = {};

const requests: Record<string, any> = {};

const getClient = function(clientId: string): Client | undefined {
	return _.find(clients, function(client: Client) { return client.client_id == clientId; });
};

app.get('/', function(req: Request, res: Response) {
	res.render('index', {clients: clients, authServer: authServer});
});

app.get("/authorize", function(req: Request, res: Response){
	const client = getClient(req.query.client_id as string);

	if (client == null) {
		console.log('Unknown client %s', req.query.client_id);
		res.render('error', {error: 'Unknown client'});
		return;
	} else if (!_.contains(client.redirect_uris, req.query.redirect_uri)) {
		console.log('Mismatched redirect URI, expected %s got %s', client.redirect_uris, req.query.redirect_uri);
		res.render('error', {error: 'Invalid redirect URI'});
		return;
	} else {
		const rscope = req.query.scope ? (req.query.scope as string).split(' ') : [];
		const cscope = client.scope ? client.scope.split(' ') : [];
		if (_.difference(rscope, cscope).length > 0) {
			const urlParsed = url.parse(req.query.redirect_uri as string, true) as UrlWithQuery;
			delete urlParsed.search;
			urlParsed.query.error = 'invalid_scope';
			res.redirect(url.format(urlParsed));
			return;
		}

		const reqid = randomstring.generate(8);
		requests[reqid] = req.query;
		res.render('approve', {client: client, reqid: reqid, scope: rscope});
		return;
	}
});

app.post('/approve', function(req: Request, res: Response) {
	const reqid = req.body.reqid;
	const query = requests[reqid];
	delete requests[reqid];

	if (query == null) {
		res.render('error', {error: 'No matching authorization request'});
		return;
	}

	if (req.body.approve) {
		if (query.response_type == 'code') {
			const code = randomstring.generate(8);
			const user = req.body.user;

			const scope = _.filter(_.keys(req.body), function(s: string) { return s.startsWith('scope_'); })
				.map(function(s: string) { return s.slice('scope_'.length); });
			const client = getClient(query.client_id);
			const cscope = client?.scope ? client.scope.split(' ') : [];
			if (_.difference(scope, cscope).length > 0) {
				const urlParsed = url.parse(query.redirect_uri, true) as UrlWithQuery;
				delete urlParsed.search;
				urlParsed.query.error = 'invalid_scope';
				res.redirect(url.format(urlParsed));
				return;
			}

			codes[code] = { authorizationEndpointRequest: query, scope: scope, user: user };

			const urlParsed = url.parse(query.redirect_uri, true) as UrlWithQuery;
			delete urlParsed.search;
			urlParsed.query.code = code;
			urlParsed.query.state = query.state;
			res.redirect(url.format(urlParsed));
			return;
		} else {
			const urlParsed = url.parse(query.redirect_uri, true) as UrlWithQuery;
			delete urlParsed.search;
			urlParsed.query.error = 'unsupported_response_type';
			res.redirect(url.format(urlParsed));
			return;
		}
	} else {
		const urlParsed = url.parse(query.redirect_uri, true) as UrlWithQuery;
		delete urlParsed.search;
		urlParsed.query.error = 'access_denied';
		res.redirect(url.format(urlParsed));
		return;
	}
});

app.post("/token", function(req: Request, res: Response){
	let clientId: string | undefined;
	let clientSecret: string | undefined;

	const auth = req.headers['authorization'];
	if (auth != null) {
		const clientCredentials = Buffer.from(auth.slice('basic '.length), 'base64').toString().split(':');
		clientId = querystring.unescape(clientCredentials[0]);
		clientSecret = querystring.unescape(clientCredentials[1]);
	}

	if (req.body.client_id) {
		if (clientId != null) {
			console.log('Client attempted to authenticate with multiple methods');
			res.status(401).json({error: 'invalid_client'});
			return;
		}

		clientId = req.body.client_id;
		clientSecret = req.body.client_secret;
	}

	const client = getClient(clientId as string);
	if (client == null) {
		console.log('Unknown client %s', clientId);
		res.status(401).json({error: 'invalid_client'});
		return;
	}

	if (client.client_secret != clientSecret) {
		console.log('Mismatched client secret, expected %s got %s', client.client_secret, clientSecret);
		res.status(401).json({error: 'invalid_client'});
		return;
	}

	if (req.body.grant_type == 'authorization_code') {
		const code = codes[req.body.code];

		if (code != null) {
			delete codes[req.body.code];
			if (code.authorizationEndpointRequest.client_id == clientId) {
				const access_token = randomstring.generate();

				let cscope = null;
				if (code.scope != null) {
					cscope = code.scope.join(' ')
				}

				db.insert({ access_token: access_token, client_id: clientId, scope: cscope });

				console.log('Issuing access token %s', access_token);
				console.log('with scope %s', cscope);

				const token_response = { access_token: access_token, token_type: 'Bearer', scope: cscope };

				res.status(200).json(token_response);
				console.log('Issued tokens for code %s', req.body.code);

				return;
			} else {
				console.log('Client mismatch, expected %s got %s', code.authorizationEndpointRequest.client_id, clientId);
				res.status(400).json({error: 'invalid_grant'});
				return;
			}
		} else {
			console.log('Unknown code, %s', req.body.code);
			res.status(400).json({error: 'invalid_grant'});
			return;
		}
	} else {
		console.log('Unknown grant type %s', req.body.grant_type);
		res.status(400).json({error: 'unsupported_grant_type'});
	}
});

app.use('/', express.static('files/authorizationServer'));

db.clear();

const server = app.listen(9001, 'localhost', function () {
	const address = server.address() as { address: string; port: number };
	const host = address.address;
	const port = address.port;

	console.log('OAuth Authorization Server is listening at http://%s:%s', host, port);
});
