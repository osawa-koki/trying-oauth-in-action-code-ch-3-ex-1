import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cons from 'consolidate';
import nosql from 'nosql';
import cors from 'cors';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/protectedResource');
app.set('json spaces', 4);

app.use('/', express.static('files/protectedResource'));
app.use(cors());

const db = nosql.load('database.nosql');

interface Resource {
	name: string;
	description: string;
}

const resource: Resource = {
	"name": "Protected Resource",
	"description": "This data has been protected by OAuth 2.0"
};

interface TokenData {
	access_token: string;
	client_id: string;
	scope: string | null;
}

declare module 'express' {
	interface Request {
		access_token?: TokenData;
	}
}

const getAccessToken = function(req: Request, res: Response, next: NextFunction) {
	const auth = req.headers['authorization'];
	let inToken: string | null = null;
	if (auth != null && auth.toLowerCase().indexOf('bearer') == 0) {
		inToken = auth.slice('bearer '.length);
	} else if (req.body != null && req.body.access_token != null) {
		inToken = req.body.access_token;
	} else if (req.query != null && req.query.access_token != null) {
		inToken = req.query.access_token as string;
	}

	console.log('Incoming token: %s', inToken);
	db.one().make(function(builder: any) {
		builder.where('access_token', inToken);
		builder.callback(function(err: Error | null, token: TokenData | null) {
			if (token != null) {
				console.log("We found a matching token: %s", inToken);
			} else {
				console.log('No matching token was found.');
			}
			req.access_token = token ?? undefined;
			next();
			return;
		});
	});
};

app.options('/resource', cors());
app.post("/resource", cors(), getAccessToken, function(req: Request, res: Response){
	if (req.access_token != null) {
		res.json(resource);
	} else {
		res.status(401).end();
	}
});

const server = app.listen(9002, 'localhost', function () {
	const address = server.address() as { address: string; port: number };
	const host = address.address;
	const port = address.port;

	console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
