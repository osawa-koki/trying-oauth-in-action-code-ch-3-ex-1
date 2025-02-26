import express, { Request, Response } from 'express';
import url from 'url';
import qs from 'qs';
import querystring from 'querystring';
import cons from 'consolidate';
import randomstring from 'randomstring';
import _ from 'underscore';
import * as _string from 'underscore.string';
import axios from 'axios';

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
  "client_id": "oauth-client-1",
  "client_secret": "oauth-client-secret-1",
  "redirect_uris": ["http://localhost:9000/callback"]
};

const protectedResource = 'http://localhost:9002/resource';

let state: string | null = null;
let access_token: string | null = null;
let scope: string | null = null;

app.get('/', function (req: Request, res: Response) {
  res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req: Request, res: Response) {
  /*
   * Send the user to the authorization server
   */
  state = randomstring.generate(10);
  const authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    state: state,
  });
  res.redirect(authorizeUrl);
});

app.get('/callback', async function(req: Request, res: Response) {
  /*
   * Parse the response from the authorization server and get a token
   */
  const _state = req.query.state as string;
  if (_state !== state) {
    res.render('error', {error: 'State value does not match'});
    return;
  }
  const code = req.query.code as string;
  const formData = qs.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: client.redirect_uris[0],
  });
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${encodeClientCredentials(client.client_id, client.client_secret)}`,
  };
  try {
    const tokenResponse = await axios.post(authServer.tokenEndpoint, formData, { headers });
    const _accessToken = tokenResponse.data.access_token;
    const _scope = tokenResponse.data.scope;
    res.render('index', {access_token: _accessToken, scope: _scope});
    access_token = _accessToken;
    scope = _scope;
  } catch (error) {
    res.render('error', {error: 'Failed to get access token'});
  }
});

app.get('/fetch_resource', async function(req: Request, res: Response) {
  /*
   * Use the access token to call the resource server
   */
  if (access_token == null) {
    res.render('error', {error: 'Missing access token'});
    return;
  }
  const headers = {
    'Authorization': `Bearer ${access_token}`,
  };
  try {
    const resourceResponse = await axios.post(protectedResource, null, { headers });
    if (resourceResponse.status >= 200 && resourceResponse.status < 300) {
      res.render('data', {resource: resourceResponse.data});
      return;
    }
    res.render('error', {error: 'Server returned response code ' + resourceResponse.status});
  } catch (error) {
    res.render('error', {error: 'Failed to fetch resource'});
  }
});

interface UrlWithQuery extends url.UrlWithParsedQuery {
  query: Record<string, string | string[]>;
}

const buildUrl = function(base: string, options: Record<string, string>, hash?: string) {
  const newUrl = url.parse(base, true) as UrlWithQuery;
  delete newUrl.search;
  if (newUrl.query == null) {
    newUrl.query = {};
  }
  _.each(options, function(value: string, key: string) {
    newUrl.query[key] = value;
  });
  if (hash != null) {
    newUrl.hash = hash;
  }

  return url.format(newUrl);
};

const encodeClientCredentials = function(clientId: string, clientSecret: string) {
  return Buffer.from(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

const server = app.listen(9000, 'localhost', function () {
  const address = server.address() as { address: string; port: number };
  const host = address.address;
  const port = address.port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
