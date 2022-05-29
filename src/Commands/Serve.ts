import { Command } from 'commander';
import { container } from 'tsyringe';
import BackendManager from '../BackendManager';
import { setup } from '../CommandsHelper';
import Config, { IServerConfig } from '../Config';
import Database from '../Database';
import PeerManager from '../PeerManager';
import Server from '../Server';


const command = new Command('serve');

command.description('Run a graphql server');
command.option("-p, --port", "Port to server listen on");
command.option("--host", "Host or ip to server listen on");
command.action(async ({ host, port }: Partial<IServerConfig>) => {
	await setup();

	const config = container.resolve(Config);
	if (config.data.server === undefined) {
		config.data.server = {
			port: 80,
			host: "0.0.0.0",
		};
	}
	if (host !== undefined) {
		config.data.server.host = host;
	}
	if (port !== undefined) {
		config.data.server.port = port;
	}

	const database = container.resolve(Database);
	await database.init();

	const backendManager = container.resolve(BackendManager);
	await backendManager.init();

	const peerManager = container.resolve(PeerManager);
	await peerManager.init();

	const server = container.resolve(Server);
	server.listen();

	await peerManager.healthCheck();
	peerManager.setupHealthCheckInterval(10 * 1000);

});

export default command;
